import {
  FormaDeComprovacaoDaConfiguracao,
  type DocumentoDaConfiguracao,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { catalogoPorCodigo } from '../catalogos-por-codigo';
import { documentoSemNada } from '../exemplos.testing';
import { edicaoDoPasso, valoresDoFormulario } from './exigencias.adaptador';

function idaEVolta(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  const valores = valoresDoFormulario(documento, { tiposDeDocumento: catalogoPorCodigo([]) });
  return edicaoDoPasso(valores)(documento);
}

function comExigidos(
  documentosExigidos: NonNullable<DocumentoDaConfiguracao['documentosExigidos']>,
): DocumentoDaConfiguracao {
  return { ...documentoSemNada(), documentosExigidos };
}

/** Valores que o esquema admite e que a leitura do formulário poderia normalizar sem querer. */
const ATIPICOS: readonly [string, DocumentoDaConfiguracao][] = [
  ['Seção vazia', comExigidos({})],
  ['Listas vazias', comExigidos({ exigencias: [], regrasDeComprovacao: [] })],
  [
    'Exigência só com a chave',
    comExigidos({ exigencias: [{ chave: 'a' }, { chave: 'a' }, { chave: 'b' }] }),
  ],
  [
    'Exigência com espaços, tamanho em notação científica e base legal vazia',
    comExigidos({
      exigencias: [
        {
          chave: 'a',
          tipoDocumentoCodigo: ' RG ',
          faseChave: ' inscricao ',
          tamanhoMaximoBytes: 1e21,
          basesLegais: [{}, { referencia: '  ', observacao: '' }, { referencia: 'Lei' }],
        },
      ],
    }),
  ],
  [
    'Exigência com gatilho vazio, idade máxima vazia e formatos com lista vazia',
    comExigidos({
      exigencias: [
        {
          chave: 'a',
          condicaoGatilho: [],
          idadeMaximaEmissao: {},
          formatosPermitidos: { lista: [] },
        },
        { chave: 'b', formatosPermitidos: {}, basesLegais: [] },
        { chave: 'c', formatosPermitidos: { lista: [{}, { tamanhoMaximoBytesMax: 1e-7 }] } },
      ],
    }),
  ],
  [
    'Regras de documento e grupo sem itens',
    comExigidos({
      regrasDeComprovacao: [
        {
          forma: FormaDeComprovacaoDaConfiguracao.TODOS_OS_ITENS,
          itens: [
            { forma: FormaDeComprovacaoDaConfiguracao.DOCUMENTO },
            { forma: FormaDeComprovacaoDaConfiguracao.DOCUMENTO },
          ],
        },
        { forma: FormaDeComprovacaoDaConfiguracao.QUANTIDADE_MINIMA_DE_ITENS, itens: [] },
      ],
    }),
  ],
  [
    'Regra com ocorrências repetidas, quantidade em notação científica e bases legais vazias',
    comExigidos({
      regrasDeComprovacao: [
        {
          forma: FormaDeComprovacaoDaConfiguracao.DOCUMENTO,
          exigenciaChave: ' a ',
          quantidadeMinima: 1e21,
          ocorrenciasEsperadas: ['jan', 'jan', ' '],
          basesLegais: [{}],
          grupoDoFormularioParaRepeticao: ' familia ',
        },
      ],
    }),
  ],
];

describe('ida e volta das exigências com valores atípicos que o esquema admite', () => {
  it.each(ATIPICOS)('%s volta idêntico, na mesma ordem das chaves', (_nome, documento) => {
    expect(JSON.stringify(idaEVolta(documento))).toBe(JSON.stringify(documento));
  });
});
