import {
  AncoraDoRecursoDaEtapa,
  CriterioDaDeliberacao,
  ModoDaDeliberacao,
  PapelDoProduto,
  TipoDeDecisaoDoDocumento,
  UnidadeDoPrazoDoRecurso,
  type DocumentoDaConfiguracao,
} from '@uniplus/shared-data/selecao';

import { umCronogramaCompleto } from './cronograma.testing';

/**
 * O cronograma completo com a fase de inscrição e a etapa da prova detalhadas: produtos, bancas,
 * recurso, decisões e um procedimento de recurso que o passo não edita.
 */
const BASE = umCronogramaCompleto();
const [INSCRICAO, ...DEMAIS_FASES] = BASE.cronograma?.fases ?? [];
const [PROVA, ...DEMAIS_ETAPAS] = BASE.etapas ?? [];

const FASE_COMPLETA: DocumentoDaConfiguracao = {
  ...BASE,
  cronograma: {
    fases: [
      {
        ...INSCRICAO,
        produtos: [
          { atoCodigo: 'EDITAL', papel: PapelDoProduto.DEFINITIVO },
          { atoCodigo: 'EDITAL' },
        ],
        faseConcluinteChave: 'resultado',
        emiteParecerIndividual: false,
        tiposDeDecisao: [
          TipoDeDecisaoDoDocumento.CLASSIFICACAO,
          TipoDeDecisaoDoDocumento.HOMOLOGACAO_DAS_INSCRICOES,
        ],
        bancasRequeridas: [
          {
            chave: 'banca-de-analise',
            tipoBancaCodigo: 'BANCA_ANALISE',
            categoriasDocumentoCodigos: [],
            regraDeDeliberacao: {
              modo: ModoDaDeliberacao.colegiadaComVotacao,
              integrantes: 3,
              criterio: CriterioDaDeliberacao.maioriaSimples,
            },
          },
        ],
        regraRecurso: {
          regraCodigo: 'RECURSO-PADRAO',
          regraVersao: 'v1',
          prazoValor: 2,
          prazoUnidade: UnidadeDoPrazoDoRecurso.diasUteis,
          admiteInstanciaSuperior: true,
          procedimentosDeRecurso: [
            {
              tipoDeDecisao: TipoDeDecisaoDoDocumento.CLASSIFICACAO,
              regra: { codigo: 'PROCEDIMENTO-A', versao: 'v1' },
            },
          ],
        },
      },
      ...DEMAIS_FASES,
    ],
  },
  etapas: [
    {
      ...PROVA,
      bancas: [{ chave: 'banca-da-prova', tipoBancaCodigo: 'BANCA_PROVA' }],
      recursos: [
        {
          ancora: AncoraDoRecursoDaEtapa.atoPublicado,
          prazoValor: 1,
          procedimentosDeRecurso: [],
        },
        { ancora: AncoraDoRecursoDaEtapa.cienciaIndividual, prazoValor: 5 },
      ],
      tiposDeDecisao: [TipoDeDecisaoDoDocumento.CLASSIFICACAO],
    },
    ...DEMAIS_ETAPAS,
  ],
};

export function umaFaseCompleta(): DocumentoDaConfiguracao {
  return structuredClone(FASE_COMPLETA);
}
