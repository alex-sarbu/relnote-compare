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
  public relNoteSelect1 = new FormControl('');
  public selectedVersions : string[] = [];
  public selectedCompareVersions : string[] = [];
  public selectedRelNotes: any[] = [];

  displayedColumns: string[] = ['version', 'cat', 'ref', 'summary', 'details', 'impact'];

  public constructor() {
    console.log('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    console.log(this.relNotesList);
  }

  ngOnInit(): void {
    console.log('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    console.log(this.relNotesList);
  }

  public updateRelNoteItems($event : any): void {
    console.log($event);
    this.selectedVersions = $event.value;
    this.selectedRelNotes = [];
    for (let relNote of this.relNotesList) {
      if (this.selectedVersions.includes(relNote.version)) {
        relNote.items.forEach((item: any) => {
          this.selectedRelNotes.push({...item, version: relNote.version});
        });
      }
    }
  }

  public compareRelNoteItems($event : any): void {
    console.log($event);
    this.selectedCompareVersions = $event.value;
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
  }

  

}
