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

  it('por padrão ambos os botões ficam indisponíveis (sem páginas)', () => {
    fixture.detectChanges();
    expect(botao('prev').getAttribute('aria-disabled')).toBe('true');
    expect(botao('next').getAttribute('aria-disabled')).toBe('true');
  });

  it('disponibiliza Anterior/Próximo conforme hasPrevious/hasNext', () => {
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('hasNext', false);
    fixture.detectChanges();

    expect(botao('prev').getAttribute('aria-disabled')).toBeNull();
    expect(botao('next').getAttribute('aria-disabled')).toBe('true');
  });

  it('isDisabled torna ambos indisponíveis mesmo com páginas disponíveis (recarga)', () => {
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('hasNext', true);
    fixture.componentRef.setInput('isDisabled', true);
    fixture.detectChanges();

    expect(botao('prev').getAttribute('aria-disabled')).toBe('true');
    expect(botao('next').getAttribute('aria-disabled')).toBe('true');
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

  function seletorLimite(): HTMLSelectElement | null {
    const el = fixture.debugElement.query(By.css('[data-pager="page-size"]'));
    return el ? (el.nativeElement as HTMLSelectElement) : null;
  }

  it('sem pageSizeOptions, o rodapé mostra só o texto de status (sem seletor)', () => {
    fixture.componentRef.setInput('statusText', 'Navegação por páginas');
    fixture.detectChanges();

    expect(seletorLimite()).toBeNull();
    expect(
      fixture.debugElement.query(By.css('.pager__status')).nativeElement.textContent,
    ).toContain('Navegação por páginas');
  });

  it('com pageSizeOptions, o texto de status dá lugar ao seletor de itens por página', () => {
    fixture.componentRef.setInput('pageSizeOptions', [10, 25, 50, 100]);
    fixture.componentRef.setInput('pageSize', 25);
    fixture.componentRef.setInput('statusText', 'Navegação por páginas');
    fixture.detectChanges();

    const select = seletorLimite();
    expect(select).not.toBeNull();
    expect(select?.value).toBe('25');
    expect([...(select?.options ?? [])].map((o) => o.value)).toEqual(['10', '25', '50', '100']);
    expect(fixture.nativeElement.textContent).not.toContain('Navegação por páginas');
  });

  it('escolher um valor emite pageSizeChange com o número', () => {
    fixture.componentRef.setInput('pageSizeOptions', [10, 25, 50, 100]);
    fixture.componentRef.setInput('pageSize', 25);
    fixture.detectChanges();

    const emitido: Array<number | null> = [];
    fixture.componentInstance.pageSize.subscribe((v) => emitido.push(v));

    const select = seletorLimite();
    if (!select) throw new Error('seletor ausente');
    select.value = '100';
    select.dispatchEvent(new Event('change'));

    expect(emitido).toEqual([100]);
  });

  it('isDisabled também desabilita o seletor de itens por página', () => {
    fixture.componentRef.setInput('pageSizeOptions', [10, 25, 50, 100]);
    fixture.componentRef.setInput('pageSize', 25);
    fixture.componentRef.setInput('isDisabled', true);
    fixture.detectChanges();

    expect(seletorLimite()?.disabled).toBe(true);
  });

  it('expõe statusText e navigationLabel acessíveis', () => {
    fixture.componentRef.setInput('statusText', 'Página 2');
    fixture.componentRef.setInput('navigationLabel', 'Paginação de unidades');
    fixture.detectChanges();

    const nav = fixture.debugElement.query(By.css('nav')).nativeElement as HTMLElement;
    expect(nav.getAttribute('aria-label')).toBe('Paginação de unidades');
    expect(
      fixture.debugElement.query(By.css('.pager__status')).nativeElement.textContent,
    ).toContain('Página 2');
  });

  it('botão indisponível recusa o clique e mantém o foco', () => {
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('hasNext', true);
    fixture.detectChanges();
    const next = vi.fn();
    fixture.componentInstance.next.subscribe(next);
    document.body.appendChild(fixture.nativeElement);
    const proximo = botao('next');
    proximo.focus();

    fixture.componentRef.setInput('hasNext', false);
    fixture.detectChanges();
    proximo.click();

    expect(document.activeElement).toBe(proximo);
    expect(next).not.toHaveBeenCalled();
    fixture.nativeElement.remove();
  });

  it('isDisabled recusa Anterior e Próximo sem emitir', () => {
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('hasNext', true);
    fixture.componentRef.setInput('isDisabled', true);
    fixture.detectChanges();
    const previous = vi.fn();
    const next = vi.fn();
    fixture.componentInstance.previous.subscribe(previous);
    fixture.componentInstance.next.subscribe(next);

    botao('prev').click();
    botao('next').click();

    expect(previous).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
