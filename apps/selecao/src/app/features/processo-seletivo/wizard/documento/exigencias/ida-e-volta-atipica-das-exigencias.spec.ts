import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { comDocumentosExigidos, idaEVolta } from './exigencias.testing';

const BASE = {
  chave: 'exigencia_rg',
  tipoDocumentoCodigo: 'RG',
  faseChave: 'fase_inscricao',
  obrigatorio: true,
  abrePrazoParaReenvio: false,
};

function comExigencia(campos: Record<string, unknown>): DocumentoDaConfiguracao {
  return comDocumentosExigidos({
    exigencias: [{ ...BASE, ...campos }],
    regrasDeComprovacao: [{ forma: 'DOCUMENTO', exigenciaChave: 'exigencia_rg' }],
  });
}

function comRegra(regra: Record<string, unknown>): DocumentoDaConfiguracao {
  return comDocumentosExigidos({ exigencias: [BASE], regrasDeComprovacao: [regra] });
}

const CONDICAO = { codigoDoDado: 'ESTADO', operador: 'IGUAL' };

/** Valores que o esquema admite e que a conversão poderia normalizar sem querer. */
const ATIPICOS: readonly [string, DocumentoDaConfiguracao][] = [
  [
    'Listas vazias nas exigências',
    comExigencia({ condicoes: [], basesLegais: [], dadosComprovados: [] }),
  ],
  ['Alternativa de condições vazia', comExigencia({ condicoes: [[]] })],
  [
    'Alternativas com cláusula vazia no meio',
    comExigencia({
      condicoes: [[{ ...CONDICAO, valor: 'PA' }], [], [{ ...CONDICAO, valor: 'MA' }]],
    }),
  ],
  [
    'Valor de condição com número inteiro e decimal',
    comExigencia({
      condicoes: [
        [
          { ...CONDICAO, valor: 2 },
          { ...CONDICAO, valor: 0.5 },
        ],
      ],
    }),
  ],
  [
    'Valor de condição booleano falso',
    comExigencia({ condicoes: [[{ ...CONDICAO, valor: false }]] }),
  ],
  [
    'Valor de condição texto com espaços e lista vazia',
    comExigencia({
      condicoes: [
        [{ ...CONDICAO, valor: ' PA ' }],
        [{ ...CONDICAO, operador: 'ALGUM_DE', valor: [] }],
      ],
    }),
  ],
  [
    'Valor de condição texto com forma de número',
    comExigencia({ condicoes: [[{ ...CONDICAO, valor: '5' }]] }),
  ],
  [
    'Base legal sem observação e com observação em branco',
    comExigencia({
      basesLegais: [
        { referencia: 'Lei 1', abrangencia: 'FEDERAL', situacao: 'RESOLVIDO' },
        { referencia: 'Lei 2', abrangencia: 'FEDERAL', situacao: 'RESOLVIDO', observacao: '  ' },
      ],
    }),
  ],
  ['Prazo e validade vazios', comExigencia({ prazoDeEmissao: {}, validade: {} })],
  [
    'Formatos com qualquer falso e lista vazia',
    comExigencia({ formatosPermitidos: { qualquer: false, lista: [] } }),
  ],
  [
    'Formatos qualquer com lista',
    comExigencia({ formatosPermitidos: { qualquer: true, lista: [{ formato: 'PNG' }] } }),
  ],
  [
    'Modelo sem o resumo do arquivo',
    comExigencia({ modeloId: '0196b3c2-8a10-7c3e-b5d2-6f1e4a9c2d73' }),
  ],
  [
    'Referência de fase que o cronograma não tem',
    comExigencia({
      validade: { escolha: 'EXIGE_DOCUMENTO_VALIDO', referencia: { faseChave: 'fase_sumida' } },
    }),
  ],
  ['Grupo sem itens', comRegra({ forma: 'TODOS_OS_ITENS' })],
  ['Grupo com lista de itens vazia', comRegra({ forma: 'TODOS_OS_ITENS', itens: [] })],
  [
    'Grupo com itens que citam exigência inexistente',
    comRegra({
      forma: 'TODOS_OS_ITENS',
      itens: [{ forma: 'DOCUMENTO', exigenciaChave: 'exigencia_sumida' }],
    }),
  ],
  [
    'Regra com listas vazias',
    comRegra({
      forma: 'DOCUMENTO',
      exigenciaChave: 'exigencia_rg',
      basesLegais: [],
      ocorrenciasEsperadas: [],
    }),
  ],
  [
    'Regra com quantidade zero',
    comRegra({ forma: 'DOCUMENTO', exigenciaChave: 'exigencia_rg', quantidadeMinima: 0 }),
  ],
  ['Seção sem exigências nem regras', comDocumentosExigidos({})],
  [
    'Documento sem seção de documentos exigidos',
    { formato: 'uniplus.selecao.configuracao', versaoFormato: 1 } as DocumentoDaConfiguracao,
  ],
];

describe('ida e volta das exigências com valores atípicos que o esquema admite', () => {
  it.each(ATIPICOS)('%s volta idêntico, na mesma ordem das chaves', (_nome, documento) => {
    const volta = idaEVolta(documento);

    expect(JSON.stringify(volta)).toBe(JSON.stringify(documento));
    expect(volta).toBe(documento);
  });
});
