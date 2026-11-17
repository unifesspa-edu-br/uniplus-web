import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { catalogoPorCodigo } from '../catalogos-por-codigo';
import { documentoSemNada } from '../exemplos.testing';
import { edicaoDoPasso, valoresDoFormulario } from './cronograma.adaptador';

const SEM_CATALOGO = catalogoPorCodigo([]);

function idaEVolta(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  const valores = valoresDoFormulario(documento, {
    fases: SEM_CATALOGO,
    unidades: SEM_CATALOGO,
    tiposDeEtapa: SEM_CATALOGO,
  });
  return edicaoDoPasso(valores)(documento);
}

function comSecao(secao: Partial<DocumentoDaConfiguracao>): DocumentoDaConfiguracao {
  return { ...documentoSemNada(), ...secao };
}

/** Valores que o esquema admite e que a leitura do formulário poderia normalizar sem querer. */
const ATIPICOS: readonly [string, DocumentoDaConfiguracao][] = [
  ['Cronograma vazio', comSecao({ cronograma: {} })],
  ['Cronograma com a lista de fases vazia', comSecao({ cronograma: { fases: [] } })],
  ['Etapas com a lista vazia', comSecao({ etapas: [] })],
  [
    'Fase com espaços nos códigos e instantes com fração de segundo',
    comSecao({
      cronograma: {
        fases: [
          {
            chave: 'inscricao',
            faseCanonicaCodigo: ' INSCRICAO ',
            inicio: '2027-01-10T03:00:00.5Z',
            fim: '2027-01-20T02:59:59.123456Z',
            unidadeResponsavelCodigo: ' CEPS ',
            unidadeResponsavelNome: 'Nome gravado',
          },
        ],
      },
    }),
  ],
  [
    'Fase com instante que o calendário não reconhece',
    comSecao({
      cronograma: {
        fases: [{ chave: 'a', inicio: '2027-13-45T99:99:99Z', fim: '2027-02-30T00:00:00Z' }],
      },
    }),
  ],
  [
    'Fases de chave repetida e janelas diferentes',
    comSecao({
      cronograma: {
        fases: [
          { chave: 'x', inicio: '2027-01-10T03:00:00Z', unidadeResponsavelCodigo: 'A' },
          { chave: 'x', inicio: '2027-05-10T03:00:00Z', unidadeResponsavelCodigo: 'B' },
        ],
      },
    }),
  ],
  [
    'Fase com `ordem` fora de sequência e campos que nenhuma tela edita',
    comSecao({
      cronograma: {
        fases: [
          { chave: 'a', ordem: 9, assinantes: [], regraDeHomologacao: {} },
          { chave: 'b', ordem: 2, produtos: [] },
        ],
      },
    }),
  ],
  [
    'Etapa com textos em branco, referência vazia e números em notação científica',
    comSecao({
      etapas: [
        {
          chave: 'prova',
          nome: '   ',
          tipoEtapaCodigo: ' PROVA ',
          peso: 1e-7,
          notaMinima: 0,
          notaMaxima: 1e21,
          passoDoLancamento: 0.30000000000000004,
          regraConsolidacao: {},
          faseChave: ' fase ',
        },
      ],
    }),
  ],
  [
    'Etapas com `ordem` fora de sequência e de chave repetida',
    comSecao({
      etapas: [
        { chave: 'a', ordem: 7, nome: 'Primeira' },
        { chave: 'a', ordem: 3, nome: 'Segunda' },
        { chave: 'b', ordem: 3 },
      ],
    }),
  ],
  [
    'Etapa com itens e níveis de chave repetida, rótulo vazio e fração com ruído',
    comSecao({
      etapas: [
        {
          chave: 'redacao',
          itensDeAvaliacao: [
            { chave: 'x', rotulo: '', pontuacaoMaxima: 1e-7 },
            { chave: 'x', rotulo: ' Coesão ', pontuacaoMaxima: 40 },
          ],
          escalaDeAtendimento: [
            { chave: 'n', rotulo: 'Parcial', fracao: 0.30000000000000004 },
            { chave: 'n', fracao: 1e-7 },
          ],
        },
      ],
    }),
  ],
  [
    'Convenção de contagem vazia e chave antes de outra seção',
    comSecao({
      identificacao: { algoritmoContagemPrazo: {}, nome: 'Depois da convenção' },
      cronograma: { fases: [{ chave: 'a' }] },
    }),
  ],
];

describe('ida e volta do cronograma com valores atípicos que o esquema admite', () => {
  it.each(ATIPICOS)('%s volta idêntico, na mesma ordem das chaves', (_nome, documento) => {
    expect(JSON.stringify(idaEVolta(documento))).toBe(JSON.stringify(documento));
  });

  it('editar uma fase de chave repetida muda só aquela ocorrência', () => {
    const documento = ATIPICOS.find(([nome]) => nome.startsWith('Fases de chave repetida'))?.[1];
    if (documento === undefined) throw new Error('Caso atípico não encontrado.');
    const valores = valoresDoFormulario(documento, {
      fases: SEM_CATALOGO,
      unidades: SEM_CATALOGO,
      tiposDeEtapa: SEM_CATALOGO,
    });
    const [primeira, segunda] = valores.fases;

    const editado = edicaoDoPasso({
      ...valores,
      fases: [primeira, { ...segunda, unidadeResponsavelCodigo: 'C' }],
    })(documento);

    expect(editado.cronograma?.fases?.map((fase) => fase.unidadeResponsavelCodigo)).toEqual([
      'A',
      'C',
    ]);
  });
});
