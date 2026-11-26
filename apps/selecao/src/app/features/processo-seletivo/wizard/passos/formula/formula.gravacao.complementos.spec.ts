import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  PROCESSO_ID,
  ROTA_CLASSIFICACAO,
  ROTA_DETALHE,
  aguardarReleitura,
  controller,
  montarEliminacao,
  prepararClassificacaoLocal,
  store,
} from '../eliminacao/eliminacao.testing';
import type { FormulaPassoComponent } from './formula.component';
import { montarFormulaNoEditorDaEliminacao } from './formula.gravacao.testing';

const CRITERIO_POR_AREA = {
  regraCodigo: 'DESEMPATE_MAIOR_NOTA_AREA_ENEM',
  regraVersao: '1',
  etapaRef: '',
  idadeMinima: '',
  fato: '',
  operador: '',
  valor: '',
  areas: ['REDACAO'],
};

describe('Fórmula e precisão — o que acompanha a gravação', () => {
  montarEliminacao();
  let formula: FormulaPassoComponent;

  beforeEach(() => {
    formula = montarFormulaNoEditorDaEliminacao().formula;
  });

  describe('edições do ENEM', () => {
    const ROTA_EDICOES = `${ROTA_DETALHE}/fatos/EDICAO_ENEM/opcoes`;

    it('grava as edições escolhidas logo depois de a classificação ser aceita', async () => {
      store.patchObjectSection('identificacao', {
        origemCandidatos: OrigemCandidatosCodigo.INSCRICAO_PROPRIA,
      });
      store.patchObjectSection('classificacao', {
        regraCalculoCodigo: 'CLASSIFICACAO_IMPORTADA',
        regraCalculoVersao: '1.0',
        regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
        regraOrdemAlocacaoVersao: '1.0',
        baseadoEmEnem: true,
        edicoesEnem: ['2025'],
      });

      const gravacao = formula.persistir();
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      for (const releitura of controller.match(ROTA_DETALHE)) releitura.flush({ id: PROCESSO_ID });
      const edicoes = controller.expectOne(ROTA_EDICOES);
      edicoes.flush(null, { status: 204, statusText: 'No Content' });

      expect(edicoes.request.body).toEqual({ opcoes: [{ codigo: '2025', rotulo: 'ENEM 2025' }] });
      await expect(gravacao).resolves.toEqual({ valid: true });
    });
  });

  describe('confirmação da gravação', () => {
    it('sem regra de eliminação, diz que a classificação segue sem regra', () => {
      prepararClassificacaoLocal();

      const itens = formula.confirmacaoDeGravacao()?.itens ?? [];

      expect(itens).toContainEqual({ rotulo: 'Regras de eliminação', valor: 'nenhuma' });
    });

    it('avisa que classificação, precisão e eliminação são gravadas juntas', () => {
      prepararClassificacaoLocal();

      expect(formula.confirmacaoDeGravacao()?.aviso).toContain(
        'A classificação, a precisão e a eliminação serão gravadas juntas',
      );
    });

    it('não pede confirmação quando o passo não valida', () => {
      expect(formula.confirmacaoDeGravacao()).toBeNull();
    });

    it('não pede confirmação de uma gravação que já se sabe recusada pelo desempate gravado', () => {
      prepararClassificacaoLocal();
      store.classificacao.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);

      expect(formula.confirmacaoDeGravacao()).toBeNull();
    });

    it('a gravação recusada pelo desempate gravado não chama a API', async () => {
      prepararClassificacaoLocal();
      store.classificacao.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);

      const resultado = await formula.persistir();

      expect(resultado.valid).toBe(false);
      controller.expectNone(ROTA_CLASSIFICACAO);
    });
  });
});
