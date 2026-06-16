import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PagerComponent } from './pager';

describe('PagerComponent (Anterior / Próximo)', () => {
  let fixture: ComponentFixture<PagerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PagerComponent] });
    fixture = TestBed.createComponent(PagerComponent);
  });

  function botao(rel: 'prev' | 'next'): HTMLButtonElement {
    return fixture.debugElement.query(By.css(`[data-pager="${rel}"]`))
      .nativeElement as HTMLButtonElement;
  }

  it('por padrão ambos os botões ficam desabilitados (sem páginas)', () => {
    fixture.detectChanges();
    expect(botao('prev').disabled).toBe(true);
    expect(botao('next').disabled).toBe(true);
  });

  it('habilita Anterior/Próximo conforme hasPrevious/hasNext', () => {
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('hasNext', false);
    fixture.detectChanges();

    expect(botao('prev').disabled).toBe(false);
    expect(botao('next').disabled).toBe(true);
  });

  it('isDisabled desabilita ambos mesmo com páginas disponíveis (recarga)', () => {
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('hasNext', true);
    fixture.componentRef.setInput('isDisabled', true);
    fixture.detectChanges();

    expect(botao('prev').disabled).toBe(true);
    expect(botao('next').disabled).toBe(true);
  });

  it('clicar em Anterior/Próximo emite os outputs correspondentes', () => {
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

  it('expõe statusText e navigationLabel acessíveis', () => {
    fixture.componentRef.setInput('statusText', 'Página 2');
    fixture.componentRef.setInput('navigationLabel', 'Paginação de unidades');
    fixture.detectChanges();

    const nav = fixture.debugElement.query(By.css('nav')).nativeElement as HTMLElement;
    expect(nav.getAttribute('aria-label')).toBe('Paginação de unidades');
    expect(fixture.debugElement.query(By.css('.pager__status')).nativeElement.textContent).toContain(
      'Página 2',
    );
  });
});
