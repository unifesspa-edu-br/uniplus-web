import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada } from '../exemplos.testing';
import { acrescentarParte, ITENS, removerFormulario } from '../edicoes/formulario.edicao';
import { edicaoDoPasso, valoresDoFormulario } from './formulario.adaptador';

function idaEVolta(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  return (documento.formularios ?? []).reduce((atual, { codigo }) => {
    const valores = valoresDoFormulario(atual, codigo);
    return valores === undefined ? atual : edicaoDoPasso(codigo, valores)(atual);
  }, documento);
}

function comFormularios(
  formularios: NonNullable<DocumentoDaConfiguracao['formularios']>,
  coleta?: DocumentoDaConfiguracao['coleta'],
): DocumentoDaConfiguracao {
  return { ...documentoSemNada(), formularios, ...(coleta && { coleta }) };
}

const INSCRICAO = 'INSCRICAO';
const ISENCAO = 'ISENCAO_TAXA';
const OUTRO = 'HABILITACAO';

/** Valores que o esquema admite e que a leitura do formulário poderia normalizar sem querer. */
const ATIPICOS: readonly [string, DocumentoDaConfiguracao][] = [
  ['Lista de formulários vazia', comFormularios([])],
  ['Formulário só com o código', comFormularios([{ codigo: INSCRICAO }])],
  [
    'Título e fase com espaços, listas vazias e modelo de origem',
    comFormularios([
      {
        codigo: INSCRICAO,
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
    'Dois formulários de códigos diferentes',
    comFormularios([
      { codigo: ISENCAO, titulo: 'A' },
      { codigo: OUTRO, titulo: 'B' },
    ]),
  ],
  [
    'Coleta com referência vazia e data com espaços',
    comFormularios([{ codigo: INSCRICAO }], {
      referenciaTemporalDosDados: {},
      calculosDosDados: [],
    }),
  ],
  [
    'Referência temporal com data e fase com espaços',
    comFormularios([{ codigo: INSCRICAO }], {
      referenciaTemporalDosDados: { data: ' 2027-01-10 ', faseChave: ' fase ' },
    }),
  ],
];

describe('ida e volta dos formulários com valores atípicos que o esquema admite', () => {
  it.each(ATIPICOS)('%s volta idêntico, na mesma ordem das chaves', (_nome, documento) => {
    expect(JSON.stringify(idaEVolta(documento))).toBe(JSON.stringify(documento));
  });
});

it('edita o segundo formulário sem alterar o primeiro', () => {
  const documento = comFormularios([
    { codigo: ISENCAO, titulo: 'A' },
    { codigo: OUTRO, titulo: 'B' },
  ]);
  const valores = valoresDoFormulario(documento, OUTRO);
  if (valores === undefined) throw new Error('Formulário não encontrado');
  expect(edicaoDoPasso(OUTRO, valores)(documento)).toEqual(documento);
  const editado = edicaoDoPasso(OUTRO, {
    ...valores,
    formulario: { ...valores.formulario, titulo: 'C' },
  })(documento);
  expect(editado.formularios).toEqual([
    { codigo: ISENCAO, titulo: 'A' },
    { codigo: OUTRO, titulo: 'C' },
  ]);
});

it('remove ou altera a lista do formulário indicado sem mexer no outro', () => {
  const documento = comFormularios([{ codigo: ISENCAO }, { codigo: OUTRO, titulo: 'B' }]);
  expect(removerFormulario(documento, ISENCAO).formularios).toEqual([
    { codigo: OUTRO, titulo: 'B' },
  ]);
  const editado = acrescentarParte(documento, OUTRO, ITENS, { codigoDoDado: 'A' });
  expect(editado.formularios).toEqual([
    { codigo: ISENCAO },
    { codigo: OUTRO, titulo: 'B', itens: [{ codigoDoDado: 'A', ordem: 0 }] },
  ]);
});
