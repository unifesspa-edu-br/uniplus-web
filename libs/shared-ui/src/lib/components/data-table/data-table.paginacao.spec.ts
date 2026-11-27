import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createCursor } from '@uniplus/shared-core/http';
import { DataTableComponent } from './data-table';
import { COLUMNS, DATA, montarTabela } from './data-table.setup';

describe('DataTableComponent com paginação por cursor', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DataTableComponent] });
  });

  it('barra de paginação só aparece quando há cursor (prev ou next)', () => {
    const { fixture } = montarTabela();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('[data-pager]'))).toBeNull();

    fixture.componentRef.setInput('nextCursor', createCursor('proximo-cursor'));
    fixture.detectChanges();

    const proximo = fixture.debugElement.query(By.css('[data-pager="next"]'))
      .nativeElement as HTMLButtonElement;
    const anterior = fixture.debugElement.query(By.css('[data-pager="prev"]'))
      .nativeElement as HTMLButtonElement;
    expect(proximo.textContent?.trim()).toBe('Próximo');
    expect(proximo.getAttribute('aria-disabled')).toBeNull();
    // Primeira página: sem prevCursor, "Anterior" fica indisponível.
    expect(anterior.getAttribute('aria-disabled')).toBe('true');
  });

  it('Anterior habilita quando prevCursor está populado', () => {
    const { fixture } = montarTabela();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
    fixture.componentRef.setInput('prevCursor', createCursor('cursor-anterior'));
    fixture.componentRef.setInput('nextCursor', createCursor('cursor-proximo'));
    fixture.detectChanges();

    const anterior = fixture.debugElement.query(By.css('[data-pager="prev"]'))
      .nativeElement as HTMLButtonElement;
    expect(anterior.getAttribute('aria-disabled')).toBeNull();
  });

  it('botões Anterior/Próximo ficam indisponíveis durante loading', () => {
    const { fixture } = montarTabela();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
    fixture.componentRef.setInput('prevCursor', createCursor('cursor-anterior'));
    fixture.componentRef.setInput('nextCursor', createCursor('cursor-proximo'));
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    const anterior = fixture.debugElement.query(By.css('[data-pager="prev"]'))
      .nativeElement as HTMLButtonElement;
    const proximo = fixture.debugElement.query(By.css('[data-pager="next"]'))
      .nativeElement as HTMLButtonElement;
    expect(anterior.getAttribute('aria-disabled')).toBe('true');
    expect(proximo.getAttribute('aria-disabled')).toBe('true');
  });

  it('clicar em "Próximo" emite output loadNext com o nextCursor', () => {
    const { fixture, component } = montarTabela();
    const cursor = createCursor('cursor-pagina-2');
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
    fixture.componentRef.setInput('nextCursor', cursor);
    fixture.detectChanges();

    const emit = vi.fn();
    component.loadNext.subscribe(emit);

    const proximo = fixture.debugElement.query(By.css('[data-pager="next"]'))
      .nativeElement as HTMLButtonElement;
    proximo.click();

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(cursor);
  });

  it('clicar em "Anterior" emite output loadPrev com o prevCursor', () => {
    const { fixture, component } = montarTabela();
    const cursor = createCursor('cursor-pagina-1');
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
    fixture.componentRef.setInput('prevCursor', cursor);
    fixture.componentRef.setInput('nextCursor', createCursor('cursor-pagina-3'));
    fixture.detectChanges();

    const emit = vi.fn();
    component.loadPrev.subscribe(emit);

    const anterior = fixture.debugElement.query(By.css('[data-pager="prev"]'))
      .nativeElement as HTMLButtonElement;
    anterior.click();

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(cursor);
  });

  it('clicar em "Próximo" durante loading não emite loadNext (botão indisponível)', () => {
    const { fixture, component } = montarTabela();
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('records', DATA);
    fixture.componentRef.setInput('nextCursor', createCursor('cursor-x'));
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();

    const emit = vi.fn();
    component.loadNext.subscribe(emit);

    const proximo = fixture.debugElement.query(By.css('[data-pager="next"]'))
      .nativeElement as HTMLButtonElement;
    proximo.click();

    expect(emit).not.toHaveBeenCalled();
  });
});
