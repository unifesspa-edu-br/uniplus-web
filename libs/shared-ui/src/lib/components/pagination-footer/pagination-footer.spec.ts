import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaginationFooterComponent } from './pagination-footer';

describe('PaginationFooterComponent', () => {
  let fixture: ComponentFixture<PaginationFooterComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PaginationFooterComponent] });
    fixture = TestBed.createComponent(PaginationFooterComponent);
  });

  function botao(rel: 'prev' | 'next'): HTMLButtonElement {
    return fixture.debugElement.query(By.css(`[data-pager="${rel}"]`))
      .nativeElement as HTMLButtonElement;
  }
  function seletor(): HTMLSelectElement {
    return fixture.debugElement.query(By.css('[data-testid="pagination-page-size"]'))
      .nativeElement as HTMLSelectElement;
  }
  function faixa(): string {
    return fixture.debugElement.query(By.css('[data-testid="pagination-range"]')).nativeElement
      .textContent as string;
  }

  it('sem registros mantém o layout e desabilita a navegação', () => {
    fixture.detectChanges();
    expect(botao('prev').disabled).toBe(true);
    expect(botao('next').disabled).toBe(true);
    expect(faixa()).toContain('Nenhum registro');
  });

  it('mostra a faixa de registros a partir de pageIndex + pageSize + currentCount', () => {
    fixture.componentRef.setInput('pageSize', 50);
    fixture.componentRef.setInput('pageIndex', 2);
    fixture.componentRef.setInput('currentCount', 30);
    fixture.detectChanges();
    expect(faixa()).toContain('51–80');
  });

  it('habilita Anterior/Próximo conforme hasPrevious/hasNext', () => {
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('hasNext', false);
    fixture.detectChanges();
    expect(botao('prev').disabled).toBe(false);
    expect(botao('next').disabled).toBe(true);
  });

  it('isDisabled trava navegação e seletor durante a recarga', () => {
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('hasNext', true);
    fixture.componentRef.setInput('isDisabled', true);
    fixture.detectChanges();
    expect(botao('prev').disabled).toBe(true);
    expect(botao('next').disabled).toBe(true);
    expect(seletor().disabled).toBe(true);
  });

  it('clicar em Anterior/Próximo emite os outputs', () => {
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('hasNext', true);
    fixture.detectChanges();
    const previous = vi.fn();
    const next = vi.fn();
    fixture.componentInstance.previous.subscribe(previous);
    fixture.componentInstance.next.subscribe(next);
    botao('prev').click();
    botao('next').click();
    expect(previous).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('trocar o seletor emite pageSizeChange com o novo valor', () => {
    fixture.componentRef.setInput('pageSize', 50);
    fixture.detectChanges();
    const onChange = vi.fn();
    fixture.componentInstance.pageSizeChange.subscribe(onChange);

    const select = seletor();
    select.value = '25';
    select.dispatchEvent(new Event('change'));

    expect(onChange).toHaveBeenCalledWith(25);
  });
});
