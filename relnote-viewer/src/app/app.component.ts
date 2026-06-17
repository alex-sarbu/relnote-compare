import { Component, OnInit, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgStyle } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule, MatRippleModule } from '@angular/material/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';
import relNotes from '../assets/relnotes.json';
import { VersionPickerComponent } from './version-picker/version-picker.component';
import { ReleaseCatalogDialogComponent, RelnoteCatalog } from './release-catalog-dialog/release-catalog-dialog.component';

interface ColumnConfig { label: string; width: number; flexible: boolean; }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule, NgStyle,
    MatInputModule, MatFormFieldModule, MatTableModule,
    MatSelectModule, MatOptionModule, MatRippleModule,
    MatExpansionModule, MatButtonModule, MatIconModule,
    MatToolbarModule, MatDividerModule, MatTooltipModule, MatBadgeModule,
    VersionPickerComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  public relNotesList: any = relNotes;
  public relNotesCompos: string[] = [];
  public filtersOpen = true;

  public selectedCompos: string[] = [];
  public selectedVersions: string[] = [];
  public selectedCompareVersions: string[] = [];

  public allColumns: string[] = ['version', 'compo', 'ref', 'cat', 'summary', 'details', 'impact', 'side'];
  public displayedColumns: string[] = ['version', 'compo', 'ref', 'summary', 'details', 'impact'];

  public readonly columnConfig: { [key: string]: ColumnConfig } = {
    version: { label: 'Version',  width: 145, flexible: false },
    compo:   { label: 'Compo',    width: 155, flexible: false },
    ref:     { label: 'Ref',      width: 110, flexible: false },
    cat:     { label: 'Cat',      width: 95,  flexible: false },
    summary: { label: 'Summary',  width: 280, flexible: true  },
    details: { label: 'Details',  width: 380, flexible: true  },
    impact:  { label: 'Impact',   width: 220, flexible: true  },
    side:    { label: 'Side',     width: 65,  flexible: false },
  };

  public columnWidths: { [key: string]: number } = {};
  public columnFilters: { [key: string]: string } = {};
  public sortColumn = '';
  public sortDirection: 'asc' | 'desc' | '' = '';

  private selectedRelNotes: any[] = [];
  private resizingCol: string | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private catalog: RelnoteCatalog | null = null;

  constructor(private dialog: MatDialog, private http: HttpClient) {}

  ngOnInit(): void {
    this.updateComposForDisplayedRelNotes(this.relNotesList);
    this.http.get<RelnoteCatalog>('/assets/relnote-catalog.json')
      .pipe(catchError(() => of(null)))
      .subscribe(c => this.catalog = c);
  }

  public readonly allVersionStrings: string[] = (this.relNotesList as any[]).map((r: any) => r.version);

  get tableData(): any[] {
    let rows = this.selectedRelNotes;
    for (const [col, val] of Object.entries(this.columnFilters)) {
      if (val) {
        const v = val.toLowerCase();
        rows = rows.filter(row => String(row[col] ?? '').toLowerCase().includes(v));
      }
    }
    if (this.sortColumn && this.sortDirection) {
      const col = this.sortColumn;
      const dir = this.sortDirection === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) =>
        String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * dir
      );
    }
    return rows;
  }

  get activeFilterCount(): number {
    return (this.selectedVersions.length > 0 ? 1 : 0)
      + (this.selectedCompareVersions.length > 0 ? 1 : 0)
      + (this.selectedCompos.length > 0 ? 1 : 0);
  }

  get hasCatalog(): boolean {
    return (this.catalog?.entries?.length ?? 0) > 0;
  }

  openCatalog(): void {
    this.dialog.open(ReleaseCatalogDialogComponent, {
      data: this.catalog ?? { generatedAt: null, source: 'none', entries: [] },
      width: '720px',
      maxHeight: '85vh',
    });
  }

  getColStyle(col: string): { [key: string]: string } {
    const cfg = this.columnConfig[col];
    const w = this.columnWidths[col] ?? cfg.width;
    return cfg.flexible
      ? { flex: `1 1 ${w}px`, 'min-width': `${w}px`, 'max-width': 'none' }
      : { flex: `0 0 ${w}px`, width: `${w}px`, 'min-width': `${w}px`, 'max-width': `${w}px` };
  }

  toggleSort(col: string): void {
    if (this.sortColumn !== col) { this.sortColumn = col; this.sortDirection = 'asc'; }
    else if (this.sortDirection === 'asc') { this.sortDirection = 'desc'; }
    else { this.sortColumn = ''; this.sortDirection = ''; }
  }

  startResize(event: MouseEvent, col: string): void {
    this.resizingCol = col;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.columnWidths[col] ?? this.columnConfig[col].width;
    event.preventDefault();
    event.stopPropagation();
    document.body.classList.add('col-resizing');
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.resizingCol) return;
    const w = Math.max(50, this.resizeStartWidth + (event.clientX - this.resizeStartX));
    this.columnWidths[this.resizingCol] = w;
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.resizingCol = null;
    document.body.classList.remove('col-resizing');
  }

  // Version picker callbacks
  onVersionsChanged(versions: string[]): void {
    this.selectedVersions = versions;
    this.selectedCompareVersions = [];
    this.filterSelectedRelNotes();
  }

  onCompareVersionsChanged(versions: string[]): void {
    this.selectedCompareVersions = versions;
    this.filterSelectedRelNotes();
  }

  // Compo / column actions (still use flat mat-select)
  selectAllCompos(): void   { this.selectedCompos = [...this.relNotesCompos]; this.filterSelectedRelNotes(); }
  clearCompos(): void       { this.selectedCompos = []; this.filterSelectedRelNotes(); }
  updateCompoFilter(_e: any): void { this.filterSelectedRelNotes(); }
  selectAllColumns(): void  { this.displayedColumns = [...this.allColumns]; }
  clearColumns(): void      { this.displayedColumns = []; }
  clearColumnFilter(col: string): void { this.columnFilters[col] = ''; }

  // ── Private filtering / compare logic ──────────────────────────
  private updateComposForDisplayedRelNotes(relNotesList: any[]): void {
    if (relNotesList[0]?.items?.length <= 0) return;
    this.relNotesCompos = [];
    relNotesList.forEach((r: any) => {
      r.items.forEach((i: any) => {
        if (i.compo != null) i.compo.split(',').map((x: string) => x.trim()).forEach((c: string) => {
          if (!this.relNotesCompos.includes(c)) this.relNotesCompos.push(c);
        });
      });
    });
    this.relNotesCompos.sort();
  }

  private updateSelectedRelNotes(): void {
    this.selectedRelNotes = [];
    for (const relNote of this.relNotesList) {
      if (this.selectedVersions.includes(relNote.version)) {
        relNote.items.forEach((item: any) => {
          this.selectedRelNotes.push({ ...item, version: relNote.version });
        });
      }
    }
    this.displayedColumns = this.displayedColumns.filter(e => e !== 'side');
    this.updateComposForDisplayedRelNotes([{ items: this.selectedRelNotes }]);
  }

  private filterSelectedRelNotes(): void {
    this.selectedCompareVersions.length > 0 ? this.compareSelectedRelNotes() : this.updateSelectedRelNotes();
    if (this.selectedRelNotes.length <= 0 || this.selectedCompos.length <= 0) return;
    this.selectedRelNotes = this.selectedRelNotes.filter(i => this.compoFilter(this.selectedCompos, i.compo));
  }

  private compareSelectedRelNotes(): void {
    this.updateSelectedRelNotes();
    let left = this.selectedRelNotes;
    this.selectedRelNotes = [];
    let right: any[] = [];
    for (const relNote of this.relNotesList) {
      if (this.selectedCompareVersions.includes(relNote.version)) {
        relNote.items.forEach((item: any) => right.push({ ...item, version: relNote.version }));
      }
    }
    for (const leftEntry of left) {
      let match = false;
      for (const rightEntry of right) {
        if (!this.compoFilter(this.selectedCompos, rightEntry.compo)) {
          right = right.filter(i => i !== rightEntry); continue;
        }
        if (leftEntry.ref === rightEntry.ref) {
          this.selectedRelNotes.push({ ...leftEntry, version: `${leftEntry.version} + ${rightEntry.version}`, side: '<>' });
          right = right.filter(i => i !== rightEntry);
          match = true;
        }
      }
      if (!match) this.selectedRelNotes.push({ ...leftEntry, side: '<' });
    }
    right.forEach(item => this.selectedRelNotes.push({ ...item, side: '>' }));
    if (!this.displayedColumns.includes('side')) this.displayedColumns.push('side');
  }

  private compoFilter = (compoList: string[], compoString: string) =>
    compoString != null && compoList.some(c => compoString.includes(c));
}
