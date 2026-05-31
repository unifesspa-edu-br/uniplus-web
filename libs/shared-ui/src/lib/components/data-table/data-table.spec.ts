import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCursor } from '@uniplus/shared-core/http';
import { DataTableComponent, UiDataTableColumn } from './data-table';

describe('DataTableComponent', () => {
  const COLUMNS: UiDataTableColumn[] = [
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

  it('renderiza a tabela com linhas quando o input records() está preenchido', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
    fixture.detectChanges();
    const linhas = fixture.debugElement.queryAll(By.css('tbody tr'));

    expect(linhas.length).toBe(DATA.length);
  });

  it('renderiza o valor de cada célula conforme o field da coluna', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
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
    const tableCellEl = fixture.debugElement.query(By.css('td'))
      .nativeElement as HTMLTableCellElement;

    expect(component.columns().length).toBe(0);
    expect(component.emptyMessage()).toBe('Nenhum registro encontrado.');
    expect(tableCellEl.textContent.trim()).toBe(component.emptyMessage());
  });

  it('exibe loadingLabel no tbody quando isLoading=true e records está vazio', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    const cell = fixture.debugElement.query(By.css('tbody td'))
      .nativeElement as HTMLTableCellElement;
    expect(cell.textContent?.trim()).toBe('Carregando…');
  });

  it('exibe erro no tbody quando errorMessage está populado e records está vazio', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('isLoading', true);
    fixture.componentRef.setInput('errorMessage', 'Falha ao carregar editais.');
    fixture.detectChanges();

    const alertaTbody = fixture.debugElement.query(By.css('tbody [role="alert"]'));
    expect(alertaTbody).toBeTruthy();
    expect(alertaTbody.nativeElement.textContent).toContain('Falha ao carregar editais.');
  });

  it('em erro com records carregados: linhas preservadas + banner de erro fora do tbody + botão "Carregar mais" disponível', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
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
    fixture.componentRef.setInput('records', DATA);
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
    fixture.componentRef.setInput('records', DATA);
    fixture.componentRef.setInput('nextCursor', createCursor('proximo-cursor'));
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    const botao = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    expect(botao.textContent?.trim()).toBe('Carregando…');
  });

  it('clicar em "Carregar mais" emite output loadNext com o cursor atual', () => {
    const { fixture, component } = setup();
    const cursor = createCursor('cursor-pagina-2');
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
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
    fixture.componentRef.setInput('records', DATA);
    fixture.componentRef.setInput('nextCursor', createCursor('cursor-x'));
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    const emit = vi.fn();
    component.loadNext.subscribe(emit);

    const botao = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    botao.click();

    expect(emit).not.toHaveBeenCalled();
  });

  it('Space na linha clicável emite rowClick e cancela o scroll default do browser', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
    fixture.componentRef.setInput('rowClickable', true);
    fixture.detectChanges();

    const emit = vi.fn();
    component.rowClick.subscribe(emit);

    const linha = fixture.debugElement.queryAll(By.css('tbody tr'))[0];
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', code: 'Space', cancelable: true });
    linha.nativeElement.dispatchEvent(spaceEvent);

    expect(emit).toHaveBeenCalledWith(DATA[0]);
    expect(spaceEvent.defaultPrevented).toBe(true);
  });

  it('rowClickable=true preserva semantica de linha, adiciona tabindex e emite rowClick', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
    fixture.componentRef.setInput('rowClickable', true);
    fixture.detectChanges();

    const linhas = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(linhas.length).toBe(DATA.length);
    expect(linhas[0].nativeElement.getAttribute('role')).toBeNull();
    expect(linhas[0].nativeElement.getAttribute('tabindex')).toBe('0');
    expect(linhas[0].nativeElement.classList).toContain('table-responsive__row--clickable');

    const emit = vi.fn();
    component.rowClick.subscribe(emit);

    linhas[1].nativeElement.click();
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(DATA[1]);
  });

  it('rowClickable=false (default) não ativa role/tabindex e clique na linha não emite rowClick', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
    fixture.detectChanges();

    const linhas = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(linhas[0].nativeElement.getAttribute('role')).toBeNull();
    expect(linhas[0].nativeElement.getAttribute('tabindex')).toBeNull();

    const emit = vi.fn();
    component.rowClick.subscribe(emit);

    linhas[0].nativeElement.click();
    expect(emit).not.toHaveBeenCalled();
  });

  it('aria-busy=true no <table> quando isLoading()', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    const table = fixture.debugElement.query(By.css('table')).nativeElement as HTMLTableElement;
    expect(table.getAttribute('aria-busy')).toBe('true');

    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();
    expect(table.getAttribute('aria-busy')).toBeNull();
  });

  it('estado erro inicial: renderiza botão "Tentar novamente" + emite output retry no clique', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('errorMessage', 'Falha de rede.');
    fixture.detectChanges();

    const retryButton = fixture.debugElement.query(By.css('[data-testid="data-table-retry"]'));
    expect(retryButton).not.toBeNull();
    expect((retryButton.nativeElement as HTMLButtonElement).textContent?.trim()).toBe(
      'Tentar novamente',
    );

    const emit = vi.fn();
    component.retry.subscribe(emit);
    (retryButton.nativeElement as HTMLButtonElement).click();
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('estado erro inicial com errorTraceId: renderiza "Reportar incidente" e exibe o trace', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('errorMessage', 'Falha 500.');
    fixture.componentRef.setInput('errorTraceId', '0123456789abcdef0123456789abcdef');
    fixture.detectChanges();

    const trace = fixture.debugElement.query(By.css('[data-testid="data-table-error-trace"]'));
    expect(trace).not.toBeNull();
    expect(trace.nativeElement.textContent).toContain('Reportar incidente');
    const traceId = fixture.debugElement.query(By.css('[data-testid="data-table-error-trace-id"]'));
    expect((traceId.nativeElement as HTMLElement).textContent).toBe(
      '0123456789abcdef0123456789abcdef',
    );
  });

  it('estado erro inicial sem errorTraceId: não renderiza "Reportar incidente"', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('errorMessage', 'Falha local.');
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('[data-testid="data-table-error-trace"]'))).toBeNull();
  });

  it('errorTraceId="" não habilita link "Reportar incidente" (boundary)', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('errorMessage', 'Falha local.');
    fixture.componentRef.setInput('errorTraceId', '');
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('[data-testid="data-table-error-trace"]'))).toBeNull();
  });

  it('estado erro pós-1ª página: banner exibe botão "Tentar novamente" + emite retry', () => {
    const { fixture, component } = setup();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
    fixture.componentRef.setInput('errorMessage', 'Falha de rede ao paginar.');
    fixture.componentRef.setInput('nextCursor', createCursor('cursor-retry'));
    fixture.detectChanges();

    const banner = fixture.debugElement.query(By.css('[data-testid="data-table-error-banner"]'));
    expect(banner).not.toBeNull();
    const retryButton = fixture.debugElement.query(
      By.css('[data-testid="data-table-retry-banner"]'),
    );
    expect((retryButton.nativeElement as HTMLButtonElement).textContent?.trim()).toBe(
      'Tentar novamente',
    );

    const emit = vi.fn();
    component.retry.subscribe(emit);
    (retryButton.nativeElement as HTMLButtonElement).click();
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
