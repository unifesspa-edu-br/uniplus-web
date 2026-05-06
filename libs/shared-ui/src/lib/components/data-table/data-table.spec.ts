import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCursor } from '@uniplus/shared-core';
import { DataTableComponent, DataTableColumn } from './data-table';

describe('DataTableComponent', () => {
  const COLUMNS: DataTableColumn[] = [
    { field: 'id', header: 'ID', sortable: false },
    { field: 'name', header: 'Name', sortable: true },
  ];

  const DATA: Record<string, unknown>[] = [
    { id: '1', name: 'Joe Doe' },
    { id: '2', name: 'Joana Doe' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DataTableComponent] });
  });

  function setup() {
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
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();
    const linhas = fixture.debugElement.queryAll(By.css('tbody tr'));

    expect(linhas.length).toBe(DATA.length);
  });

  it('renderiza o valor de cada célula conforme o field da coluna', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();

    const cells = fixture.debugElement.queryAll(By.css('tbody td'));
    expect(cells[0].nativeElement.textContent.trim()).toBe('1');
    expect(cells[1].nativeElement.textContent.trim()).toBe('Joe Doe');
    expect(cells[2].nativeElement.textContent.trim()).toBe('2');
    expect(cells[3].nativeElement.textContent.trim()).toBe('Joana Doe');
  });

  it('exibe emptyMessage padrão quando colunas e data estão vazios', () => {
    const { fixture, component } = setup();
    fixture.detectChanges();
    const tableCellEl = fixture.debugElement.query(By.css('td')).nativeElement as HTMLTableCellElement;

    expect(component.columns().length).toBe(0);
    expect(component.emptyMessage()).toBe('Nenhum registro encontrado.');
    expect(tableCellEl.textContent.trim()).toBe(component.emptyMessage());
  });

  it('exibe loadingLabel no tbody quando loading=true e data está vazio', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const cell = fixture.debugElement.query(By.css('tbody td')).nativeElement as HTMLTableCellElement;
    expect(cell.textContent?.trim()).toBe('Carregando…');
  });

  it('exibe erro no tbody quando errorMessage está populado e data está vazio', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('errorMessage', 'Falha ao carregar editais.');
    fixture.detectChanges();

    const alertaTbody = fixture.debugElement.query(By.css('tbody [role="alert"]'));
    expect(alertaTbody).toBeTruthy();
    expect(alertaTbody.nativeElement.textContent).toContain('Falha ao carregar editais.');
  });

  it('em erro com data carregado: linhas preservadas + banner de erro fora do tbody + botão "Carregar mais" disponível', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('data', DATA);
    fixture.componentRef.setInput('errorMessage', 'Falha de rede ao paginar.');
    fixture.componentRef.setInput('nextCursor', createCursor('cursor-retry'));
    fixture.detectChanges();

    const linhas = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(linhas.length).toBe(DATA.length);

    const alertasTbody = fixture.debugElement.queryAll(By.css('tbody [role="alert"]'));
    expect(alertasTbody.length).toBe(0);

    const banners = fixture.debugElement.queryAll(By.css('[role="alert"]'));
    expect(banners.length).toBe(1);
    expect(banners[0].nativeElement.textContent).toContain('Falha de rede ao paginar.');

    const botao = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(botao).toBeTruthy();
    expect(botao.disabled).toBe(false);
  });

  it('botão "Carregar mais" só aparece quando nextCursor está populado', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('button'))).toBeNull();

    fixture.componentRef.setInput('nextCursor', createCursor('proximo-cursor'));
    fixture.detectChanges();

    const botao = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(botao.textContent?.trim()).toBe('Carregar mais');
    expect(botao.disabled).toBe(false);
  });

  it('botão "Carregar mais" troca rótulo para loadingLabel e fica disabled durante loading', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('data', DATA);
    fixture.componentRef.setInput('nextCursor', createCursor('proximo-cursor'));
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const botao = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    expect(botao.textContent?.trim()).toBe('Carregando…');
  });

  it('clicar em "Carregar mais" emite output loadNext com o cursor atual', () => {
    const { fixture, component } = setup();
    const cursor = createCursor('cursor-pagina-2');
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('data', DATA);
    fixture.componentRef.setInput('nextCursor', cursor);
    fixture.detectChanges();

    const emit = vi.fn();
    component.loadNext.subscribe(emit);

    const botao = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    botao.click();

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(cursor);
  });

  it('clicar no botão durante loading não emite loadNext (guarda interna)', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('data', DATA);
    fixture.componentRef.setInput('nextCursor', createCursor('cursor-x'));
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const emit = vi.fn();
    component.loadNext.subscribe(emit);

    const botao = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    botao.click();

    expect(emit).not.toHaveBeenCalled();
  });
});
