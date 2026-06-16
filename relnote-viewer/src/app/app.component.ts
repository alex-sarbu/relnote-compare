import { Component, OnInit } from '@angular/core';
import { FormControl, FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import relNotes from '../assets/relnotes.json';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    MatInputModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    MatSelectModule,
    MatOptionModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'relnote-viewer';
  public relNotesList: any = relNotes;
  public relNotesCompos: string[] = [];
  public relNoteSelect1 = new FormControl('');
  public selectedCompos: string[] = [];
  public selectedVersions: string[] = [];
  public selectedCompareVersions: string[] = [];
  public selectedRelNotes: any[] = [];

  public allColumns: string[] = ['version', 'compo', 'ref', 'summary', 'details', 'impact', 'side'];
  public displayedColumns: string[] = ['version', 'compo', 'ref', 'summary', 'details', 'impact'];

  ngOnInit(): void {
    this.updateComposForDisplayedRelNotes(this.relNotesList);
  }

  public updateRelNoteItems(_event: any): void {
    this.selectedCompareVersions = [];
    this.filterSelectedRelNotes();
  }

  public compareRelNoteItems(_event: any): void {
    this.compareSelectedRelNotes();
  }

  public updateCompoFilter(_event: any): void {
    this.filterSelectedRelNotes();
  }

  private updateComposForDisplayedRelNotes(relNotesList: any[]): void {
    if (relNotesList[0].items.length <= 0) return;
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
          this.selectedRelNotes.push({...item, version: relNote.version});
        });
      }
    }
    this.displayedColumns = this.displayedColumns.filter((e: any) => e !== 'side');
    this.updateComposForDisplayedRelNotes([{items: this.selectedRelNotes}]);
  }

  private filterSelectedRelNotes(): void {
    this.selectedCompareVersions.length > 0 ? this.compareSelectedRelNotes() : this.updateSelectedRelNotes();
    if (this.selectedRelNotes.length <= 0 || this.selectedCompos.length <= 0) return;
    this.selectedRelNotes = this.selectedRelNotes.filter((i: any) => this.compoFilter(this.selectedCompos, i.compo));
  }

  private compareSelectedRelNotes(): void {
    this.updateSelectedRelNotes();
    let selectedRelNotes = this.selectedRelNotes;
    this.selectedRelNotes = [];
    let selectedCompareRelNotes: any[] = [];
    for (const relNote of this.relNotesList) {
      if (this.selectedCompareVersions.includes(relNote.version)) {
        relNote.items.forEach((item: any) => {
          selectedCompareRelNotes.push({...item, version: relNote.version});
        });
      }
    }
    for (const leftEntry of selectedRelNotes) {
      let match = false;
      for (const rightEntry of selectedCompareRelNotes) {
        if (!this.compoFilter(this.selectedCompos, rightEntry.compo)) {
          selectedCompareRelNotes = selectedCompareRelNotes.filter((item: any) => item !== rightEntry);
          continue;
        }
        if (leftEntry.ref === rightEntry.ref) {
          this.selectedRelNotes.push({...leftEntry, version: `${leftEntry.version} + ${rightEntry.version}`, side: '<>'});
          selectedCompareRelNotes = selectedCompareRelNotes.filter((item: any) => item !== rightEntry);
          match = true;
        }
      }
      if (!match) {
        this.selectedRelNotes.push({...leftEntry, side: '<'});
      }
    }
    selectedCompareRelNotes.forEach((item: any) =>
      this.selectedRelNotes.push({...item, side: '>'})
    );
    if (!this.displayedColumns.includes('side')) this.displayedColumns.push('side');
  }

  private compoFilter = (compoList: string[], compoString: string) =>
    compoString != null && compoList.some(c => compoString.includes(c));
}
