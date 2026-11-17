import { describe, expect, it } from 'vitest';

import type { ProcedimentoDeRecurso } from '../../processo-seletivo.models';
import {
  declararProcedimento,
  removerProcedimento,
  trocarModoDoTipo,
  trocarRegraDoProcedimento,
} from './procedimentos-da-janela';

const COLEGIADO = { regraCodigo: 'PROCEDIMENTO-RECURSO-COLEGIADO', regraVersao: 'v1' };
const MONOCRATICO = { regraCodigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO', regraVersao: 'v2' };
const INTEIRO = { tipoDeDecisao: 'RESULTADO_FINAL', alvo: null };
const DO_ITEM = { tipoDeDecisao: 'NOTA_DA_ETAPA', alvo: { itemDeAvaliacaoId: 'item-clareza' } };
const DA_AREA = { tipoDeDecisao: 'NOTA_DA_ETAPA', alvo: { areaDoEnem: 'Matemática' } };

function declarado(
  identidade: Pick<ProcedimentoDeRecurso, 'tipoDeDecisao' | 'alvo'>,
  regra = COLEGIADO,
  sugestao: string | null = null,
): ProcedimentoDeRecurso {
  return { ...identidade, ...regra, sugestao };
}

function declaradosPor(
  procedimentos: readonly ProcedimentoDeRecurso[],
  identidade: Pick<ProcedimentoDeRecurso, 'tipoDeDecisao' | 'alvo'>,
  regra = COLEGIADO,
): readonly ProcedimentoDeRecurso[] {
  const resultado = declararProcedimento(procedimentos, identidade, regra);
  if (!resultado.declarado) throw new Error('A declaração foi recusada.');
  return resultado.procedimentos;
}

describe('declarar procedimento', () => {
  it('declara o primeiro procedimento numa janela sem nenhum', () => {
    expect(declaradosPor([], INTEIRO)).toEqual([declarado(INTEIRO)]);
  });

  it('declara sem sugestão, que só vem do servidor', () => {
    const [novo] = declaradosPor([], DA_AREA);

    expect(novo.sugestao).toBeNull();
  });

  it('acrescenta o procedimento de outro alvo do mesmo tipo', () => {
    expect(declaradosPor([declarado(DO_ITEM)], DA_AREA, MONOCRATICO)).toEqual([
      declarado(DO_ITEM),
      declarado(DA_AREA, MONOCRATICO),
    ]);
  });

  it('troca a regra do par que já existe, sem duplicar, e guarda a sugestão do servidor', () => {
    const existentes = [declarado(DO_ITEM, COLEGIADO, 'PROCEDIMENTO-RECURSO-MONOCRATICO')];

    expect(declaradosPor(existentes, DO_ITEM, MONOCRATICO)).toEqual([
      declarado(DO_ITEM, MONOCRATICO, 'PROCEDIMENTO-RECURSO-MONOCRATICO'),
    ]);
  });

  it('não confunde o mesmo tipo com alvos de forma diferente e de mesmo valor', () => {
    const doItem = { tipoDeDecisao: 'NOTA_DA_ETAPA', alvo: { itemDeAvaliacaoId: 'x' } };
    const daArea = { tipoDeDecisao: 'NOTA_DA_ETAPA', alvo: { areaDoEnem: 'x' } };

    expect(declaradosPor([declarado(doItem)], daArea)).toHaveLength(2);
  });

  it('mantém os procedimentos de outros tipos', () => {
    expect(declaradosPor([declarado(INTEIRO)], DO_ITEM)).toEqual([
      declarado(INTEIRO),
      declarado(DO_ITEM),
    ]);
  });

  it('não altera a lista recebida', () => {
    const existentes = [declarado(INTEIRO)];

    declararProcedimento(existentes, INTEIRO, MONOCRATICO);

    expect(existentes).toEqual([declarado(INTEIRO)]);
  });
});

describe('declarar procedimento que contraria o modo vigente do tipo', () => {
  const inteiro = { tipoDeDecisao: 'NOTA_DA_ETAPA', alvo: null };

  it('recusa o tipo inteiro quando o tipo já tem procedimentos por alvo', () => {
    const existentes = [declarado(DO_ITEM), declarado(DA_AREA)];

    expect(declararProcedimento(existentes, inteiro, COLEGIADO)).toEqual({
      declarado: false,
      recusa: { tipoDeDecisao: 'NOTA_DA_ETAPA', modoVigente: 'porAlvo' },
    });
  });

  it('recusa um alvo quando o tipo já está declarado inteiro', () => {
    expect(declararProcedimento([declarado(inteiro)], DO_ITEM, COLEGIADO)).toEqual({
      declarado: false,
      recusa: { tipoDeDecisao: 'NOTA_DA_ETAPA', modoVigente: 'tipoInteiro' },
    });
  });

  it('não recusa por procedimento de outro tipo no outro modo', () => {
    expect(declararProcedimento([declarado(INTEIRO)], DO_ITEM, COLEGIADO).declarado).toBe(true);
  });

  it('deixa a lista recebida intacta quando recusa', () => {
    const existentes = [declarado(DO_ITEM), declarado(INTEIRO)];

    declararProcedimento(existentes, inteiro, COLEGIADO);

    expect(existentes).toEqual([declarado(DO_ITEM), declarado(INTEIRO)]);
  });

  it('só passa a aceitar o modo novo depois de trocarModoDoTipo', () => {
    const existentes = [declarado(DO_ITEM), declarado(DA_AREA)];
    const semPorAlvo = trocarModoDoTipo(existentes, 'NOTA_DA_ETAPA', 'tipoInteiro');

    expect(declaradosPor(semPorAlvo, inteiro)).toEqual([declarado(inteiro)]);
  });
});

describe('trocar a regra do procedimento', () => {
  it('troca só a regra do procedimento escolhido e mantém a posição', () => {
    const existentes = [declarado(DO_ITEM), declarado(DA_AREA)];

    expect(trocarRegraDoProcedimento(existentes, DO_ITEM, MONOCRATICO)).toEqual([
      declarado(DO_ITEM, MONOCRATICO),
      declarado(DA_AREA),
    ]);
  });

  it('não declara procedimento novo quando o par não existe', () => {
    expect(trocarRegraDoProcedimento([declarado(DO_ITEM)], DA_AREA, MONOCRATICO)).toEqual([
      declarado(DO_ITEM),
    ]);
  });

  it('devolve janela vazia quando a janela não tem procedimento', () => {
    expect(trocarRegraDoProcedimento([], INTEIRO, MONOCRATICO)).toEqual([]);
  });
});

describe('remover procedimento', () => {
  it('tira só o procedimento do par e mantém os outros', () => {
    const existentes = [declarado(INTEIRO), declarado(DO_ITEM), declarado(DA_AREA)];

    expect(removerProcedimento(existentes, DO_ITEM)).toEqual([
      declarado(INTEIRO),
      declarado(DA_AREA),
    ]);
  });

  it('remove o procedimento de tipo que o lugar deixou de declarar, sem levar os outros', () => {
    const antigo = { tipoDeDecisao: 'TIPO_QUE_NAO_EXISTE_MAIS', alvo: null };

    expect(removerProcedimento([declarado(antigo), declarado(INTEIRO)], antigo)).toEqual([
      declarado(INTEIRO),
    ]);
  });

  it('não muda nada quando o par não está na janela', () => {
    expect(removerProcedimento([declarado(INTEIRO)], DO_ITEM)).toEqual([declarado(INTEIRO)]);
    expect(removerProcedimento([], INTEIRO)).toEqual([]);
  });
});

describe('trocar o modo do tipo', () => {
  const existentes = [declarado(DO_ITEM), declarado(DA_AREA), declarado(INTEIRO)];

  it('ao passar para o tipo inteiro, descarta os procedimentos por alvo daquele tipo', () => {
    expect(trocarModoDoTipo(existentes, 'NOTA_DA_ETAPA', 'tipoInteiro')).toEqual([
      declarado(INTEIRO),
    ]);
  });

  it('ao passar para por alvo, descarta o procedimento do tipo inteiro daquele tipo', () => {
    const doTipoInteiro = [
      declarado({ tipoDeDecisao: 'NOTA_DA_ETAPA', alvo: null }),
      declarado(INTEIRO),
    ];

    expect(trocarModoDoTipo(doTipoInteiro, 'NOTA_DA_ETAPA', 'porAlvo')).toEqual([
      declarado(INTEIRO),
    ]);
  });

  it('mantém os procedimentos que já estão no modo pedido', () => {
    expect(trocarModoDoTipo(existentes, 'NOTA_DA_ETAPA', 'porAlvo')).toEqual(existentes);
  });

  it('não mexe em tipo sem procedimento', () => {
    expect(trocarModoDoTipo(existentes, 'CLASSIFICACAO', 'tipoInteiro')).toEqual(existentes);
    expect(trocarModoDoTipo([], 'CLASSIFICACAO', 'porAlvo')).toEqual([]);
  });
});
