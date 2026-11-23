import { describe, expect, it } from 'vitest';

import { todasAsExigencias } from './consulta-das-exigencias';
import { semAEtapa, semAFase } from './composicao-das-regras';
import { ID_ETAPA_RENDA, exigencia, rascunho } from './exigencias.testing';

describe('composição das regras de comprovação', () => {
  it('semAFase tira a exigência daquela fase e deixa a das outras', () => {
    const antes = rascunho(
      exigencia({ faseCodigo: 'ISENCAO' }),
      exigencia({ faseCodigo: 'HABILITACAO' }),
    );

    const depois = semAFase(antes, 'ISENCAO');
    expect(todasAsExigencias(depois)).toHaveLength(1);
    expect(todasAsExigencias(depois)[0].faseCodigo).toBe('HABILITACAO');
  });

  it('preserva a referência de documento de outra fase', () => {
    const idadeMaximaEmissao = {
      valor: 90,
      unidade: 'DIAS' as const,
      referenciaTipo: 'INICIO_FASE' as const,
      data: null,
      referenciaFaseCodigo: 'ISENCAO',
    };
    const antes = rascunho(exigencia({ faseCodigo: 'HABILITACAO', idadeMaximaEmissao }));
    expect(todasAsExigencias(semAFase(antes, 'ISENCAO'))[0].idadeMaximaEmissao).toEqual(
      idadeMaximaEmissao,
    );
  });

  it('semAEtapa devolve o documento à fase inteira', () => {
    const depois = semAEtapa(rascunho(exigencia({ etapaId: ID_ETAPA_RENDA })), ID_ETAPA_RENDA);
    expect(todasAsExigencias(depois)[0].etapaId).toBeNull();
  });
});
