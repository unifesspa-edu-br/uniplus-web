import { describe, expect, it } from 'vitest';

import { distribuicao, federal } from './distribuicao-de-vagas.testing';
import { comoComando } from './distribuicao-para-comando';

describe('comoComando', () => {
  it('envia as vagas ofertadas base e o percentual da reserva legal como números', () => {
    const comando = comoComando(federal({ voBase: '100', pr: '0,75' }));

    expect(comando.vagasOfertadasBase).toBe(100);
    expect(comando.percentualDaReservaLegal).toBe(0.75);
  });

  it('envia o percentual ausente quando o quadro é fixado no edital', () => {
    expect(comoComando(distribuicao({ pr: '' })).percentualDaReservaLegal).toBeNull();
  });

  it('envia zero para o percentual que não é número, e o servidor o recusa', () => {
    expect(comoComando(federal({ pr: 'dez' })).percentualDaReservaLegal).toBe(0);
  });

  it('envia só as modalidades por id e as quantidades como números', () => {
    const comando = comoComando(distribuicao());

    expect(comando.modalidadeIds).toEqual(['m-inst']);
    expect(comando.quadro).toEqual([{ modalidadeId: 'm-inst', quantidade: 10 }]);
  });
});
