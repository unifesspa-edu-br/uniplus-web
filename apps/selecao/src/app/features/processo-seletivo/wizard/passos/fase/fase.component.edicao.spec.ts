import { describe, expect, it } from 'vitest';
import { CaraterEtapa, UnidadePrazo } from '@uniplus/shared-data/selecao';
import {
  fase,
  ID_BANCA_HETERO,
  ID_CATEGORIA_RACA,
  ID_RECURSOS,
  proximoPasso,
} from './fase.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';

describe('FasePassoComponent: edição da fase no rascunho', () => {
  let componente: ContextoDaFase['componente'];
  let store: ContextoDaFase['store'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let bancas: ContextoDaFase['bancas'];
  let publicacoes: ContextoDaFase['publicacoes'];

  usarFase((tela) => {
    ({ componente, store, detectar, nativo, comCronograma, bancas, publicacoes } = tela);
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
      expect(componente.problemas()).toEqual([]);
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
          procedimentos: [],
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
          tiposDeDecisao: [],
        },
      ],
    });
    detectar();

    componente.formulario()?.controls.emiteParecerIndividual.setValue(true);
    detectar();

    expect(store.draft().cronograma.etapas).toHaveLength(1);
    expect(store.draft().cronograma.etapas[0].nome).toBe('Prova objetiva');
  });
});
