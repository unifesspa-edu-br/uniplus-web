import { describe, expect, it } from 'vitest';

import type { RegraDeComprovacao } from '../../modelos/exigencias.models';
import { comDocumentosExigidos, idaEVolta, lidas, secaoDe } from './exigencias.testing';

const EXIGENCIA = {
  tipoDocumentoCodigo: 'RG',
  faseChave: 'fase_inscricao',
  obrigatorio: true,
  abrePrazoParaReenvio: false,
};

function documentoComGrupos() {
  return comDocumentosExigidos({
    exigencias: ['a', 'b', 'c'].map((letra) => ({ ...EXIGENCIA, chave: `exigencia_${letra}` })),
    regrasDeComprovacao: [
      {
        forma: 'TODOS_OS_ITENS',
        itens: [
          { forma: 'DOCUMENTO', formaRotulo: 'Documento', exigenciaChave: 'exigencia_a' },
          { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_b' },
        ],
      },
      {
        forma: 'QUANTIDADE_MINIMA_DE_ITENS',
        quantidadeMinima: 1,
        itens: [{ forma: 'DOCUMENTO', exigenciaChave: 'exigencia_c' }],
      },
    ],
  });
}

function itensDe(regra: RegraDeComprovacao): readonly RegraDeComprovacao[] {
  return regra.itens ?? [];
}

describe('edição das regras de comprovação das exigências', () => {
  it('mover a regra para outro grupo mantém a regra original e os campos que a tela não conhece', () => {
    const documento = documentoComGrupos();
    const original = secaoDe(documento).regrasDeComprovacao?.[0].itens?.[0];

    const volta = idaEVolta(
      documento,
      ({ regrasDeComprovacao: [primeiro, segundo], ...resto }) => ({
        ...resto,
        regrasDeComprovacao: [
          { ...primeiro, itens: itensDe(primeiro).slice(1) },
          { ...segundo, itens: [...itensDe(segundo), itensDe(primeiro)[0]] },
        ],
      }),
    );

    const [grupoUm, grupoDois] = secaoDe(volta).regrasDeComprovacao ?? [];
    expect(grupoUm.itens?.map((item) => item.exigenciaChave)).toEqual(['exigencia_b']);
    expect(grupoDois.itens?.map((item) => item.exigenciaChave)).toEqual([
      'exigencia_c',
      'exigencia_a',
    ]);
    expect(grupoDois.itens?.[1]).toBe(original);
    expect(grupoDois.itens?.[1].formaRotulo).toBe('Documento');
    expect(secaoDe(volta).exigencias).toHaveLength(3);
  });

  it('criar um grupo com uma regra que já existe leva a mesma regra, sem copiá-la', () => {
    const documento = documentoComGrupos();
    const original = secaoDe(documento).regrasDeComprovacao?.[1].itens?.[0];

    const volta = idaEVolta(
      documento,
      ({ regrasDeComprovacao: [primeiro, segundo], ...resto }) => ({
        ...resto,
        regrasDeComprovacao: [
          primeiro,
          { ...segundo, origem: undefined, forma: 'TODOS_OS_ITENS', quantidadeMinima: null },
        ],
      }),
    );

    const regras = secaoDe(volta).regrasDeComprovacao ?? [];
    expect(regras).toHaveLength(2);
    expect(regras[1].forma).toBe('TODOS_OS_ITENS');
    expect(regras[1].quantidadeMinima).toBeUndefined();
    expect(regras[1].itens?.[0]).toBe(original);
  });

  it('a regra nova, sem origem, vai ao fim e não toma o lugar de nenhuma outra', () => {
    const documento = documentoComGrupos();

    const volta = idaEVolta(documento, ({ regrasDeComprovacao, ...resto }) => ({
      ...resto,
      regrasDeComprovacao: [
        ...regrasDeComprovacao,
        { ...regrasDeComprovacao[1], origem: undefined, itens: [], quantidadeMinima: 2 },
      ],
    }));

    const regras = secaoDe(volta).regrasDeComprovacao ?? [];
    expect(regras).toHaveLength(3);
    expect(regras[0]).toBe(secaoDe(documento).regrasDeComprovacao?.[0]);
    expect(regras[1]).toBe(secaoDe(documento).regrasDeComprovacao?.[1]);
    expect(regras[2]).toEqual({
      forma: 'QUANTIDADE_MINIMA_DE_ITENS',
      quantidadeMinima: 2,
    });
  });

  it('trocar a forma do grupo chega ao documento nos dois sentidos', () => {
    const documento = documentoComGrupos();
    const trocar = (posicao: number, forma: RegraDeComprovacao['forma']) =>
      secaoDe(
        idaEVolta(documento, (e) => ({
          ...e,
          regrasDeComprovacao: e.regrasDeComprovacao.map((regra, indice) =>
            indice === posicao ? { ...regra, forma } : regra,
          ),
        })),
      ).regrasDeComprovacao?.[posicao].forma;

    expect(trocar(0, 'QUANTIDADE_MINIMA_DE_ITENS')).toBe('QUANTIDADE_MINIMA_DE_ITENS');
    expect(trocar(1, 'TODOS_OS_ITENS')).toBe('TODOS_OS_ITENS');
  });

  it('cada campo da regra que a tela edita chega ao documento', () => {
    const volta = idaEVolta(documentoComGrupos(), (e) => ({
      ...e,
      regrasDeComprovacao: e.regrasDeComprovacao.map((regra, indice) =>
        indice === 1
          ? {
              ...regra,
              quantidadeMinima: 2,
              consequencia: 'ELIMINA_DO_PROCESSO',
              abrePrazoParaReenvio: true,
              basesLegais: [
                {
                  referencia: 'Portaria 3',
                  abrangencia: 'INTERNA_NORMA',
                  situacao: 'RESOLVIDO',
                  observacao: null,
                },
              ],
              criterioDeDistincao: 'OCORRENCIA',
              dataReferencia: '2027-01-31',
              ocorrenciasEsperadas: ['A', 'B'],
              grupoDoFormularioParaRepeticao: 'EMPREGOS',
            }
          : regra,
      ),
    }));

    expect(secaoDe(volta).regrasDeComprovacao?.[1]).toEqual({
      forma: 'QUANTIDADE_MINIMA_DE_ITENS',
      quantidadeMinima: 2,
      consequenciaDoDescumprimento: 'ELIMINA_DO_PROCESSO',
      abrePrazoParaReenvio: true,
      basesLegais: [
        { referencia: 'Portaria 3', abrangencia: 'INTERNA_NORMA', situacao: 'RESOLVIDO' },
      ],
      criterioDeDistincao: 'OCORRENCIA',
      dataReferencia: '2027-01-31',
      ocorrenciasEsperadas: ['A', 'B'],
      grupoDoFormularioParaRepeticao: 'EMPREGOS',
      itens: [{ forma: 'DOCUMENTO', exigenciaChave: 'exigencia_c' }],
    });
  });

  it('esvaziar os campos opcionais da regra os tira do documento', () => {
    const documento = comDocumentosExigidos({
      exigencias: [{ ...EXIGENCIA, chave: 'exigencia_a' }],
      regrasDeComprovacao: [
        {
          forma: 'DOCUMENTO',
          exigenciaChave: 'exigencia_a',
          quantidadeMinima: 3,
          criterioDeDistincao: 'OCORRENCIA',
          criterioDeDistincaoRotulo: 'Ocorrência',
          ocorrenciasEsperadas: ['A'],
          grupoDoFormularioParaRepeticao: 'EMPREGOS',
        },
      ],
    });

    const volta = idaEVolta(documento, (e) => ({
      ...e,
      regrasDeComprovacao: e.regrasDeComprovacao.map((regra) => ({
        ...regra,
        quantidadeMinima: null,
        criterioDeDistincao: null,
        ocorrenciasEsperadas: null,
        grupoDoFormularioParaRepeticao: null,
      })),
    }));

    expect(secaoDe(volta).regrasDeComprovacao).toEqual([
      { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_a' },
    ]);
  });

  it('lê as regras com a origem de uma lista única, a de cada regra seguida pelos seus itens', () => {
    const regras = lidas(documentoComGrupos()).regrasDeComprovacao;

    expect(regras.map((regra) => regra.origem)).toEqual([0, 3]);
    expect(itensDe(regras[0]).map((regra) => regra.origem)).toEqual([1, 2]);
    expect(itensDe(regras[1]).map((regra) => regra.origem)).toEqual([4]);
  });
});
