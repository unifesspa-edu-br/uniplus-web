import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NovaTentativaDoCampoComponent } from './nova-tentativa-do-campo';

describe('NovaTentativaDoCampoComponent', () => {
  let fixture: ComponentFixture<NovaTentativaDoCampoComponent>;
  let raiz: HTMLElement;
  const tentar = vi.fn();

  const botao = (): HTMLButtonElement => raiz.querySelector('button') as HTMLButtonElement;
  const entrar = (entradas: Record<string, unknown>): void => {
    for (const [nome, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  };

  beforeEach(() => {
    tentar.mockReset();
    fixture = TestBed.createComponent(NovaTentativaDoCampoComponent);
    fixture.componentInstance.tentar.subscribe(tentar);
    raiz = fixture.nativeElement as HTMLElement;
    entrar({ fase: 'inicial', assunto: 'campi' });
  });

  it('o botão vem antes da situação, que já está na tela e vazia', () => {
    const [primeiro, segundo] = Array.from(raiz.children);

    expect(primeiro.tagName).toBe('BUTTON');
    expect(segundo.getAttribute('role')).toBe('status');
    expect(segundo.textContent?.trim()).toBe('');
  });

  it('pede a nova tentativa no clique', () => {
    botao().click();

    expect(tentar).toHaveBeenCalledOnce();
  });

  it('em curso: ocupado e indisponível, e o clique não pede de novo', () => {
    entrar({ pendente: true, fase: 'tentando' });
    botao().click();

    expect(botao().getAttribute('aria-busy')).toBe('true');
    expect(botao().getAttribute('aria-disabled')).toBe('true');
    expect(raiz.querySelector('[role="status"]')?.textContent).toBe('Recarregando campi…');
    expect(tentar).not.toHaveBeenCalled();
  });

  it('indisponível por outro motivo: aria-disabled sem ocupado, e o clique não pede', () => {
    entrar({ indisponivel: true });
    botao().click();

    expect(botao().getAttribute('aria-disabled')).toBe('true');
    expect(botao().getAttribute('aria-busy')).toBeNull();
    expect(tentar).not.toHaveBeenCalled();
  });
});
