import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect } from 'vitest';
import { DataTableComponent,DataTableColumn } from './data-table';

describe('DataTableComponent', () => {
  const COLUMNS: DataTableColumn[] = [{
    field: 'id',
    header: 'ID',
    sortable: false
  },
  {
    field: 'name',
    header: 'Name',
    sortable: true
  }];
  const DATA: Record<string, unknown>[] = [
    { id: '1', name: 'Joe Doe' },
    { id: '2', name: 'Joana Doe' }
  ];
  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        imports: [DataTableComponent],
    });
    const fixture: ComponentFixture<DataTableComponent> =
      TestBed.createComponent(DataTableComponent);
    fixture.componentRef.setInput('columns', []);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    return { fixture, component };
  }

  it('inicializa o componente corretamente', () => {
    const { component } = setup();
    expect(component).toBeTruthy();
  });

  it('renderiza a tabela com colunas quando o input columns() está preenchido', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.detectChanges();

    expect(component.columns()).toBeTruthy();
    expect(component.columns().length).toBe(COLUMNS.length);
  });

  it('renderiza a tabela com linhas quando o input data() está preenchido', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();
    const tbodyQuery = fixture.debugElement.query(By.css('tbody'));

    expect(tbodyQuery.children.length).toBe(DATA.length);
  });

  it('renderiza a tabela com linhas quando o input data() está preenchido', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();
    const tbodyQuery = fixture.debugElement.query(By.css('tbody'));

    expect(tbodyQuery.children.length).toBe(DATA.length);
  });

  it('renderiza o valor de cada célula conforme o field da coluna', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();

    const cells = fixture.debugElement.queryAll(By.css('tbody td'));
    expect(cells[0].nativeElement.textContent.trim()).toBe('1');
    expect(cells[1].nativeElement.textContent.trim()).toBe('Joe Doe');
  });

  it('renderiza a tabela com mensagem de vazio quando o input columns() é um array vazio e data é um array vazio (default)', () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    const tableCellEl = fixture.debugElement.query(By.css('td')).nativeElement as HTMLTableCellElement;

    expect(component.columns()).toBeTruthy();
    expect(component.columns().length).toBe(0);
    expect(component.emptyMessage()).toBe('Nenhum registro encontrado.');
    expect(tableCellEl.textContent.trim()).toBe(component.emptyMessage());
  });
});
