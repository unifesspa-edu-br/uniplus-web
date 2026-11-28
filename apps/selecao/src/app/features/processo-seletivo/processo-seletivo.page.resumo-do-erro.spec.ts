import { TestBed } from '@angular/core/testing';
import type { ReferenciaAoSuporte } from '@uniplus/shared-core/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { configurarPagina, montarPagina } from './processo-seletivo.page.testing';

const REFERENCIA: ReferenciaAoSuporte = {
  origem: 'servidor',
  codigoDoErro: 'uniplus.selecao.exemplo',
  identificadorDoPedido: '0af7651916cd43dd8448eb211c80319c',
};

describe('ProcessoSeletivoPage — resumo do erro do passo', () => {
  beforeEach(configurarPagina);
  afterEach(() => TestBed.resetTestingModule());

  function paginaComErro(): HTMLElement {
    const { fixture, store } = montarPagina();
    store.definirErroDoPasso({
      mensagens: ['Recusada.'],
      referencias: [{ passo: 'Passo 4 — Vagas', referencia: REFERENCIA }],
    });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('a região que anuncia o erro cobre só o resumo e a lista, não os passos', () => {
    const tela = paginaComErro();

    const alertas = tela.querySelectorAll('[role="alert"]');
    expect(alertas).toHaveLength(1);
    expect(alertas[0].textContent).toContain('Há 1 erro no formulário');
    expect(alertas[0].textContent).toContain('Recusada.');
    const regioesVivas = [...tela.querySelectorAll('[aria-live]')];
    expect(regioesVivas.some((regiao) => regiao.querySelector('.step-pane'))).toBe(false);
  });

  it('a referência fica fora da região que anuncia o erro, dentro do contêiner de foco', () => {
    const tela = paginaComErro();

    const referencia = tela.querySelector('ui-referencia-ao-suporte') as HTMLElement;
    expect(referencia.textContent).toContain('uniplus.selecao.exemplo');
    expect(referencia.closest('[role="alert"]')).toBeNull();
    expect(referencia.closest('.step-error')).not.toBeNull();
    expect(tela.querySelector('.step-error')?.hasAttribute('role')).toBe(false);
  });
});
