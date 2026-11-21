import { describe, expect, it } from 'vitest';

import { umaFaseDoCronograma } from '../../shared/fase-do-cronograma.testing';
import { etapa } from './cronograma-do-certame.testing';
import { comoComandoDeEtapa, comoComandoDeFase } from './cronograma-para-comando';

const FORA_DE_ORDEM_COM_DESCONHECIDO = ['NOTA_DA_ETAPA', 'TIPO_DO_FUTURO', 'CLASSIFICACAO'];
const EM_ORDEM_COM_DESCONHECIDO = ['CLASSIFICACAO', 'NOTA_DA_ETAPA', 'TIPO_DO_FUTURO'];

describe('tipos de decisão da fase no comando', () => {
  it('envia em ordem alfabética do código a lista que chegou fora de ordem', () => {
    const fase = umaFaseDoCronograma({ tiposDeDecisao: FORA_DE_ORDEM_COM_DESCONHECIDO });

    expect(comoComandoDeFase(fase).tiposDeDecisao).toEqual(EM_ORDEM_COM_DESCONHECIDO);
  });

  it('preserva o código que o vocabulário não conhece', () => {
    const fase = umaFaseDoCronograma({ tiposDeDecisao: ['TIPO_DO_FUTURO'] });

    expect(comoComandoDeFase(fase).tiposDeDecisao).toEqual(['TIPO_DO_FUTURO']);
  });

  it('não altera a lista da fase ao ordenar', () => {
    const fase = umaFaseDoCronograma({ tiposDeDecisao: FORA_DE_ORDEM_COM_DESCONHECIDO });

    comoComandoDeFase(fase);

    expect(fase.tiposDeDecisao).toEqual(['NOTA_DA_ETAPA', 'TIPO_DO_FUTURO', 'CLASSIFICACAO']);
  });

  it('envia lista vazia quando a fase não declara tipo', () => {
    expect(
      comoComandoDeFase(umaFaseDoCronograma({ tiposDeDecisao: undefined })).tiposDeDecisao,
    ).toEqual([]);
  });
});

describe('tipos de decisão da etapa no comando', () => {
  it('envia em ordem alfabética do código a lista que chegou fora de ordem', () => {
    const pontuada = etapa({ tiposDeDecisao: FORA_DE_ORDEM_COM_DESCONHECIDO });

    expect(comoComandoDeEtapa(pontuada).tiposDeDecisao).toEqual(EM_ORDEM_COM_DESCONHECIDO);
  });

  it('preserva o código que o vocabulário não conhece', () => {
    const pontuada = etapa({ tiposDeDecisao: ['TIPO_DO_FUTURO'] });

    expect(comoComandoDeEtapa(pontuada).tiposDeDecisao).toEqual(['TIPO_DO_FUTURO']);
  });

  it('não altera a lista da etapa ao ordenar', () => {
    const pontuada = etapa({ tiposDeDecisao: FORA_DE_ORDEM_COM_DESCONHECIDO });

    comoComandoDeEtapa(pontuada);

    expect(pontuada.tiposDeDecisao).toEqual(['NOTA_DA_ETAPA', 'TIPO_DO_FUTURO', 'CLASSIFICACAO']);
  });
});
