import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DataTableComponent, type UiDataTableColumn } from './data-table';

export const COLUMNS: UiDataTableColumn[] = [
  { field: 'id', header: 'ID', sortable: false },
  { field: 'name', header: 'Name', sortable: true },
];

export const DATA: Record<string, unknown>[] = [
  { id: '1', name: 'Joe Doe' },
  { id: '2', name: 'Joana Doe' },
];

export function montarTabela() {
  const fixture: ComponentFixture<DataTableComponent> = TestBed.createComponent(DataTableComponent);
  fixture.componentRef.setInput('columns', []);
  fixture.detectChanges();
  const component = fixture.componentInstance;
  return { fixture, component };
}
