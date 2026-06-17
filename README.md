# relnote-compare

Two tools in one repo:

| Tool | Location | Purpose |
|---|---|---|
| **CLI extractor** | `main.js` (root) | Fetches and/or parses AFP Web Banking release note `.xlsx` files into a single `relnotes.json` |
| **Viewer app** | `relnote-viewer/` | Angular web app for browsing, filtering and comparing versions |

---

## CLI - `main.js`

### Prerequisites

```
npm install
```

The `download` mode requires a Chromium browser (one-time setup):

```
npm run install:browsers
# equivalent: npx playwright install chromium
```

### Modes

Run without arguments to be prompted for the mode:

```
node main.js
```

Or pass `mode` explicitly:

```
node main.js mode=local
node main.js mode=download
```

npm shortcuts:

```
npm run extract    # mode=local
npm run download   # mode=download
```

---

### `mode=local` - parse xlsx files from disk

1. Place all `.xlsx` release-note files in `input/`
2. Run `node main.js mode=local`
3. Output is written to `relnote-viewer/src/assets/relnotes.json`

Files are processed in alphabetical order. Every `.xlsx` must contain exactly one worksheet whose first cell matches the pattern `AFP Web Banking Release Notes X.Y.Z`.

---

### `mode=download` - fetch files from docs.avaloq.com

Downloads release-note Excel files directly from
`https://docs.avaloq.com/abs/Web_Banking_3/Web3_Release_Notes.htm`,
then runs the local extraction automatically.

#### Authentication

The site requires login. Credentials are resolved in this order:

| Source | Format |
|---|---|
| CLI arguments | `user=alice password=secret` |
| `credentials.properties` (root folder) | `user=alice`<br>`password=secret` |
| Interactive prompt | entered at runtime |

`credentials.properties` is listed in `.gitignore` and will never be committed.

#### Minimum version

Only versions **>= minVersion** are downloaded. The value is resolved as follows:

| Source | Example |
|---|---|
| CLI argument | `minVersion=2025.3.0` |
| `input/last-min-version.txt` (shown as default) | press Enter to reuse |
| Interactive prompt | entered at runtime |

The chosen value is automatically saved to `input/last-min-version.txt` so the next run pre-fills it.

Version numbers follow a `YEAR.QUARTER.PATCH` scheme. Hotfix releases add a fourth segment (e.g. `2025.3.1.1`). Comparison is numeric segment-by-segment:

```
2025.3.0 < 2025.3.1 < 2025.3.1.1 < 2025.4.0 < 2026.1.0
```

#### Full example

```
node main.js mode=download minVersion=2025.3.0
```

Credentials are loaded from `credentials.properties`; min-version is taken from the CLI arg and saved for next time.

#### Error handling

- **Broken or non-xlsx links** are reported to stdout and written to `input/failed-downloads.json` (gitignored). Each entry records the version, URL and error message.
- After all downloads finish (including partial failures) the local extraction runs automatically.

---

## Viewer app - `relnote-viewer/`

```
cd relnote-viewer
npm install
npm start          # dev server at http://localhost:4200
npm run build      # production build -> dist/relnote-viewer/
```

See the viewer's own source for feature details (version/component filtering, side-by-side comparison, sortable/resizable columns).

---

## Anonymising the output

To replace free-text fields with fake sentences before sharing:

Requires [jsonymize](https://github.com/cameronhunter/jsonymize).

```
cd relnote-viewer/src/assets
cat relnotes.json | jsonymize -c ../../../jsonymize.config.json > relnotes.json.tmp
mv relnotes.json.tmp relnotes.json
```

Fields anonymised: `summary`, `details`, `impact`.
