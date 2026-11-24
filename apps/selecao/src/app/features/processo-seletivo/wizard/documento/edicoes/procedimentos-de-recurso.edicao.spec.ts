import {
  AreaDoEnemDoProcedimento,
  TipoDeDecisaoDoDocumento,
  type DocumentoDaConfiguracao,
  type DocumentoDaConfiguracaoProcedimentoDeRecurso,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada } from '../exemplos.testing';
import {
  alvoDoProcedimento,
  areaDoEnem,
  declararProcedimento,
  definirProcedimentosDaEtapa,
  definirProcedimentosDaFase,
  modoVigenteDoTipo,
  removerProcedimento,
  trocarModoDoTipo,
  trocarRegraDoProcedimento,
  type IdentidadeDoProcedimento,
} from './procedimentos-de-recurso.edicao';

type Procedimento = DocumentoDaConfiguracaoProcedimentoDeRecurso;

const CLASSIFICACAO = TipoDeDecisaoDoDocumento.CLASSIFICACAO;
const HOMOLOGACAO = TipoDeDecisaoDoDocumento.HOMOLOGACAO_DAS_INSCRICOES;
const REGRA_A = { codigo: 'PROCEDIMENTO-A', versao: 'v1' };
const REGRA_B = { codigo: 'PROCEDIMENTO-B', versao: 'v1' };

const DO_TIPO: IdentidadeDoProcedimento = { tipoDeDecisao: CLASSIFICACAO, alvo: null };
const DO_ITEM: IdentidadeDoProcedimento = {
  tipoDeDecisao: CLASSIFICACAO,
  alvo: { itemDeAvaliacaoChave: 'coesao' },
};
const DA_AREA: IdentidadeDoProcedimento = {
  tipoDeDecisao: CLASSIFICACAO,
  alvo: { areaDoEnem: AreaDoEnemDoProcedimento.REDACAO },
};

function umProcedimento(identidade: IdentidadeDoProcedimento, regra = REGRA_A): Procedimento {
  const { tipoDeDecisao, alvo } = identidade;
  return { tipoDeDecisao, ...(alvo !== null && { alvo }), regra };
}

function declarados(resultado: ReturnType<typeof declararProcedimento>): readonly Procedimento[] {
  if (!resultado.declarado) throw new Error('A declaração foi recusada.');
  return resultado.procedimentos;
}

describe('alvo do procedimento', () => {
  it('lê o item, a área ou nenhum alvo', () => {
    expect(alvoDoProcedimento({ itemDeAvaliacaoChave: 'coesao' })).toEqual({
      itemDeAvaliacaoChave: 'coesao',
    });
    expect(alvoDoProcedimento({ areaDoEnem: AreaDoEnemDoProcedimento.REDACAO })).toEqual({
      areaDoEnem: 'REDACAO',
    });
    expect(alvoDoProcedimento({})).toBeNull();
    expect(alvoDoProcedimento(undefined)).toBeNull();
  });

  it('reconhece só a área do vocabulário do documento', () => {
    expect(areaDoEnem('MATEMATICA')).toBe(AreaDoEnemDoProcedimento.MATEMATICA);
    expect(areaDoEnem('Matemática')).toBeUndefined();
  });
});

describe('declarar procedimento', () => {
  it('acrescenta o procedimento ao fim, sem `alvo` quando vale para o tipo inteiro', () => {
    const lista = declarados(declararProcedimento([], DO_TIPO, REGRA_A));

    expect(lista).toEqual([{ tipoDeDecisao: CLASSIFICACAO, regra: REGRA_A }]);
    expect(lista[0]).not.toHaveProperty('alvo');
  });

  it('recusa declarar o mesmo par tipo e alvo mesmo com outra regra', () => {
    const lista = [umProcedimento(DO_ITEM)];

    const resultado = declararProcedimento(lista, DO_ITEM, REGRA_B);

    expect(resultado).toMatchObject({ declarado: false, recusa: { motivo: 'duplicado' } });
    expect(lista).toEqual([umProcedimento(DO_ITEM)]);
  });

  it('recusa declarar por alvo o tipo que já está declarado inteiro, e o inverso', () => {
    const inteiro = declararProcedimento([umProcedimento(DO_TIPO)], DO_ITEM, REGRA_A);
    const porAlvo = declararProcedimento([umProcedimento(DO_ITEM)], DO_TIPO, REGRA_A);

    expect(inteiro).toEqual({
      declarado: false,
      recusa: { tipoDeDecisao: CLASSIFICACAO, modoVigente: 'tipoInteiro', motivo: 'conflitante' },
    });
    expect(porAlvo).toMatchObject({ declarado: false, recusa: { modoVigente: 'porAlvo' } });
  });

  it('item e área são alvos diferentes do mesmo tipo e convivem', () => {
    const lista = [umProcedimento(DO_ITEM)];

    expect(declarados(declararProcedimento(lista, DA_AREA, REGRA_A))).toHaveLength(2);
  });

  it('o tipo de outra decisão não conta para o modo vigente', () => {
    const lista = [umProcedimento(DO_TIPO)];
    const outro: IdentidadeDoProcedimento = { tipoDeDecisao: HOMOLOGACAO, alvo: DO_ITEM.alvo };

    expect(modoVigenteDoTipo(lista, HOMOLOGACAO)).toBeNull();
    expect(declararProcedimento(lista, outro, REGRA_A).declarado).toBe(true);
  });
});

describe('trocar, remover e mudar o modo', () => {
  it('trocar a regra mexe só no procedimento da identidade', () => {
    const lista = [umProcedimento(DO_ITEM), umProcedimento(DA_AREA)];

    const trocada = trocarRegraDoProcedimento(lista, DO_ITEM, REGRA_B);

    expect(trocada).toEqual([umProcedimento(DO_ITEM, REGRA_B), umProcedimento(DA_AREA)]);
    expect(trocada[1]).toBe(lista[1]);
  });

  it('trocar para a mesma regra devolve o procedimento como estava', () => {
    const lista = [umProcedimento(DO_ITEM)];

    expect(trocarRegraDoProcedimento(lista, DO_ITEM, REGRA_A)[0]).toBe(lista[0]);
  });

  it('remover tira só o procedimento da identidade', () => {
    const lista = [umProcedimento(DO_ITEM), umProcedimento(DA_AREA)];

    expect(removerProcedimento(lista, DO_ITEM)).toEqual([umProcedimento(DA_AREA)]);
  });

  it('mudar o modo do tipo tira os procedimentos dele que não são do modo e deixa os de outros tipos', () => {
    const lista = [
      umProcedimento(DO_ITEM),
      umProcedimento(DA_AREA),
      umProcedimento({ tipoDeDecisao: HOMOLOGACAO, alvo: null }),
    ];

    const resultado = trocarModoDoTipo(lista, CLASSIFICACAO, 'tipoInteiro');

    expect(resultado).toEqual([umProcedimento({ tipoDeDecisao: HOMOLOGACAO, alvo: null })]);
  });
});

describe('procedimentos na fase e na etapa', () => {
  function comJanelas(): DocumentoDaConfiguracao {
    return {
      ...documentoSemNada(),
      cronograma: {
        fases: [
          {
            chave: 'a',
            tipoFaseCodigo: 'INSCRICOES',
            noMesmoMomentoDaAnterior: false,
            regraRecurso: { regraCodigo: 'RECURSO', procedimentosDeRecurso: [] },
          },
          {
            chave: 'sem-recurso',
            tipoFaseCodigo: 'INSCRICOES',
            noMesmoMomentoDaAnterior: false,
          },
        ],
      },
      etapas: [{ chave: 'prova', recursos: [{ prazoValor: 1 }, { prazoValor: 2 }] }],
    };
  }

  it('grava os procedimentos na regra de recurso da fase, sem tocar no resto da regra', () => {
    const editado = definirProcedimentosDaFase(comJanelas(), 'a', [umProcedimento(DO_TIPO)]);

    expect(editado.cronograma?.fases?.[0].regraRecurso).toEqual({
      regraCodigo: 'RECURSO',
      procedimentosDeRecurso: [umProcedimento(DO_TIPO)],
    });
  });

  it('fase sem regra de recurso não ganha uma, porque a presença da regra é a janela de recurso', () => {
    const documento = comJanelas();

    expect(definirProcedimentosDaFase(documento, 'sem-recurso', [umProcedimento(DO_TIPO)])).toBe(
      documento,
    );
  });

  it('grava os procedimentos no recurso da etapa que está na posição', () => {
    const editado = definirProcedimentosDaEtapa(comJanelas(), 'prova', 1, [
      umProcedimento(DO_TIPO),
    ]);

    expect(editado.etapas?.[0].recursos).toEqual([
      { prazoValor: 1 },
      { prazoValor: 2, procedimentosDeRecurso: [umProcedimento(DO_TIPO)] },
    ]);
  });

  it('posição de recurso que não existe não muda nada', () => {
    const documento = comJanelas();

    expect(definirProcedimentosDaEtapa(documento, 'prova', 5, [umProcedimento(DO_TIPO)])).toEqual(
      documento,
    );
  });
});

describe('procedimentos repetidos', () => {
  it('troca e remove somente a primeira ocorrência da identidade', () => {
    const lista = [umProcedimento(DO_ITEM), umProcedimento(DO_ITEM)];
    expect(trocarRegraDoProcedimento(lista, DO_ITEM, REGRA_B)[1]).toBe(lista[1]);
    expect(removerProcedimento(lista, DO_ITEM)).toEqual([lista[1]]);
    const segunda = { ...DO_ITEM, ocorrencia: 1 };
    expect(trocarRegraDoProcedimento(lista, segunda, REGRA_B)[0]).toBe(lista[0]);
    expect(removerProcedimento(lista, segunda)[0]).toBe(lista[0]);
  });
});

describe('janelas de chave repetida', () => {
  it('edita apenas a ocorrência indicada da fase e da etapa', () => {
    const documento: DocumentoDaConfiguracao = {
      ...documentoSemNada(),
      cronograma: {
        fases: [
          {
            chave: 'a',
            tipoFaseCodigo: 'INSCRICOES',
            noMesmoMomentoDaAnterior: false,
            regraRecurso: {},
          },
          {
            chave: 'a',
            tipoFaseCodigo: 'INSCRICOES',
            noMesmoMomentoDaAnterior: false,
            regraRecurso: {},
          },
        ],
      },
      etapas: [
        { chave: 'e', recursos: [{}] },
        { chave: 'e', recursos: [{}] },
      ],
    };
    const procedimentos = [umProcedimento(DO_TIPO)];
    const fase = definirProcedimentosDaFase(documento, 'a', procedimentos, 1);
    const etapa = definirProcedimentosDaEtapa(
      documento,
      'e',
      { posicao: 0, ocorrencia: 1 },
      procedimentos,
    );
    expect(fase.cronograma).toEqual({
      fases: [
        {
          chave: 'a',
          tipoFaseCodigo: 'INSCRICOES',
          noMesmoMomentoDaAnterior: false,
          regraRecurso: {},
        },
        {
          chave: 'a',
          tipoFaseCodigo: 'INSCRICOES',
          noMesmoMomentoDaAnterior: false,
          regraRecurso: { procedimentosDeRecurso: procedimentos },
        },
      ],
    });
    expect(etapa.etapas).toEqual([
      { chave: 'e', recursos: [{}] },
      { chave: 'e', recursos: [{ procedimentosDeRecurso: procedimentos }] },
    ]);
  });
});
