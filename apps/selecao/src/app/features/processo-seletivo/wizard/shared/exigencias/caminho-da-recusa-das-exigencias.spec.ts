import { describe, expect, it } from 'vitest';
import {
  caminhoDaRecusaDasExigencias,
  identificarRecusaDaExigencia,
} from './caminho-da-recusa-das-exigencias';

const origens = [
  { identificadorDaRegra: 'grupo', itens: [{ identificadorDaRegra: 'documento', itens: [] }] },
];

describe('caminho da recusa das exigências', () => {
  it('lê índices e campo de um item', () => {
    expect(
      caminhoDaRecusaDasExigencias(
        'regrasDeComprovacao[0].itens[1].documento.requisitos.formatosPermitidos',
      ),
    ).toEqual({
      indiceDaRegra: 0,
      indicesDosItens: [1],
      campo: 'documento.requisitos.formatosPermitidos',
    });
  });

  it('identifica um item pelo ponteiro enviado', () => {
    expect(
      identificarRecusaDaExigencia('/regrasDeComprovacao/0/itens/0/documento/formato', origens),
    ).toEqual({ identificadorDaRegra: 'documento', campo: 'documento.formato' });
  });

  it('recusa caminhos desconhecidos e posições ausentes', () => {
    expect(caminhoDaRecusaDasExigencias('outras[0].documento')).toBeNull();
    expect(caminhoDaRecusaDasExigencias('regrasDeComprovacao[0].itens[x].documento')).toBeNull();
    expect(
      identificarRecusaDaExigencia('regrasDeComprovacao[0].itens[2].forma', origens),
    ).toBeNull();
  });
});
