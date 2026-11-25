import { HttpTestingController } from '@angular/common/http/testing';
import { FundamentoIsencao } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { PagamentoPassoComponent } from './pagamento.component';

import { ROTA_TAXA, montarPagamento, tick } from './pagamento.testing';

describe('PagamentoPassoComponent', () => {
  let componente: PagamentoPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    ({ componente, store, controller } = await montarPagamento());
  });

  afterEach(() => controller.verify());

  it.each([['1e2'], ['0x10'], ['1.00'], ['1,234'], ['R$ 230']])(
    'recusa %j como valor da taxa em vez de convertê-lo',
    (texto) => {
      store.patchObjectSection('pagamento', {
        cobra: true,
        valor: texto,
        fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
      });

      const resultado = componente.validar();

      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.[0]).toContain('1.000,50');
    },
  );

  /**
   * `Number('1.000')` é 1: mil reais viravam um, passavam na validação e eram
   * gravados assim, com a tela seguindo a exibir o que o operador digitou.
   */
  it.each([
    ['1.000', 1000],
    ['1.000,50', 1000.5],
    ['1000,50', 1000.5],
    ['230', 230],
  ])('envia %j como %d', async (texto, esperado) => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: texto,
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });

    const promessa = componente.persistir();
    await tick();

    const req = controller.expectOne(ROTA_TAXA);
    expect(req.request.body.valor).toBe(esperado);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promessa;
  });

  /** Texto que a validação recusa não pode virar comando. */
  it('não envia comando quando o valor não é um valor em reais', async () => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '1e2x',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    controller.verify();
  });

  /** O clique grava; dizer "Próximo" descreveria só a navegação. */
  it('anuncia no botão que o avanço grava', () => {
    expect(componente.rotuloDeAvanco()).toBe('Gravar e avançar');
  });
});
