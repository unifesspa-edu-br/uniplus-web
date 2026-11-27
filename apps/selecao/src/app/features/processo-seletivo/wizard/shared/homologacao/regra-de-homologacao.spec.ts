import type { CondicaoEmClausula } from '@uniplus/shared-inscricao/formulario';
import { describe, expect, it } from 'vitest';

import type { RegraDeHomologacao } from '../../modelos/homologacao.models';
import {
  comAlternativaIncluida,
  comCondicaoIncluida,
  comEdicaoDaCondicao,
  comEnquadramentoDaCondicao,
  comMotivoDaCondicao,
  comResultado,
  comTipoDaCondicao,
  condicaoNova,
  regraNova,
  semAlternativa,
  semCondicao,
  semRegra,
} from './regra-de-homologacao';
import { REGRA_DE_HOMOLOGACAO } from './regra-de-homologacao.testing';

const TIPO = 'RESULTADO_NO_RETORNO_DO_INEP';

function condicaoDaEdicao(edicaoDoExame: number) {
  return {
    ...condicaoNova(TIPO),
    edicaoDoExame,
    enquadramento: [
      { clausula: 1, fato: 'EDICAO_ENEM', operador: 'IGUAL', valor: `"${edicaoDoExame}"` },
    ],
  };
}

/** A Medicina: uma alternativa por edição, cada uma com a confirmação do INEP daquela edição. */
const MEDICINA: RegraDeHomologacao = {
  resultadoAtoCodigo: 'RESULTADO_HOMOLOGACAO',
  alternativas: [2024, 2025, 2026].map((ano) => ({ condicoes: [condicaoDaEdicao(ano)] })),
};

describe('declarar e apontar o resultado', () => {
  it('declara a regra sem resultado e sem alternativa', () => {
    expect(regraNova()).toStrictEqual({ resultadoAtoCodigo: null, alternativas: [] });
  });

  it('aponta o resultado sem alterar as alternativas', () => {
    const regra = comResultado(REGRA_DE_HOMOLOGACAO, 'OUTRO_RESULTADO');

    expect(regra.resultadoAtoCodigo).toBe('OUTRO_RESULTADO');
    expect(regra.alternativas).toBe(REGRA_DE_HOMOLOGACAO.alternativas);
  });

  it('desfaz o resultado apontado', () => {
    expect(comResultado(REGRA_DE_HOMOLOGACAO, null).resultadoAtoCodigo).toBeNull();
  });

  it('remove a regra', () => {
    expect(semRegra()).toBeNull();
  });
});

describe('alternativas', () => {
  it('inclui a alternativa já com uma condição nova do tipo pedido', () => {
    const regra = comAlternativaIncluida(regraNova(), TIPO);

    expect(regra.alternativas).toStrictEqual([{ condicoes: [condicaoNova(TIPO)] }]);
  });

  it('inclui a alternativa depois das que já existem', () => {
    const regra = comAlternativaIncluida(MEDICINA, TIPO);

    expect(regra.alternativas).toHaveLength(4);
    expect(regra.alternativas.slice(0, 3)).toStrictEqual(MEDICINA.alternativas);
  });

  it('remove só a alternativa da posição', () => {
    const regra = semAlternativa(MEDICINA, 1);

    expect(regra.alternativas).toStrictEqual([MEDICINA.alternativas[0], MEDICINA.alternativas[2]]);
  });

  it('devolve a mesma regra quando a alternativa a remover não existe', () => {
    expect(semAlternativa(MEDICINA, 3)).toBe(MEDICINA);
    expect(semAlternativa(MEDICINA, -1)).toBe(MEDICINA);
  });

  it('volta a homologar toda inscrição ao remover a única alternativa', () => {
    expect(semAlternativa(comAlternativaIncluida(regraNova(), TIPO), 0).alternativas).toStrictEqual(
      [],
    );
  });
});

describe('condições', () => {
  it('nasce sem edição, sem motivo e sem enquadramento', () => {
    expect(condicaoNova(TIPO)).toStrictEqual({
      tipo: TIPO,
      edicaoDoExame: null,
      motivoDesfavoravelCodigo: null,
      enquadramento: [],
    });
  });

  it('inclui a condição ao fim da alternativa, que passa a exigir as duas', () => {
    const regra = comCondicaoIncluida(MEDICINA, 0, TIPO);

    expect(regra.alternativas[0].condicoes).toStrictEqual([
      MEDICINA.alternativas[0].condicoes[0],
      condicaoNova(TIPO),
    ]);
    expect(regra.alternativas[1]).toBe(MEDICINA.alternativas[1]);
  });

  it('devolve a mesma regra ao incluir condição em alternativa que não existe', () => {
    expect(comCondicaoIncluida(MEDICINA, 3, TIPO)).toBe(MEDICINA);
  });

  it('remove só a condição da posição e mantém a alternativa com as outras', () => {
    const regra = semCondicao(REGRA_DE_HOMOLOGACAO, { alternativa: 0, condicao: 0 });

    expect(regra.alternativas[0].condicoes).toStrictEqual([
      REGRA_DE_HOMOLOGACAO.alternativas[0].condicoes[1],
    ]);
    expect(regra.alternativas).toHaveLength(2);
  });

  it('faz sumir a alternativa que perde a última condição', () => {
    const regra = semCondicao(MEDICINA, { alternativa: 1, condicao: 0 });

    expect(regra.alternativas).toStrictEqual([MEDICINA.alternativas[0], MEDICINA.alternativas[2]]);
  });

  it('devolve a mesma regra ao remover condição que não existe', () => {
    expect(semCondicao(MEDICINA, { alternativa: 0, condicao: 1 })).toBe(MEDICINA);
    expect(semCondicao(MEDICINA, { alternativa: 5, condicao: 0 })).toBe(MEDICINA);
  });
});

describe('trocar os campos de uma condição', () => {
  const posicao = { alternativa: 1, condicao: 0 };
  const alvo = (regra: RegraDeHomologacao) => regra.alternativas[1].condicoes[0];

  it('troca o tipo', () => {
    expect(alvo(comTipoDaCondicao(MEDICINA, posicao, 'OUTRO_TIPO')).tipo).toBe('OUTRO_TIPO');
  });

  it('troca a edição do exame e a desfaz com nulo', () => {
    const escolhida = comEdicaoDaCondicao(MEDICINA, posicao, 2023);

    expect(alvo(escolhida).edicaoDoExame).toBe(2023);
    expect(alvo(comEdicaoDaCondicao(escolhida, posicao, null)).edicaoDoExame).toBeNull();
  });

  it('troca o motivo desfavorável', () => {
    const regra = comMotivoDaCondicao(MEDICINA, posicao, 'SEM_RESULTADO_INEP');

    expect(alvo(regra).motivoDesfavoravelCodigo).toBe('SEM_RESULTADO_INEP');
  });

  it('troca o enquadramento', () => {
    const enquadramento: CondicaoEmClausula[] = [
      { clausula: 1, fato: 'BAIXA_RENDA', operador: 'IGUAL', valor: 'true' },
    ];

    expect(alvo(comEnquadramentoDaCondicao(MEDICINA, posicao, enquadramento)).enquadramento).toBe(
      enquadramento,
    );
  });

  it('mantém os outros campos da condição e as outras condições da regra', () => {
    const regra = comEdicaoDaCondicao(MEDICINA, posicao, 2023);

    expect(alvo(regra)).toStrictEqual({ ...alvo(MEDICINA), edicaoDoExame: 2023 });
    expect(regra.alternativas[0]).toBe(MEDICINA.alternativas[0]);
    expect(regra.alternativas[2]).toBe(MEDICINA.alternativas[2]);
  });

  it('devolve a mesma regra quando a posição não existe', () => {
    const inexistentes = [
      { alternativa: 3, condicao: 0 },
      { alternativa: 0, condicao: 1 },
      { alternativa: -1, condicao: 0 },
    ];

    for (const inexistente of inexistentes) {
      expect(comTipoDaCondicao(MEDICINA, inexistente, 'X')).toBe(MEDICINA);
      expect(comEdicaoDaCondicao(MEDICINA, inexistente, 2023)).toBe(MEDICINA);
      expect(comMotivoDaCondicao(MEDICINA, inexistente, 'X')).toBe(MEDICINA);
      expect(comEnquadramentoDaCondicao(MEDICINA, inexistente, [])).toBe(MEDICINA);
    }
  });
});

describe('Medicina: uma alternativa por edição', () => {
  it('monta três alternativas, cada uma com a condição do INEP da própria edição', () => {
    const edicoes = MEDICINA.alternativas.map((a) => a.condicoes.map((c) => c.edicaoDoExame));

    expect(edicoes).toStrictEqual([[2024], [2025], [2026]]);
  });

  it('troca a edição de uma alternativa sem tocar nas outras', () => {
    const regra = comEdicaoDaCondicao(MEDICINA, { alternativa: 2, condicao: 0 }, 2027);

    const edicoes = regra.alternativas.map((a) => a.condicoes[0].edicaoDoExame);
    expect(edicoes).toStrictEqual([2024, 2025, 2027]);
  });

  it('monta a regra da Medicina partindo da regra nova, uma alternativa por edição', () => {
    let regra = comResultado(regraNova(), 'RESULTADO_HOMOLOGACAO');
    [2024, 2025, 2026].forEach((ano, indice) => {
      regra = comAlternativaIncluida(regra, TIPO);
      regra = comEdicaoDaCondicao(regra, { alternativa: indice, condicao: 0 }, ano);
    });

    const edicoes = regra.alternativas.map((a) => a.condicoes.map((c) => c.edicaoDoExame));
    expect(edicoes).toStrictEqual([[2024], [2025], [2026]]);
  });
});

describe('imutabilidade', () => {
  it('não altera a regra de partida em nenhuma operação', () => {
    const copia = structuredClone(MEDICINA);
    const posicao = { alternativa: 0, condicao: 0 };

    comResultado(MEDICINA, null);
    comAlternativaIncluida(MEDICINA, TIPO);
    semAlternativa(MEDICINA, 0);
    comCondicaoIncluida(MEDICINA, 0, TIPO);
    semCondicao(MEDICINA, posicao);
    comTipoDaCondicao(MEDICINA, posicao, 'X');
    comEdicaoDaCondicao(MEDICINA, posicao, 2020);
    comMotivoDaCondicao(MEDICINA, posicao, 'X');
    comEnquadramentoDaCondicao(MEDICINA, posicao, []);

    expect(MEDICINA).toEqual(copia);
  });
});
