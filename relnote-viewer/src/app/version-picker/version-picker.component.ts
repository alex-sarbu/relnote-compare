import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ViewChild, ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  CdkOverlayOrigin, CdkConnectedOverlay,
  ConnectedPosition, OverlayModule,
} from '@angular/cdk/overlay';

export interface HotfixNode { version: string; }
export interface PatchNode {
  patchKey: string;
  isReal: boolean;   // false when only hotfixes exist for this base
  hotfixes: HotfixNode[];
  expanded: boolean;
}
export interface VersionGroup {
  groupKey: string;
  patches: PatchNode[];
  expanded: boolean;
}

function cmpVer(a: string, b: string): number {
  const va = a.split('.').map(Number);
  const vb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (va[i] ?? 0) - (vb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

@Component({
  selector: 'app-version-picker',
  standalone: true,
  imports: [
    FormsModule,
    MatCheckboxModule, MatButtonModule, MatIconModule,
    MatDividerModule, MatFormFieldModule, MatInputModule,
    OverlayModule,
  ],
  templateUrl: './version-picker.component.html',
  styleUrl: './version-picker.component.css',
})
export class VersionPickerComponent implements OnChanges {
  @Input() versions: string[] = [];
  @Input() label = 'Versions';
  @Input() selected: string[] = [];
  @Output() selectedChange = new EventEmitter<string[]>();

  @ViewChild('origin', { read: ElementRef }) originEl?: ElementRef;

  isOpen = false;
  groups: VersionGroup[] = [];
  sel = new Set<string>();

  readonly overlayPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top',    overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  panelMinWidth = 280;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['versions']) this.buildGroups();
    if (changes['selected']) this.sel = new Set(this.selected);
  }

  buildGroups(): void {
    // Bucket each version string into its patch slot
    const patchMap = new Map<string, { isReal: boolean; hotfixes: string[] }>();
    for (const v of this.versions) {
      const parts = v.split('.');
      if (parts.length <= 3) {
        if (!patchMap.has(v)) patchMap.set(v, { isReal: true, hotfixes: [] });
        else patchMap.get(v)!.isReal = true;
      } else {
        const pk = parts.slice(0, 3).join('.');
        if (!patchMap.has(pk)) patchMap.set(pk, { isReal: false, hotfixes: [] });
        patchMap.get(pk)!.hotfixes.push(v);
      }
    }

    const groupMap = new Map<string, PatchNode[]>();
    for (const [pk, info] of patchMap) {
      const gk = pk.split('.').slice(0, 2).join('.');
      if (!groupMap.has(gk)) groupMap.set(gk, []);
      groupMap.get(gk)!.push({
        patchKey: pk,
        isReal: info.isReal,
        hotfixes: [...info.hotfixes].sort(cmpVer).map(v => ({ version: v })),
        expanded: false,
      });
    }

    this.groups = [...groupMap.entries()]
      .sort(([a], [b]) => cmpVer(b, a))
      .map(([gk, patches]) => ({
        groupKey: gk,
        patches: [...patches].sort((a, b) => cmpVer(b.patchKey, a.patchKey)),
        expanded: false,
      }));
  }

  // ── Derived versions ────────────────────────────────────────────
  groupVersions(g: VersionGroup): string[] {
    return g.patches.flatMap(p => this.patchVersions(p));
  }
  patchVersions(p: PatchNode): string[] {
    return [
      ...(p.isReal ? [p.patchKey] : []),
      ...p.hotfixes.map(h => h.version),
    ];
  }

  // ── Checkbox states ─────────────────────────────────────────────
  groupAll(g: VersionGroup): boolean { return this.groupVersions(g).every(v => this.sel.has(v)); }
  groupSome(g: VersionGroup): boolean {
    const vv = this.groupVersions(g);
    const n = vv.filter(v => this.sel.has(v)).length;
    return n > 0 && n < vv.length;
  }
  patchAll(p: PatchNode): boolean { return this.patchVersions(p).every(v => this.sel.has(v)); }
  patchSome(p: PatchNode): boolean {
    const vv = this.patchVersions(p);
    const n = vv.filter(v => this.sel.has(v)).length;
    return n > 0 && n < vv.length;
  }
  has(v: string): boolean { return this.sel.has(v); }

  // ── Toggles ─────────────────────────────────────────────────────
  toggleGroup(g: VersionGroup, on: boolean): void {
    this.groupVersions(g).forEach(v => on ? this.sel.add(v) : this.sel.delete(v));
    this.emit();
  }
  togglePatch(p: PatchNode, on: boolean): void {
    this.patchVersions(p).forEach(v => on ? this.sel.add(v) : this.sel.delete(v));
    this.emit();
  }
  toggleLeaf(v: string, on: boolean): void {
    on ? this.sel.add(v) : this.sel.delete(v);
    this.emit();
  }
  selectAll(): void { this.versions.forEach(v => this.sel.add(v)); this.emit(); }
  clearAll(): void  { this.sel.clear(); this.emit(); }

  private emit(): void {
    this.selected = [...this.sel];
    this.selectedChange.emit(this.selected);
  }

  // ── Display ─────────────────────────────────────────────────────
  get displayValue(): string {
    const total = this.versions.length;
    const n = this.sel.size;
    if (n === 0)     return 'None';
    if (n === total) return 'All';
    // Summarise by fully-selected groups
    const fullGroups = this.groups
      .filter(g => this.groupAll(g))
      .map(g => g.groupKey);
    if (fullGroups.length > 0 && fullGroups.length <= 3) return fullGroups.join(', ');
    return `${n} selected`;
  }

  toggle(): void {
    if (!this.isOpen) this.panelMinWidth = this.originEl?.nativeElement?.offsetWidth ?? 280;
    this.isOpen = !this.isOpen;
  }
  close(): void  { this.isOpen = false; }
}
