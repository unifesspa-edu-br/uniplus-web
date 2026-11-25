import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { HttpTestingController } from '@angular/common/http/testing';
import { FundamentoIsencao } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

import { montarPagamento, tick } from './pagamento.testing';

describe('PagamentoPassoComponent', () => {
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let host: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    ({ store, controller, host, detectar } = await montarPagamento());
  });

  afterEach(() => controller.verify());

  it('em consulta, mostra cobrança, valor e fundamentos como texto', async () => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '1230,5',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO, FundamentoIsencao.DOACAO_MEDULA_OSSEA],
    });
    store.remoteSnapshot.set({
      situacao: {
        codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
        rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
      },
    } as never);
    detectar();
    await tick();
    detectar();

    expect(host.querySelector('input, select, textarea')).toBeNull();
    const pares = Array.from(host.querySelectorAll('dl')).map((dl) => [
      dl.querySelector('dt')?.textContent?.trim(),
      dl.querySelector('dd')?.textContent?.trim(),
    ]);
    expect(pares).toEqual([
      ['Cobrança da taxa de inscrição', 'Este processo cobra taxa'],
      ['Valor da taxa', 'R$ 1.230,50'],
    ]);
    const fundamentos = host.querySelector('[aria-labelledby="f-fundamentos-titulo"]');
    expect(
      Array.from(fundamentos?.querySelectorAll('li') ?? [], (li) => li.textContent?.trim()),
    ).toEqual(['Cadastro Único', 'Doação de medula óssea']);
  });

  it('em consulta, diz que o processo é gratuito e não mostra valor nem fundamentos', async () => {
    store.patchObjectSection('pagamento', { cobra: false, valor: '', fundamentos: [] });
    store.remoteSnapshot.set({
      situacao: {
        codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
        rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
      },
    } as never);
    detectar();
    await tick();
    detectar();

    expect(host.querySelector('dd')?.textContent?.trim()).toBe('Este processo é gratuito');
    expect(host.querySelectorAll('dl')).toHaveLength(1);
    expect(host.querySelector('#f-fundamentos-titulo')).toBeNull();
  });

  /**
   * Formas que `Number` converteria em outro número — `1e2` em 100, `0x10` em
   * 16 — ou em que separador de milhar e decimal se confundem. Nenhuma pode
   * virar valor em silêncio.
   */
});
