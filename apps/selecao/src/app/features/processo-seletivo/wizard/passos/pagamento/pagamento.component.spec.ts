import { HttpTestingController } from '@angular/common/http/testing';
import { FundamentoIsencao } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { PagamentoPassoComponent } from './pagamento.component';

import { ROTA_FUNDAMENTOS, montarPagamento, problema } from './pagamento.testing';

describe('PagamentoPassoComponent', () => {
  let componente: PagamentoPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let host: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    ({ componente, store, controller, host, detectar } = await montarPagamento());
  });

  afterEach(() => controller.verify());

  it('sobe a espera dos fundamentos ao relê-los e a derruba junto da falha', () => {
    componente.carregarFundamentos();
    expect(componente.fundamentosCarregando()).toBe(true);
    expect(componente.fundamentosErro()).toBeNull();

    const falha = problema(503, 'uniplus.internal.unexpected', 'Indisponível');
    controller.expectOne(ROTA_FUNDAMENTOS).flush(falha.body, falha.opts);

    expect(componente.fundamentosCarregando()).toBe(false);
    expect(componente.fundamentosErro()).not.toBeNull();
  });

  /** Ausência de declaração não é "não cobra" — a publicação recusa quem não declarou. */
  it('exige a declaração de cobrança', () => {
    expect(componente.validar().valid).toBe(false);
    expect(componente.validar().messages?.[0]).toContain('Declare se o processo cobra');
  });

  it('exige valor positivo quando declara cobrança', () => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '0',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });

    expect(componente.validar().valid).toBe(false);
    expect(componente.validar().messages?.[0]).toContain('maior que zero');
  });

  it('aceita ausência de valor quando o processo é gratuito', () => {
    store.patchObjectSection('pagamento', { cobra: false, valor: '' });

    expect(componente.validar().valid).toBe(true);
  });

  /** UNI-REQ-0099: quem cobra reconhece ao menos um fundamento. */
  it('recusa cobrança sem nenhum fundamento de isenção', () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '150,00', fundamentos: [] });

    const resultado = componente.validar();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain('Selecione ao menos um fundamento de isenção.');
    expect(componente.fundamentosInvalidos()).toBe(true);
  });

  it('aceita cobrança com um fundamento de isenção', () => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '150,00',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });

    expect(componente.validar().valid).toBe(true);
    expect(componente.fundamentosInvalidos()).toBe(false);
  });

  it('apaga a pendência de fundamento assim que o operador seleciona um', () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '150,00', fundamentos: [] });
    componente.validar();
    expect(componente.fundamentosInvalidos()).toBe(true);

    componente.alternarFundamento(FundamentoIsencao.CADASTRO_UNICO);

    expect(componente.fundamentosInvalidos()).toBe(false);
  });

  it('não carrega a pendência de fundamento para outro processo do editor', () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '150,00', fundamentos: [] });
    componente.validar();
    expect(componente.fundamentosInvalidos()).toBe(true);

    // O editor é reusado entre processos: trocar de rascunho não pode levar o
    // vermelho de um para o outro.
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '200,00',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });
    detectar();

    expect(componente.fundamentosInvalidos()).toBe(false);
  });

  it('preserva a pendência enquanto o rascunho segue sem fundamento', () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '150,00', fundamentos: [] });
    componente.validar();

    store.patchObjectSection('pagamento', { valor: '180,00' });
    detectar();

    expect(
      componente.fundamentosInvalidos(),
      'corrigir o valor não corrige o fundamento ausente',
    ).toBe(true);
  });

  it('não acusa fundamento ausente em processo gratuito', () => {
    store.patchObjectSection('pagamento', { cobra: false, valor: '', fundamentos: [] });

    const resultado = componente.validar();

    expect(resultado.valid).toBe(true);
    expect(componente.fundamentosInvalidos()).toBe(false);
  });

  /** Alternar é o único caminho de escrita da lista: marca e desmarca. */
  it('alterna o fundamento sem pedir confirmação nenhuma', () => {
    componente.alternarFundamento(FundamentoIsencao.CADASTRO_UNICO);
    expect(store.draft().pagamento.fundamentos).toEqual(['CADASTRO_UNICO']);

    componente.alternarFundamento(FundamentoIsencao.CADASTRO_UNICO);
    expect(store.draft().pagamento.fundamentos).toEqual([]);
  });

  it('não exibe caixa de confirmação com fundamento selecionado', () => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '150,00',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });
    detectar();

    expect(host.textContent).not.toContain('Confirmo que este processo reconhece');
    expect(host.querySelector('.pagamento-confirmacao')).toBeNull();
  });

  /** Os fundamentos só fazem sentido para processo que cobra. */
  it('oferece os fundamentos que o catálogo devolve, com a descrição', () => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });
    detectar();

    expect(componente.fundamentos()).toHaveLength(3);
    expect(host.textContent).toContain('Carência socioeconômica');
    expect(host.textContent).toContain('Renda até 1,5 salário mínimo');
  });
});
