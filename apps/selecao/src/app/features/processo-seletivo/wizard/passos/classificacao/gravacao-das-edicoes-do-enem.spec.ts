import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';
import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import { OrigemCandidatosSelecionada } from '../../processo-seletivo.models';
import {
  PROCESSO_ID,
  ROTA_CLASSIFICACAO,
  ROTA_DETALHE,
  aguardarReleitura,
  componente,
  controller,
  montarEliminacao,
  store,
} from '../eliminacao/eliminacao.testing';

describe('gravação da classificação', () => {
  montarEliminacao();

  describe('edições do ENEM aceitas', () => {
    const ROTA_EDICOES = `${ROTA_DETALHE}/fatos/EDICAO_ENEM/opcoes`;

    function prepararImportadaComEnem(origem: OrigemCandidatosSelecionada): void {
      store.patchObjectSection('identificacao', { origemCandidatos: origem });
      store.patchObjectSection('classificacao', {
        regraCalculoCodigo: 'CLASSIFICACAO_IMPORTADA',
        regraCalculoVersao: '1.0',
        regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
        regraOrdemAlocacaoVersao: '1.0',
        baseadoEmEnem: true,
        edicoesEnem: ['2025', '2026'],
      });
    }

    async function aceitarClassificacao(): Promise<void> {
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      for (const releitura of controller.match(ROTA_DETALHE)) releitura.flush({ id: PROCESSO_ID });
    }

    it('grava as edições depois da classificação aceita, na ordem que o candidato vê', async () => {
      prepararImportadaComEnem(OrigemCandidatosCodigo.INSCRICAO_PROPRIA);

      const gravacao = componente.persistir();
      await aceitarClassificacao();
      const edicoes = controller.expectOne(ROTA_EDICOES);
      expect(edicoes.request.method).toBe('PUT');
      expect(edicoes.request.body).toEqual({
        opcoes: [
          { codigo: '2025', rotulo: 'ENEM 2025' },
          { codigo: '2026', rotulo: 'ENEM 2026' },
        ],
      });
      edicoes.flush(null, { status: 204, statusText: 'No Content' });

      await expect(gravacao).resolves.toEqual({ valid: true });
    });

    it('a recusa do servidor às edições volta o passo inválido e fica guardada para o passo Fórmula', async () => {
      prepararImportadaComEnem(OrigemCandidatosCodigo.INSCRICAO_PROPRIA);

      const gravacao = componente.persistir();
      await aceitarClassificacao();
      controller.expectOne(ROTA_EDICOES).flush(
        {
          type: 'about:blank',
          title: 'Edição recusada.',
          detail: 'A edição informada não é aceita.',
          status: 422,
          code: 'uniplus.selecao.opcao_declarada_fato.edicao_enem_fora_de_processo_enem',
          traceId: 't',
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );

      await expect(gravacao).resolves.toEqual({
        valid: false,
        messages: [
          `Edições do ENEM, no passo ${NOME_DO_PASSO_DA_FORMULA}: A edição informada não é aceita.`,
        ],
      });
      expect(store.classificacao.recusaDasEdicoesDoEnem()).toBe('A edição informada não é aceita.');
    });

    it('não grava edições no processo que só importa o resultado', async () => {
      prepararImportadaComEnem(OrigemCandidatosCodigo.IMPORTACAO_EXTERNA);

      const gravacao = componente.persistir();
      await aceitarClassificacao();

      await expect(gravacao).resolves.toEqual({ valid: true });
      controller.expectNone(ROTA_EDICOES);
    });
  });
});
