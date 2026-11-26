import { describe, expect, it } from 'vitest';

import type { RegraDeHomologacao } from '../../../modelos/homologacao.models';
import type { RecusaOrdenada } from '../../../shared/recusas/ordem-das-recusas';
import { condicaoNova } from '../../../shared/homologacao/regra-de-homologacao';
import { recusasDoAltoDaRegra, recusasDoCampoDaHomologacao } from './recusas-da-homologacao';

const REGRA: RegraDeHomologacao = {
  resultadoAtoCodigo: null,
  alternativas: [
    { condicoes: [condicaoNova('RESULTADO_NO_RETORNO_DO_INEP')] },
    {
      condicoes: [
        condicaoNova('RESULTADO_NO_RETORNO_DO_INEP'),
        condicaoNova('RESULTADO_NO_RETORNO_DO_INEP'),
      ],
    },
  ],
};

function recusa(campo: string, aConferir = false): RecusaOrdenada {
  return {
    campo,
    codigo: 'uniplus.selecao.homologacao_das_inscricoes.edicao_do_exame_invalida',
    mensagem: 'A edição do exame deve ser um ano entre 1998 e 2100.',
    pagina: null,
    ordem: 0,
    resposta: 1,
    origem: 'gravacao',
    aConferir,
  };
}

describe('recusasDoAltoDaRegra', () => {
  it('leva ao alto a recusa à regra inteira', () => {
    const inteira = recusa('homologacao');

    expect(recusasDoAltoDaRegra([inteira], REGRA)).toEqual([inteira]);
  });

  it('leva ao alto a recusa que a pessoa já tocou por baixo', () => {
    const tocada = recusa('homologacao.alternativas.0.condicoes.0.tipo', true);

    expect(recusasDoAltoDaRegra([tocada], REGRA)).toEqual([tocada]);
  });

  it('leva ao alto a recusa à condição que já não existe', () => {
    const sumida = recusa('homologacao.alternativas.1.condicoes.2.tipo');

    expect(recusasDoAltoDaRegra([sumida], REGRA)).toEqual([sumida]);
  });

  it('leva ao alto a recusa à alternativa que já não existe', () => {
    const sumida = recusa('homologacao.alternativas.2');

    expect(recusasDoAltoDaRegra([sumida], REGRA)).toEqual([sumida]);
  });

  it('deixa no campo a recusa vigente a uma condição que existe', () => {
    expect(
      recusasDoAltoDaRegra([recusa('homologacao.alternativas.1.condicoes.1.edicaoDoExame')], REGRA),
    ).toEqual([]);
  });

  it('deixa no resultado a recusa vigente a ele', () => {
    expect(recusasDoAltoDaRegra([recusa('homologacao.resultado')], REGRA)).toEqual([]);
  });
});

describe('recusasDoCampoDaHomologacao', () => {
  it('devolve só as recusas vigentes ao campo', () => {
    const vigente = recusa('homologacao.resultado');
    const recusas = [
      vigente,
      recusa('homologacao.resultado', true),
      recusa('homologacao.alternativas.0'),
    ];

    expect(recusasDoCampoDaHomologacao(recusas, 'homologacao.resultado')).toEqual([vigente]);
  });
});
