import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AlertaNovaTentativaComponent } from './alerta-nova-tentativa';

describe('AlertaNovaTentativaComponent', () => {
  let fixture: ComponentFixture<AlertaNovaTentativaComponent>;
  let raiz: HTMLElement;

  const regiao = (): HTMLElement => raiz.querySelector('[role="status"]') as HTMLElement;
  const botao = (): HTMLButtonElement => raiz.querySelector('button') as HTMLButtonElement;
  const entrar = (entradas: Record<string, unknown>): void => {
    for (const [nome, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AlertaNovaTentativaComponent] });
    fixture = TestBed.createComponent(AlertaNovaTentativaComponent);
    raiz = fixture.nativeElement as HTMLElement;
    entrar({
      titulo: 'Não foi possível carregar a lista',
      mensagem: 'Falhou.',
      fase: 'inicial',
      idMensagem: 'msg',
    });
  });

  it('primeira falha: só a mensagem, com a região de status já na tela e vazia', () => {
    expect(raiz.querySelector('#msg')?.textContent?.trim()).toBe('Falhou.');
    expect(regiao().textContent?.trim()).toBe('');
  });

  it('mostra e anuncia o mesmo texto a cada fase, no mesmo nó da região', () => {
    const no = regiao();

    entrar({ fase: 'tentando', pendente: true });
    expect(regiao()).toBe(no);
    expect(no.textContent).toBe('Tentando novamente…');

    entrar({ fase: 'repetida', pendente: false });
    expect(regiao()).toBe(no);
    expect(no.textContent).toBe('A nova tentativa também falhou.');
  });

  it('o botão e a situação ficam fora da região viva do aviso, o botão antes da situação', () => {
    const aviso = raiz.querySelector('[role="alert"]') as HTMLElement;
    const [primeiro, segundo] = Array.from(botao().parentElement?.children ?? []);

    expect(aviso.contains(botao())).toBe(false);
    expect(aviso.contains(regiao())).toBe(false);
    expect(aviso.textContent).toContain('Falhou.');
    expect(primeiro).toBe(botao());
    expect(segundo).toBe(regiao());
  });

  it('durante a tentativa: botão ocupado, com o rótulo de sempre e o spinner escondido', () => {
    entrar({ pendente: true });

    expect(botao().getAttribute('aria-disabled')).toBe('true');
    expect(botao().getAttribute('aria-busy')).toBe('true');
    expect(botao().textContent?.trim()).toBe('Tentar novamente');
    expect(botao().querySelector('.spinner')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('fora da tentativa: botão disponível', () => {
    expect(botao().getAttribute('aria-disabled')).toBeNull();
    expect(botao().getAttribute('aria-busy')).toBeNull();
  });

  it('emite o pedido de nova tentativa no clique', () => {
    const tentar = vi.fn();
    fixture.componentInstance.tentar.subscribe(tentar);

    botao().click();

    expect(tentar).toHaveBeenCalledTimes(1);
  });

  it.each([[''], ['   ']])('mensagem %j cai no texto padrão', (mensagem) => {
    entrar({ mensagem });

    expect(raiz.querySelector('#msg')?.textContent?.trim()).toBe('A lista não foi carregada.');
  });
});
