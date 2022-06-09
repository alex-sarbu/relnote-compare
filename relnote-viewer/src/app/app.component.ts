import { Component } from '@angular/core';
import { OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import relNotes from '../assets/relnotes.json'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'relnote-viewer';
  public relNotesList: any = relNotes;
  public relNotesCompos: string[] = [];
  public relNoteSelect1 = new FormControl('');
  public selectedCompos = [];
  public selectedVersions : string[] = [];
  public selectedCompareVersions : string[] = [];
  public selectedRelNotes: any[] = [];

  public allColumns: string[] = ['version', 'compo', 'ref', 'summary', 'details', 'impact', 'side'];
  public displayedColumns: string[] = ['version', 'compo', 'ref', 'summary', 'details', 'impact'];

  public constructor() {
    //console.log(this.relNotesList);
  }

  ngOnInit(): void {
    //console.log(this.relNotesList);
    this.updateComposForDisplayedRelNotes(this.relNotesList);
  }

  public updateRelNoteItems($event : any): void {
    //this.selectedVersions = $event.value;
    this.selectedCompareVersions = [];
    this.filterSelectedRelNotes();
  }

  public compareRelNoteItems($event : any): void {
    //this.selectedCompareVersions = $event.value;
    this.compareSelectedRelNotes();
  }

  public updateCompoFilter($event: any): void {
    //this.selectedCompos = $event.value;
    this.filterSelectedRelNotes();
  }

  private updateComposForDisplayedRelNotes(relNotesList: any[]): void {
    if (relNotesList[0].items.length <= 0) return;
    this.relNotesCompos = [];
    relNotesList.forEach((r: any) => {
      console.log(r);
      r.items.forEach((i: any) => {
        if (i.compo != null) i.compo.split(',').map((x: string) => x.trim()).forEach((c: string) => {
          if (!this.relNotesCompos.includes(c)) this.relNotesCompos.push(c);
        });
      });
    });
    this.relNotesCompos.sort();
    //console.log(this.relNotesCompos);
  }

  private updateSelectedRelNotes(): void {
    //if (this.selectedVersions.length <= 0) return;
    this.selectedRelNotes = [];
    for (let relNote of this.relNotesList) {
      if (this.selectedVersions.includes(relNote.version)) {
        relNote.items.forEach((item: any) => {
          this.selectedRelNotes.push({...item, version: relNote.version});
        });
      }
    }
    this.displayedColumns = this.displayedColumns.filter((e: any) => e != 'side');
    this.updateComposForDisplayedRelNotes([{items: this.selectedRelNotes}]);
  }

  private filterSelectedRelNotes(): void {
    //this.updateSelectedRelNotes();
    this.selectedCompareVersions.length > 0 ? this.compareSelectedRelNotes() : this.updateSelectedRelNotes();
    if (this.selectedRelNotes.length <= 0 || this.selectedCompos.length <= 0) return;
    this.selectedRelNotes = this.selectedRelNotes.filter((i: any) => this.compoFilter(this.selectedCompos, i.compo));
  }

  private compareSelectedRelNotes(): void {
    this.updateSelectedRelNotes()
    let selectedRelNotes = this.selectedRelNotes;
    this.selectedRelNotes = [];
    let selectedCompareRelNotes: any = [];
    for (let relNote of this.relNotesList) {
      if (this.selectedCompareVersions.includes(relNote.version)) {
        relNote.items.forEach((item: any) => {
          selectedCompareRelNotes.push({...item, version: relNote.version});
        });
      }
    }
    for (let leftEntry of selectedRelNotes) {
      let match: boolean = false;
      for (let rightEntry of selectedCompareRelNotes) {
        if (!this.compoFilter(this.selectedCompos, rightEntry.compo)) {
          selectedCompareRelNotes = selectedCompareRelNotes.filter((item: any) => item != rightEntry);
          continue;
        }
        if (leftEntry.ref == rightEntry.ref) {
          this.selectedRelNotes.push({...leftEntry, version: `${leftEntry.version} + ${rightEntry.version}`, side: '<>'});
          selectedCompareRelNotes = selectedCompareRelNotes.filter((item: any) => item != rightEntry);
          match = true;
        }
      }
      if (!match) {
        this.selectedRelNotes.push({...leftEntry, version: `${leftEntry.version}`, side: '<'});
      }
    }
    selectedCompareRelNotes.forEach((item: any) => 
      this.selectedRelNotes.push({...item, version: `${item.version}`, side: '>'})
    );
    if (!this.displayedColumns.includes('side')) this.displayedColumns.push('side');
  }

  private compoFilter = (compoList: string[], compoString: string) => compoString != null && compoList.some(c => compoString.includes(c));

}
