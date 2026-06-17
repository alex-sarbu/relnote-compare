import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { BUILD_TIMESTAMP } from '../build-timestamp';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

export interface CatalogEntry {
  version: string;
  xlsxUrl?: string | null;
  pdfUrl?: string | null;
  releaseDate?: string | null;
  status: 'loaded' | 'skipped' | 'failed' | 'local-only';
}

export interface RelnoteCatalog {
  generatedAt: string | null;
  source: string;
  entries: CatalogEntry[];
}

function cmpVer(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;   // null versions sort last
  if (!b) return -1;
  const va = a.split('.').map(Number), vb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (va[i] ?? 0) - (vb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// AFP release versions are YYYY.Q.P or YYYY.Q.P.H
const VERSION_RE = /^\d{4}\.\d+\.\d+(\.\d+)?$/;

@Component({
  selector: 'app-release-catalog-dialog',
  standalone: true,
  imports: [
    MatDialogModule, MatTableModule, MatButtonModule,
    MatIconModule, MatTooltipModule, MatFormFieldModule,
    MatInputModule, FormsModule,
  ],
  templateUrl: './release-catalog-dialog.component.html',
  styleUrl: './release-catalog-dialog.component.css',
})
export class ReleaseCatalogDialogComponent implements OnInit {
  readonly columns = ['version', 'releaseDate', 'links', 'status'];
  readonly buildTimestamp = BUILD_TIMESTAMP;
  filterText = '';
  allEntries: CatalogEntry[] = [];

  constructor(@Inject(MAT_DIALOG_DATA) public catalog: RelnoteCatalog) {}

  ngOnInit(): void {
    this.allEntries = [...(this.catalog?.entries ?? [])]
      .filter(e => e.version != null && VERSION_RE.test(e.version))
      .sort((a, b) => cmpVer(b.version, a.version));
  }

  get entries(): CatalogEntry[] {
    if (!this.filterText) return this.allEntries;
    const q = this.filterText.toLowerCase();
    return this.allEntries.filter(e =>
      e.version.includes(q) || (e.releaseDate ?? '').includes(q) || e.status.includes(q)
    );
  }

  get generatedAt(): string {
    if (!this.catalog?.generatedAt) return 'unknown';
    return new Date(this.catalog.generatedAt).toLocaleString();
  }

  statusLabel(s: CatalogEntry['status']): string {
    return { loaded: 'Loaded', skipped: 'Skipped', failed: 'Failed', 'local-only': 'Local' }[s] ?? s;
  }
}
