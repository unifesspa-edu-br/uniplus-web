import { FinalidadeDoFormulario, type DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada } from '../exemplos.testing';
import { acrescentarParte, ITENS, removerFormulario } from '../edicoes/formulario.edicao';
import { edicaoDoPasso, valoresDoFormulario } from './formulario.adaptador';

function idaEVolta(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  return Object.values(FinalidadeDoFormulario).reduce((atual, finalidade) => {
    const valores = valoresDoFormulario(atual, finalidade);
    return valores === undefined ? atual : edicaoDoPasso(finalidade, valores)(atual);
  }, documento);
}

function comFormularios(
  formularios: NonNullable<DocumentoDaConfiguracao['formularios']>,
  coleta?: DocumentoDaConfiguracao['coleta'],
): DocumentoDaConfiguracao {
  return { ...documentoSemNada(), formularios, ...(coleta && { coleta }) };
}

const INSCRICAO = FinalidadeDoFormulario.INSCRICAO;
const ISENCAO = FinalidadeDoFormulario.ISENCAO_TAXA;

/** Valores que o esquema admite e que a leitura do formulário poderia normalizar sem querer. */
const ATIPICOS: readonly [string, DocumentoDaConfiguracao][] = [
  ['Lista de formulários vazia', comFormularios([])],
  ['Formulário só com a finalidade', comFormularios([{ finalidade: INSCRICAO }])],
  [
    'Título e fase com espaços, listas vazias e modelo de origem',
    comFormularios([
      {
        finalidade: INSCRICAO,
        titulo: '  Inscrição  ',
        faseChave: ' inscricao ',
        modeloOrigemCodigo: 'MODELO',
        paginas: [],
        itens: [],
        grupos: [],
        termos: [],
      },
    ]),
  ],
  [
    'Dois formulários da mesma finalidade',
    comFormularios([
      { finalidade: ISENCAO, titulo: 'A' },
      { finalidade: ISENCAO, titulo: 'B' },
    ]),
  ],
  [
    'Coleta com referência vazia e data com espaços',
    comFormularios([{ finalidade: INSCRICAO }], {
      referenciaTemporalDosDados: {},
      calculosDosDados: [],
    }),
  ],
  [
    'Referência temporal com data e fase com espaços',
    comFormularios([{ finalidade: INSCRICAO }], {
      referenciaTemporalDosDados: { data: ' 2027-01-10 ', faseChave: ' fase ' },
    }),
  ],
];

describe('ida e volta dos formulários com valores atípicos que o esquema admite', () => {
  it.each(ATIPICOS)('%s volta idêntico, na mesma ordem das chaves', (_nome, documento) => {
    expect(JSON.stringify(idaEVolta(documento))).toBe(JSON.stringify(documento));
  });
});

it('edita a segunda ocorrência da finalidade sem alterar a primeira', () => {
  const documento = comFormularios([
    { finalidade: ISENCAO, titulo: 'A' },
    { finalidade: ISENCAO, titulo: 'B' },
  ]);
  const valores = valoresDoFormulario(documento, ISENCAO, 1);
  if (valores === undefined) throw new Error('Formulário não encontrado');
  expect(edicaoDoPasso(ISENCAO, valores, 1)(documento)).toEqual(documento);
  const editado = edicaoDoPasso(
    ISENCAO,
    { ...valores, formulario: { ...valores.formulario, titulo: 'C' } },
    1,
  )(documento);
  expect(editado.formularios).toEqual([
    { finalidade: ISENCAO, titulo: 'A' },
    { finalidade: ISENCAO, titulo: 'C' },
  ]);
});

it('remove ou altera a lista da ocorrência indicada sem mexer na outra', () => {
  const documento = comFormularios([{ finalidade: ISENCAO }, { finalidade: ISENCAO, titulo: 'B' }]);
  expect(removerFormulario(documento, ISENCAO).formularios).toEqual([
    { finalidade: ISENCAO, titulo: 'B' },
  ]);
  const editado = acrescentarParte(documento, { finalidade: ISENCAO, ocorrencia: 1 }, ITENS, {
    codigoDoDado: 'A',
  });
  expect(editado.formularios).toEqual([
    { finalidade: ISENCAO },
    { finalidade: ISENCAO, titulo: 'B', itens: [{ codigoDoDado: 'A', ordem: 0 }] },
  ]);
});
