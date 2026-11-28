import { describe, expect, it } from 'vitest';

import { todasAsExigencias } from './consulta-das-exigencias';
import { semAEtapa, semAFase } from './composicao-das-regras';
import { CHAVE_ETAPA_RENDA, exigencia, rascunho } from './exigencias.testing';

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
    const prazoDeEmissao = {
      escolha: 'COM_PRAZO',
      valor: 90,
      unidade: 'DIAS',
      referencia: { tipo: 'INICIO_DA_FASE', data: null, faseCodigo: 'ISENCAO' },
      efeitoForaDoPrazo: 'RECUSAR_DOCUMENTO',
    };
    const antes = rascunho(exigencia({ faseCodigo: 'HABILITACAO', prazoDeEmissao }));
    expect(todasAsExigencias(semAFase(antes, 'ISENCAO'))[0].prazoDeEmissao).toEqual(prazoDeEmissao);
  });

  it('semAEtapa devolve o documento à fase inteira', () => {
    const depois = semAEtapa(
      rascunho(exigencia({ etapaChave: CHAVE_ETAPA_RENDA })),
      CHAVE_ETAPA_RENDA,
    );
    expect(todasAsExigencias(depois)[0].etapaChave).toBeNull();
  });
});
