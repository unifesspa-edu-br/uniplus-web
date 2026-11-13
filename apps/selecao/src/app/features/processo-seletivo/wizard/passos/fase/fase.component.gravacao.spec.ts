import { describe, expect, it } from 'vitest';
import { CaraterEtapa, UnidadePrazo } from '@uniplus/shared-data/selecao';
import {
  fase,
  fasesEnviadas,
  ID_AVALIACAO,
  ID_BANCA_HETERO,
  ID_CATEGORIA_RACA,
  ID_CATEGORIA_RENDA,
  ID_RECURSOS,
  PROBLEM_JSON,
  PROCESSO_ID,
  proximoPasso,
  ROTA_FASES,
} from './fase.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';

describe('FasePassoComponent', () => {
  let componente: ContextoDaFase['componente'];
  let store: ContextoDaFase['store'];
  let controller: ContextoDaFase['controller'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let bancas: ContextoDaFase['bancas'];
  let publicacoes: ContextoDaFase['publicacoes'];

  usarFase((tela) => {
    ({ componente, store, controller, detectar, nativo, comCronograma, bancas, publicacoes } =
      tela);
  });

  /**
   * A conclusão do ciclo só existe em fase que publica preliminar, e o seletor
   * que a declara some junto com ele. Deixar o código declarado para trás
   * trancaria o passo numa recusa cujo campo a tela não mostra mais.
   */
  describe('conclusão declarada que perde o preliminar', () => {
    const comConcluinte = () =>
      comCronograma(
        fase({
          produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
          faseConcluinteCodigo: 'RECURSOS',
        }),
        fase({
          faseCanonicaId: ID_RECURSOS,
          codigo: 'RECURSOS',
          ordem: 2,
          produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
        }),
      );

    it('esquece a fase concluinte quando o papel preliminar é trocado', () => {
      comConcluinte();

      publicacoes().escolherPapel(0, 'DEFINITIVO');
      detectar();

      expect(store.draft().cronograma.fases[0].faseConcluinteCodigo).toBeNull();
      expect(componente.validar().valid).toBe(true);
    });

    it('esquece a fase concluinte quando a publicação preliminar é removida', () => {
      comConcluinte();

      publicacoes().removerProduto(0);
      detectar();

      expect(store.draft().cronograma.fases[0].faseConcluinteCodigo).toBeNull();
    });
  });

  /**
   * Fora de rascunho — e enquanto uma gravação corre — o servidor recusa
   * qualquer escrita. Um controle que continua aceitando clique faz a tela
   * passar a descrever uma configuração que o processo não tem.
   */
  it('não aceita trocar a regra de recurso enquanto a edição está suspensa', async () => {
    comCronograma(
      fase({
        produtos: [
          { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
          { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
        ],
        regraRecurso: {
          regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
          regraVersao: 'v1',
          prazoValor: '2',
          prazoUnidade: UnidadePrazo.diasUteis,
          atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
          suspensividadePrimeiraInstanciaValor: '',
          suspensividadePrimeiraInstanciaUnidade: '',
          admiteInstanciaSuperior: true,
          suspensividadeSegundaInstanciaValor: '',
          suspensividadeSegundaInstanciaUnidade: '',
        },
      }),
    );

    store.salvando.set(true);
    detectar();
    await proximoPasso();
    detectar();

    expect(nativo.querySelector<HTMLSelectElement>('#fase-AVALIACAO-regra')?.disabled).toBe(true);
  });

  describe('bancas requeridas', () => {
    it('declara a banca com o recorte de competência que ela julga', () => {
      comCronograma(fase({}));

      bancas().acrescentarBanca();
      bancas().escolherTipoDeBanca(0, ID_BANCA_HETERO);
      bancas().alternarCategoria(0, ID_CATEGORIA_RACA, true);
      detectar();

      expect(store.draft().cronograma.fases[0].bancasRequeridas).toEqual([
        {
          tipoBancaId: ID_BANCA_HETERO,
          categoriasDocumentoIds: [ID_CATEGORIA_RACA],
          regraDeDeliberacao: null,
        },
      ]);
    });

    it('exige recorte na segunda banca do mesmo tipo', () => {
      comCronograma(
        fase({
          bancasRequeridas: [
            {
              tipoBancaId: ID_BANCA_HETERO,
              categoriasDocumentoIds: [ID_CATEGORIA_RACA],
              regraDeDeliberacao: null,
            },
            { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [], regraDeDeliberacao: null },
          ],
        }),
      );

      expect(bancas().recorteObrigatorio(1)).toBe(true);
      expect(componente.erroDoCampo('bancasRequeridas')).toContain(
        'mais de uma banca de Heteroidentificação',
      );
    });
  });

  describe('gravação', () => {
    /**
     * A gravação substitui a coleção inteira. Mexer numa fase precisa reenviar
     * as demais como estão, e a janela e a ordem — que esta superfície não
     * edita — precisam chegar intactas na fase mexida também.
     */
    it('reenvia na gravação as outras fases e o que a superfície não edita', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      comCronograma(
        fase({ produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }] }),
        fase({
          faseCanonicaId: ID_RECURSOS,
          codigo: 'RECURSOS',
          ordem: 2,
          inicio: '2026-04-01T08:00:00-03:00',
          fim: '2026-04-05T18:00:00-03:00',
          produtos: [{ atoCodigo: 'COMUNICADO', papel: null }],
          bancasRequeridas: [
            {
              tipoBancaId: ID_BANCA_HETERO,
              categoriasDocumentoIds: [ID_CATEGORIA_RENDA],
              regraDeDeliberacao: null,
            },
          ],
        }),
      );

      componente.formulario()?.controls.emiteParecerIndividual.setValue(true);
      detectar();

      const gravacao = componente.persistir();
      const enviadas = controller.expectOne(ROTA_FASES);
      const corpo = fasesEnviadas(enviadas.request.body);

      expect(corpo[0]).toMatchObject({
        ordem: 1,
        faseCanonicaId: ID_AVALIACAO,
        inicio: '2026-03-01T08:00:00-03:00',
        fim: '2026-03-10T18:00:00-03:00',
        emiteParecerIndividual: true,
        produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
      });
      expect(corpo[1]).toMatchObject({
        ordem: 2,
        faseCanonicaId: ID_RECURSOS,
        inicio: '2026-04-01T08:00:00-03:00',
        fim: '2026-04-05T18:00:00-03:00',
        produtos: [{ atoCodigo: 'COMUNICADO', papel: null }],
        bancasRequeridas: [
          {
            tipoBancaId: ID_BANCA_HETERO,
            categoriasDocumentoIds: [ID_CATEGORIA_RENDA],
            regraDeDeliberacao: null,
          },
        ],
        emiteParecerIndividual: false,
      });

      enviadas.flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      expect((await gravacao).valid).toBe(true);
    });

    /**
     * As etapas pontuadas são irmãs das fases dentro da mesma seção do
     * rascunho, e não têm tela nesta superfície. Escrever a seção inteira em
     * vez de remendá-la as apagaria — sem erro, sem aviso, e só a gravação do
     * cronograma perceberia, recusando um processo que tinha etapa.
     */
    it('não apaga as etapas pontuadas ao declarar algo na fase', () => {
      store.patchObjectSection('cronograma', {
        fases: [fase({})],
        etapas: [
          {
            id: '01960000-0000-7000-0000-0000000000ee',
            nome: 'Prova objetiva',
            carater: CaraterEtapa.classificatoria,
            tipoEtapaOrigemId: '01960000-0000-7000-0000-0000000000e1',
            peso: '1',
            notaMinima: '',
            ordem: 1,
            faseCodigo: '',
            produtos: [],
            inicio: '',
            fim: '',
            emiteParecerIndividual: false,
            bancas: [],
            recursos: [],
          },
        ],
      });
      detectar();

      componente.formulario()?.controls.emiteParecerIndividual.setValue(true);
      detectar();

      expect(store.draft().cronograma.etapas).toHaveLength(1);
      expect(store.draft().cronograma.etapas[0].nome).toBe('Prova objetiva');
    });

    it('não envia nada quando a conferência da fase acusa', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      comCronograma(
        fase({ produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }] }),
      );

      const resultado = await componente.persistir();

      expect(resultado.valid).toBe(false);
      controller.expectNone(ROTA_FASES);
    });

    /**
     * A recusa precisa de mensagem por campo, não erro genérico do formulário: a
     * recusa do domínio precisa aparecer sob o controle que a provocou.
     */
    it('leva a recusa do domínio para o campo que a provocou', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      comCronograma(fase({ produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }] }));

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_FASES).flush(
        {
          type: 'about:blank',
          title: 'Cronograma recusado',
          status: 422,
          code: 'uniplus.selecao.regra_recurso_fase.prazo_em_dias_corridos',
          traceId: '00000000000000000000000000000001',
          errors: [
            {
              field: 'fases[0].regraRecurso',
              code: 'uniplus.selecao.regra_recurso_fase.prazo_em_dias_corridos',
              message: 'detalhe do servidor',
            },
          ],
        },
        { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
      );
      await proximoPasso();

      const resultado = await gravacao;
      expect(resultado.valid).toBe(false);
      expect(componente.erroDoCampo('recurso.prazo')).toContain('dias corridos não é aceito');
    });
  });
});
