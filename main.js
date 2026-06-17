'use strict';

const fs   = require('fs');
const path = require('path');
const rl   = require('readline');

const xlsx = require('node-xlsx');

// ── Constants ──────────────────────────────────────────────────────────────
const INPUT_DIR      = 'input/';
const OUTPUT_FILE    = 'relnote-viewer/src/assets/relnotes.json';
const CREDS_FILE     = 'credentials.properties';
const FAILED_FILE    = 'failed-downloads.json';
const RELNOTES_URL   = 'https://docs.avaloq.com/abs/Web_Banking_3/Web3_Release_Notes.htm';

// ── Entry point ────────────────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(2));
const mode = args.mode ?? 'local';

(async () => {
  try {
    if (mode === 'local') {
      runLocal();
    } else if (mode === 'download') {
      await runDownload(args);
    } else {
      die(`Unknown mode "${mode}". Use mode=local or mode=download`);
    }
  } catch (err) {
    console.error('\nFatal:', err.message ?? err);
    process.exit(1);
  }
})();

// ══════════════════════════════════════════════════════════════════════════
// LOCAL MODE
// ══════════════════════════════════════════════════════════════════════════

function runLocal() {
  console.log('[local] Scanning', INPUT_DIR, '…');
  if (!fs.existsSync(INPUT_DIR)) die(`Input directory "${INPUT_DIR}" not found`);

  const files = fs.readdirSync(INPUT_DIR)
    .filter(f => f.toLowerCase().endsWith('.xlsx'))
    .sort();

  if (files.length === 0) die(`No .xlsx files found in ${INPUT_DIR}`);

  const entries = [];
  for (const file of files) {
    console.log('  Parsing', file);
    const data = xlsx.parse(path.join(INPUT_DIR, file));
    validateXlsx(data, file);
    entries.push(extract(data));
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  console.log(`\n✓ Wrote ${entries.length} version(s) to ${OUTPUT_FILE}`);
}

// ══════════════════════════════════════════════════════════════════════════
// DOWNLOAD MODE
// ══════════════════════════════════════════════════════════════════════════

async function runDownload(args) {
  console.log('[download] Avaloq release notes downloader');
  console.log('─'.repeat(50));

  const creds      = await resolveCredentials(args);
  const minVersion = await resolveMinVersion(args);

  console.log('');

  // Lazy-require playwright so the local mode never needs it installed
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    die(
      'playwright is not installed. Run:\n' +
      '  npm install\n' +
      '  npx playwright install chromium'
    );
  }

  if (!fs.existsSync(INPUT_DIR)) {
    fs.mkdirSync(INPUT_DIR, { recursive: true });
    console.log(`Created ${INPUT_DIR}`);
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // ── Navigate & authenticate ────────────────────────────────────
    console.log('Connecting to', RELNOTES_URL, '…');
    await page.goto(RELNOTES_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const landed = page.url();
    if (!landed.startsWith('https://docs.avaloq.com/abs/')) {
      console.log('Redirected to login:', landed);
      await performLogin(page, creds);

      // OAuth callback may land us anywhere — navigate back to target
      if (!page.url().includes('Web3_Release_Notes')) {
        console.log('Re-navigating to release notes page…');
        await page.goto(RELNOTES_URL, { waitUntil: 'networkidle', timeout: 30_000 });
      }
    } else {
      console.log('No login redirect — session may already be active.');
    }

    console.log('Page ready:', page.url(), '\n');

    // ── Scrape Excel links ─────────────────────────────────────────
    const links = await scrapeExcelLinks(page);
    if (links.length === 0) {
      console.warn('No Excel links found. Check that #webnotes table is present.');
      console.log('Page title:', await page.title());
      return;
    }

    console.log(`Found ${links.length} Excel link(s) on page:`);
    links.forEach(l => console.log(`  ${(l.version ?? 'unknown').padEnd(14)} ${l.url}`));
    console.log('');

    // ── Filter by minVersion ───────────────────────────────────────
    const toDownload = [];
    for (const link of links) {
      if (!link.version) {
        console.warn(`  ⚠ no version detected, skipping: ${link.url}`);
        continue;
      }
      if (compareVersions(link.version, minVersion) < 0) {
        console.log(`  – ${link.version} < ${minVersion}, skip`);
        continue;
      }
      toDownload.push(link);
    }

    // Deduplicate by URL
    const seen = new Set();
    const unique = toDownload.filter(l => seen.has(l.url) ? false : seen.add(l.url));
    console.log(`\nDownloading ${unique.length} file(s) >= ${minVersion} …\n`);

    // ── Download ───────────────────────────────────────────────────
    const failed = [];
    for (const link of unique) {
      await downloadFile(context, link, failed);
    }

    if (failed.length > 0) {
      fs.writeFileSync(FAILED_FILE, JSON.stringify(failed, null, 2), 'utf-8');
      console.error(`\n⚠  ${failed.length} download(s) failed — see ${FAILED_FILE}`);
      failed.forEach(f => console.error(`   ✗ ${f.version ?? '?'}: ${f.error}`));
    } else {
      console.log('\n✓ All downloads completed successfully.');
    }

  } finally {
    await browser.close();
  }

  // ── Extract newly downloaded files ─────────────────────────────
  console.log('\n' + '─'.repeat(50));
  runLocal();
}

// ══════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ══════════════════════════════════════════════════════════════════════════

async function performLogin(page, creds) {
  // Selector lists cover common OAuth/SSO providers:
  // Okta, Azure AD (loginfmt), Ping, Confluence, Keycloak, generic
  const usernameSelectors = [
    'input[id="okta-signin-username"]',
    'input[name="identifier"]',
    'input[name="loginfmt"]',        // Azure AD
    'input[name="username"]',
    'input[id="username"]',
    'input[name="email"]',
    'input[id="email"]',
    'input[type="email"]',
    'input[name="user"]',
    'input[id="j_username"]',        // Confluence / JIRA
  ];

  let filledUser = false;
  for (const sel of usernameSelectors) {
    try {
      await page.waitForSelector(sel, { state: 'visible', timeout: 3_000 });
      await page.fill(sel, creds.user);
      filledUser = true;
      console.log(`  Username filled [${sel}]`);
      break;
    } catch { /* try next */ }
  }

  if (!filledUser) {
    throw new Error(
      'Cannot find a username input on the login page.\n' +
      '  URL: ' + page.url() + '\n' +
      '  You may need to add a custom selector to performLogin() in main.js.'
    );
  }

  // Multi-step login (e.g. Okta, Azure AD): click Next, then fill password on next screen
  const nextBtn = page.locator('input[type="submit"], button[type="submit"], button[data-se="o-form-input-submit"]').first();
  let usedNextBtn = false;
  try {
    await nextBtn.waitFor({ state: 'visible', timeout: 2_000 });
    const label = (await nextBtn.textContent() ?? '').trim();
    if (/^(next|continue|weiter|suivant|siguiente)$/i.test(label)) {
      await nextBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      usedNextBtn = true;
      console.log(`  Clicked "${label}" for multi-step login`);
    }
  } catch { /* single-page login */ }

  // Fill password (may be on same page or the next page after "Next")
  try {
    await page.waitForSelector('input[type="password"]', { state: 'visible', timeout: 10_000 });
    await page.fill('input[type="password"]', creds.password);
    console.log('  Password filled');
  } catch (e) {
    throw new Error('Cannot find password input. ' + e.message);
  }

  // Submit
  await page.locator('input[type="submit"], button[type="submit"]').first().click();
  console.log('  Submitted login form, waiting for OAuth redirect…');

  await page.waitForLoadState('networkidle', { timeout: 30_000 });

  // Detect obvious errors in post-login URL
  const finalUrl = page.url();
  if (/[?&]error=|\/error\b|login.*failed|access.denied/i.test(finalUrl)) {
    throw new Error(`Login appears to have failed. Final URL: ${finalUrl}`);
  }

  console.log('  ✓ Authentication complete');
}

// ══════════════════════════════════════════════════════════════════════════
// SCRAPING
// ══════════════════════════════════════════════════════════════════════════

async function scrapeExcelLinks(page) {
  return page.evaluate(() => {
    const container = document.getElementById('webnotes');
    if (!container) return [];

    // The table may be a direct child or nested inside the <ul>
    const table = container.querySelector('table');
    if (!table) return [];

    const results = [];
    for (const row of table.querySelectorAll('tr')) {
      // Find an anchor whose visible text is "Excel" (case-insensitive)
      const anchor = Array.from(row.querySelectorAll('a'))
        .find(a => /^excel$/i.test(a.textContent.trim()));
      if (!anchor) continue;

      const url = anchor.href;

      // Primary: extract version from filename
      //   Release_Notes_AFP_R30_2025_4_5.xlsx  →  2025.4.5
      //   Release_Notes_AFP_R30_2025_3_1_1.xlsx →  2025.3.1.1
      const fnMatch = url.match(/R\d+[_-](\d{4}(?:[_-]\d+)+)\.xlsx/i);
      let version = fnMatch ? fnMatch[1].replace(/_/g, '.') : null;

      // Fallback: version from visible row text
      if (!version) {
        const rowText = row.textContent.trim();
        const txtMatch = rowText.match(/\b(\d{4}\.\d+\.\d+(?:\.\d+)?)\b/);
        if (txtMatch) version = txtMatch[1];
      }

      results.push({ url, version });
    }
    return results;
  });
}

// ══════════════════════════════════════════════════════════════════════════
// FILE DOWNLOAD
// ══════════════════════════════════════════════════════════════════════════

async function downloadFile(context, link, failed) {
  const label = String(link.version ?? '?').padEnd(16);
  process.stdout.write(`  ${label} `);

  try {
    const response = await context.request.get(link.url, {
      timeout: 60_000,
      failOnStatusCode: false,
    });
    const status = response.status();

    if (status !== 200) {
      throw new Error(`HTTP ${status} ${response.statusText()}`);
    }

    const body = await response.body();

    // xlsx files are ZIP archives; magic bytes are PK (0x50 0x4B 0x03 0x04)
    if (body.length < 4 || body[0] !== 0x50 || body[1] !== 0x4B) {
      const snippet = body.slice(0, 200).toString('utf-8').replace(/[\r\n]+/g, ' ').slice(0, 80);
      throw new Error(`Response is not a valid xlsx/zip file (got: "${snippet}…")`);
    }

    const filename = decodeURIComponent(path.basename(new URL(link.url).pathname));
    const outPath  = path.join(INPUT_DIR, filename);
    fs.writeFileSync(outPath, body);

    const kb = (body.length / 1024).toFixed(0).padStart(5);
    console.log(`✓ ${kb} KB → ${outPath}`);

  } catch (err) {
    console.log(`✗ FAILED`);
    console.error(`    ${err.message}`);
    failed.push({ version: link.version ?? null, url: link.url, error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// XLSX EXTRACTION (shared between local and download modes)
// ══════════════════════════════════════════════════════════════════════════

function extract(relnoteData) {
  const entry = {};
  entry.version = getVersion(relnoteData);
  relnoteData[0].data.shift(); // row 0: "AFP Web Banking Release Notes X.Y.Z"
  relnoteData[0].data.shift(); // row 1: column headers
  entry.items = relnoteData[0].data.map(extractLine);
  return entry;
}

function extractLine(row) {
  return {
    compo:   row[0],
    ref:     row[1],
    cat:     row[3],
    summary: row[4],
    details: row[5],
    impact:  row[6],
  };
}

function validateXlsx(data, filename) {
  if (data.length !== 1)
    throw new Error(`${filename}: expected 1 worksheet, found ${data.length}`);
}

function getVersion(relnoteData) {
  const cell = relnoteData[0].data[0]?.[0] ?? '';
  return String(cell).replace('AFP Web Banking Release Notes ', '').trim();
}

// ══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════════════════

async function resolveCredentials(args) {
  // Priority: CLI args > credentials file > interactive prompt
  if (args.user && args.password) {
    return { user: args.user, password: args.password };
  }
  if (fs.existsSync(CREDS_FILE)) {
    const p = loadProperties(CREDS_FILE);
    if (p.user && p.password) {
      console.log(`Credentials loaded from ${CREDS_FILE}`);
      return p;
    }
  }
  console.log(`No credentials file (${CREDS_FILE}) found. Please enter:`);
  const user     = await ask('  Username: ');
  const password = await ask('  Password: ');
  return { user, password };
}

async function resolveMinVersion(args) {
  if (args.minVersion) {
    if (!isValidVersion(args.minVersion))
      die(`Invalid minVersion "${args.minVersion}" — expected format e.g. 2025.3.0`);
    return args.minVersion;
  }
  let v = '';
  while (!isValidVersion(v)) {
    if (v !== '') console.error('  Invalid format. Try e.g. 2025.3.0');
    v = await ask('Minimum version to download (e.g. 2025.3.0): ');
  }
  return v;
}

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const i = a.indexOf('=');
    out[i < 0 ? a : a.slice(0, i)] = i < 0 ? true : a.slice(i + 1);
  }
  return out;
}

function loadProperties(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function ask(question) {
  const iface = rl.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => iface.question(question, ans => { iface.close(); resolve(ans.trim()); }));
}

// Parse "2025.3.1.1" → [2025, 3, 1, 1], compare element by element with zero-padding
function parseVersion(v) {
  return String(v).split('.').map(n => parseInt(n, 10) || 0);
}

function compareVersions(a, b) {
  const va = parseVersion(a), vb = parseVersion(b);
  const len = Math.max(va.length, vb.length);
  for (let i = 0; i < len; i++) {
    const d = (va[i] ?? 0) - (vb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function isValidVersion(v) {
  return /^\d+(\.\d+)+$/.test(String(v ?? ''));
}

function die(msg) {
  console.error('\nError:', msg);
  process.exit(1);
}
