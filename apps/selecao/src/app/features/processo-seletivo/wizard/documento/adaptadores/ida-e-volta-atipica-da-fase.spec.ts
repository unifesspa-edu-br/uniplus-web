import {
  TipoDeDecisaoDoDocumento,
  type DocumentoDaConfiguracao,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada } from '../exemplos.testing';
import { edicaoDaEtapa, edicaoDaFase, valoresDaEtapa, valoresDaFase } from './fase.adaptador';

function idaEVolta(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  const fases = (documento.cronograma?.fases ?? []).flatMap((fase) => {
    const valores = valoresDaFase(documento, fase.chave);
    return valores === undefined ? [] : [edicaoDaFase(fase.chave, valores)];
  });
  const etapas = (documento.etapas ?? []).flatMap((etapa) => {
    const valores = valoresDaEtapa(documento, etapa.chave);
    return valores === undefined ? [] : [edicaoDaEtapa(etapa.chave, valores)];
  });
  return [...fases, ...etapas].reduce((atual, edicao) => edicao(atual), documento);
}

function comFase(
  fase: NonNullable<NonNullable<DocumentoDaConfiguracao['cronograma']>['fases']>[number],
): DocumentoDaConfiguracao {
  return { ...documentoSemNada(), cronograma: { fases: [fase] } };
}

function comEtapa(
  etapa: NonNullable<DocumentoDaConfiguracao['etapas']>[number],
): DocumentoDaConfiguracao {
  return { ...documentoSemNada(), etapas: [etapa] };
}

/** Valores que o esquema admite e que a leitura do formulário poderia normalizar sem querer. */
const ATIPICOS: readonly [string, DocumentoDaConfiguracao][] = [
  ['Fase só com a chave', comFase({ chave: 'a' })],
  [
    'Listas vazias na fase',
    comFase({ chave: 'a', produtos: [], bancasRequeridas: [], tiposDeDecisao: [] }),
  ],
  ['Regra de recurso vazia', comFase({ chave: 'a', regraRecurso: {} })],
  [
    'Regra de recurso com espaços, números em notação científica e fração',
    comFase({
      chave: 'a',
      regraRecurso: {
        regraCodigo: ' RECURSO ',
        prazoValor: 1e-7,
        suspensividadePrimeiraInstanciaValor: 0.30000000000000004,
        suspensividadeSegundaInstanciaValor: 1e21,
        procedimentosDeRecurso: [],
      },
    }),
  ],
  [
    'Produtos repetidos e com espaços',
    comFase({
      chave: 'a',
      produtos: [{ atoCodigo: ' EDITAL ' }, { atoCodigo: ' EDITAL ' }, { atoCodigo: '' }],
    }),
  ],
  [
    'Tipos de decisão fora da ordem alfabética',
    comFase({
      chave: 'a',
      tiposDeDecisao: [
        TipoDeDecisaoDoDocumento.HOMOLOGACAO_DAS_INSCRICOES,
        TipoDeDecisaoDoDocumento.CLASSIFICACAO,
      ],
    }),
  ],
  [
    'Bancas de chave repetida, deliberação vazia e categorias repetidas',
    comFase({
      chave: 'a',
      bancasRequeridas: [
        { chave: 'b', regraDeDeliberacao: {}, categoriasDocumentoCodigos: ['A', 'A'] },
        { chave: 'b', tipoBancaCodigo: ' BANCA ', regraDeDeliberacao: { quorum: 1e-7 } },
      ],
    }),
  ],
  [
    'Etapa com recursos sem âncora, vazios e repetidos',
    comEtapa({ chave: 'e', recursos: [{}, {}, { prazoValor: 3 }, { prazoValor: 3 }] }),
  ],
  ['Etapa com listas vazias', comEtapa({ chave: 'e', produtos: [], bancas: [], recursos: [] })],
];

describe('ida e volta da fase e da etapa com valores atípicos que o esquema admite', () => {
  it.each(ATIPICOS)('%s volta idêntico, na mesma ordem das chaves', (_nome, documento) => {
    expect(JSON.stringify(idaEVolta(documento))).toBe(JSON.stringify(documento));
  });
});
