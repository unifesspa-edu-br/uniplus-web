import { describe, expect, it } from 'vitest';
import { documentoSemNada, exemploDoContrato, NOMES_DOS_EXEMPLOS } from '../exemplos.testing';
import { definirParametroDaEliminacao } from '../edicoes/eliminacao-e-desempate.edicao';
import { lerParametrosDaEliminacao, lerParametrosDoDesempate } from '../parametros-das-regras';
import * as eliminacao from './eliminacao.adaptador';
import * as desempate from './desempate.adaptador';

const catalogo = new Map<string, string>();

describe('eliminação e desempate', () => {
  for (const nome of NOMES_DOS_EXEMPLOS) {
    it(`preserva o exemplo ${nome} nos dois passos`, () => {
      const documento = exemploDoContrato(nome);
      expect(
        JSON.stringify(
          eliminacao.edicaoDoPasso(eliminacao.valoresDoFormulario(documento, catalogo))(documento),
        ),
      ).toBe(JSON.stringify(documento));
      expect(
        JSON.stringify(
          desempate.edicaoDoPasso(desempate.valoresDoFormulario(documento, catalogo))(documento),
        ),
      ).toBe(JSON.stringify(documento));
    });
  }

  it('lê somente campos válidos de rascunhos e ignora códigos sem forma', () => {
    expect(
      lerParametrosDaEliminacao('ELIMINACAO_NOTA_MINIMA_ETAPA', {
        etapaChave: ' etapa ',
        notaMinima: 'errada',
        extra: true,
      }),
    ).toEqual({
      conhecida: true,
      codigo: 'ELIMINACAO_NOTA_MINIMA_ETAPA',
      valores: { etapaChave: ' etapa ' },
    });
    expect(lerParametrosDaEliminacao('OUTRA', {})).toEqual({ conhecida: false });
    expect(lerParametrosDoDesempate('DESEMPATE_CONDICAO_SOBRE_DADO', {})).toEqual({
      conhecida: false,
    });
    expect(lerParametrosDoDesempate('DESEMPATE_IDOSO', { idadeMinima: Infinity })).toEqual({
      conhecida: true,
      codigo: 'DESEMPATE_IDOSO',
      valores: {},
    });
  });

  it('preserva campos desconhecidos, inválidos, ordem e itens repetidos', () => {
    const item = {
      parametros: { extra: 1, notaMinima: 'inválida', etapaChave: ' etapa ' },
      regra: { codigo: 'ELIMINACAO_NOTA_MINIMA_ETAPA', versao: ' v1 ' },
    };
    const documento = {
      ...documentoSemNada(),
      classificacao: { regrasEliminacao: [item, { ...item, parametros: { outro: 2 } }] },
    };
    const valores = eliminacao.valoresDoFormulario(documento, catalogo);
    expect(JSON.stringify(eliminacao.edicaoDoPasso(valores)(documento))).toBe(
      JSON.stringify(documento),
    );
    expect(
      definirParametroDaEliminacao(documento, 0, 'etapaChave', 'nova').classificacao
        ?.regrasEliminacao?.[0].parametros,
    ).toEqual({ extra: 1, notaMinima: 'inválida', etapaChave: 'nova' });
  });

  it('preserva critérios repetidos com ordem e parâmetros desconhecidos', () => {
    const item = {
      parametros: { extra: true, idadeMinima: 'incorreta' },
      regra: { codigo: 'DESEMPATE_IDOSO' },
      ordem: 7,
    };
    const documento = {
      ...documentoSemNada(),
      classificacao: { criteriosDeDesempate: [item, { ...item, ordem: 2 }] },
    };
    const valores = desempate.valoresDoFormulario(documento, catalogo);
    expect(JSON.stringify(desempate.edicaoDoPasso(valores)(documento))).toBe(
      JSON.stringify(documento),
    );
    expect(valores.itens[0].parametros).toEqual({
      conhecida: true,
      codigo: 'DESEMPATE_IDOSO',
      valores: {},
    });
  });

  it('descarta parâmetros ao trocar o código e preserva ao repetir', () => {
    const documento = {
      ...documentoSemNada(),
      classificacao: {
        regrasEliminacao: [
          {
            regra: { codigo: 'ELIMINACAO_CORTE_EM_AREA' },
            parametros: { minimo: 10, extra: true },
          },
        ],
      },
    };
    const valores = eliminacao.valoresDoFormulario(documento, catalogo);
    const item = valores.itens[0];
    expect(eliminacao.edicaoDoPasso(valores)(documento)).toEqual(documento);
    const alterado = eliminacao.edicaoDoPasso({
      itens: [{ ...item, codigo: 'ELIMINACAO_ZERO_EM_AREA' }],
    })(documento);
    expect(alterado.classificacao?.regrasEliminacao?.[0]).toEqual({
      regra: { codigo: 'ELIMINACAO_ZERO_EM_AREA' },
    });
  });

  it('descarta parâmetros do desempate ao trocar o código', () => {
    const documento = {
      ...documentoSemNada(),
      classificacao: {
        criteriosDeDesempate: [
          {
            ordem: 3,
            regra: { codigo: 'DESEMPATE_IDOSO' },
            parametros: { idadeMinima: 60, extra: true },
          },
        ],
      },
    };
    const valores = desempate.valoresDoFormulario(documento, catalogo);
    const alterado = desempate.edicaoDoPasso({
      itens: [{ ...valores.itens[0], codigo: 'DESEMPATE_MAIOR_IDADE' }],
    })(documento);
    expect(alterado.classificacao?.criteriosDeDesempate?.[0]).toEqual({
      ordem: 3,
      regra: { codigo: 'DESEMPATE_MAIOR_IDADE' },
    });
  });
});
