import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';
import { edicoesPorGravar } from './edicoes-do-enem';
import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import { OrigemCandidatosSelecionada } from '../../processo-seletivo.models';
import { falharPorRede, recusarGravacao } from './recusa-da-gravacao.testing';
import {
  detalheSemClassificacao as detalhe,
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

    function prepararImportadaComEnem(
      origem: OrigemCandidatosSelecionada,
      edicoesEnem: readonly string[] = ['2025', '2026'],
    ): void {
      store.patchObjectSection('identificacao', { origemCandidatos: origem });
      store.patchObjectSection('classificacao', {
        regraCalculoCodigo: 'CLASSIFICACAO_IMPORTADA',
        regraCalculoVersao: '1.0',
        regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
        regraOrdemAlocacaoVersao: '1.0',
        baseadoEmEnem: true,
        edicoesEnem,
      });
    }

    async function aceitarClassificacao(): Promise<void> {
      controller
        .expectOne(ROTA_CLASSIFICACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await aguardarReleitura();
      for (const releitura of controller.match(ROTA_DETALHE)) releitura.flush(detalhe());
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

    const recusa = { title: 'Classificação recusada.', code: 'uniplus.selecao.recusa' };
    const semConteudo = { status: 204, statusText: 'No Content' };
    const INSCRICAO = OrigemCandidatosCodigo.INSCRICAO_PROPRIA;
    const rascunho = (): readonly string[] => store.draft().classificacao.edicoesEnem;
    const gravadas = (): readonly string[] | null => store.classificacao.edicoesGravadas();

    function recusarEdicoes(): void {
      controller.expectOne(ROTA_EDICOES).flush(
        { type: 'about:blank', status: 422, traceId: 't', ...recusa },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    }

    async function persistirRecusada(): Promise<void> {
      const recusada = componente.persistir();
      recusarGravacao(recusa);
      await recusada;
    }

    async function persistirAceitando(): Promise<{ aceita: Promise<unknown>; corpo: string[] }> {
      const aceita = componente.persistir();
      await aceitarClassificacao();
      const edicoes = controller.expectOne(ROTA_EDICOES);
      edicoes.flush(null, semConteudo);
      return {
        aceita,
        corpo: edicoes.request.body.opcoes.map((o: { codigo: string }) => o.codigo),
      };
    }

    describe('classificação não gravada', () => {
      it('recusada, não chama a gravação das edições e o rascunho as mantém', async () => {
        prepararImportadaComEnem(INSCRICAO);

        await persistirRecusada();

        controller.expectNone(ROTA_EDICOES);
        expect(rascunho()).toEqual(['2025', '2026']);
        expect(gravadas()).toEqual([]);
      });

      it('com falha de rede, o rascunho mantém as edições por gravar', async () => {
        prepararImportadaComEnem(INSCRICAO);

        const gravacao = componente.persistir();
        falharPorRede(ROTA_CLASSIFICACAO);
        await aguardarReleitura();
        for (const leitura of controller.match(ROTA_DETALHE)) leitura.flush(detalhe());

        await expect(gravacao).resolves.toMatchObject({ valid: false });
        controller.expectNone(ROTA_EDICOES);
        expect(edicoesPorGravar(store.draft(), gravadas())).toBe(true);
      });
    });

    it('recusa, remoção de uma edição e nova gravação enviam só as que restaram', async () => {
      prepararImportadaComEnem(INSCRICAO, ['2024', '2025', '2026']);
      await persistirRecusada();
      expect(rascunho()).toEqual(['2024', '2025', '2026']);

      store.patchObjectSection('classificacao', { edicoesEnem: ['2024', '2026'] });
      const { aceita, corpo } = await persistirAceitando();

      await expect(aceita).resolves.toEqual({ valid: true });
      expect(corpo).toEqual(['2024', '2026']);
      expect(gravadas()).toEqual(['2024', '2026']);
    });

    it('a resposta tardia de um processo anterior não altera as edições do novo', async () => {
      prepararImportadaComEnem(INSCRICAO);
      const gravacao = componente.persistir();
      await aceitarClassificacao();
      const edicoes = controller.expectOne(ROTA_EDICOES);

      store.geracao.update((valor) => valor + 1);
      edicoes.flush(null, semConteudo);

      await expect(gravacao).resolves.toEqual({ valid: false, messages: [] });
      expect(gravadas()).toEqual([]);
    });

    describe('edições do servidor depois de uma resposta às edições', () => {
      async function persistirComEdicoesFalhando(falha: () => void): Promise<void> {
        prepararImportadaComEnem(INSCRICAO, ['2024', '2025']);
        store.classificacao.edicoesGravadas.set(['2024']);
        const gravacao = componente.persistir();
        await aceitarClassificacao();
        falha();
        await gravacao;
      }

      it('sem resposta conclusiva, o servidor pode ter outra lista e o aviso fica', async () => {
        await persistirComEdicoesFalhando(() => falharPorRede(ROTA_EDICOES));

        store.patchObjectSection('classificacao', { edicoesEnem: ['2024'] });

        expect(gravadas()).toBeNull();
        expect(edicoesPorGravar(store.draft(), gravadas())).toBe(true);
      });

      it('com recusa clara do servidor, mantém a lista que ele tinha', async () => {
        await persistirComEdicoesFalhando(() => recusarEdicoes());

        expect(gravadas()).toEqual(['2024']);
      });
    });

    it('as edições aceitas passam a ser as que o servidor tem', async () => {
      prepararImportadaComEnem(INSCRICAO);

      await (
        await persistirAceitando()
      ).aceita;

      expect(gravadas()).toEqual(['2025', '2026']);
    });

    it('lista vazia não chama a gravação das edições', async () => {
      prepararImportadaComEnem(INSCRICAO, []);

      const gravacao = componente.persistir();
      await aceitarClassificacao();

      await expect(gravacao).resolves.toEqual({ valid: true });
      controller.expectNone(ROTA_EDICOES);
    });

    it('a classificação gravada sem ENEM deixa o servidor sem edições', async () => {
      prepararImportadaComEnem(INSCRICAO);
      store.classificacao.edicoesGravadas.set(['2025', '2026']);
      store.patchObjectSection('classificacao', { baseadoEmEnem: false });

      const gravacao = componente.persistir();
      await aceitarClassificacao();
      await gravacao;

      expect(gravadas()).toEqual([]);
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
