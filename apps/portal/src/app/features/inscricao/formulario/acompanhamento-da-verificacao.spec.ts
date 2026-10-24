import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AcompanhamentoDaVerificacao, esperaDaConsulta } from './acompanhamento-da-verificacao';

describe('Acompanhamento da verificação dos arquivos', () => {
  const consultar = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    consultar.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('a espera cresce e para no teto de 10 s', () => {
    expect([0, 1, 2, 3, 4, 5, 20].map(esperaDaConsulta)).toEqual([
      1000, 2000, 4000, 8000, 10000, 10000, 10000,
    ]);
  });

  it('consulta de novo a cada avaliação que ainda traz arquivo em verificação, com a espera crescente', () => {
    const acompanhamento = new AcompanhamentoDaVerificacao(consultar);

    acompanhamento.aoAvaliar(true);
    vi.advanceTimersByTime(999);
    expect(consultar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(consultar).toHaveBeenCalledTimes(1);

    acompanhamento.aoAvaliar(true);
    vi.advanceTimersByTime(1999);
    expect(consultar).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(consultar).toHaveBeenCalledTimes(2);
  });

  it('para quando a avaliação traz o resultado', () => {
    const acompanhamento = new AcompanhamentoDaVerificacao(consultar);

    acompanhamento.aoAvaliar(true);
    acompanhamento.aoAvaliar(false);
    vi.advanceTimersByTime(60_000);

    expect(consultar).not.toHaveBeenCalled();
  });

  it('sair da tela cancela a consulta pendente', () => {
    const acompanhamento = new AcompanhamentoDaVerificacao(consultar);

    acompanhamento.aoAvaliar(true);
    acompanhamento.parar();
    vi.advanceTimersByTime(60_000);

    expect(consultar).not.toHaveBeenCalled();
  });

  it('arquivo novo em verificação recomeça pela espera curta', () => {
    const acompanhamento = new AcompanhamentoDaVerificacao(consultar);
    for (let i = 0; i < 3; i++) {
      acompanhamento.aoAvaliar(true);
      vi.advanceTimersByTime(10_000);
    }
    consultar.mockClear();

    acompanhamento.recomecar();
    acompanhamento.aoAvaliar(true);
    vi.advanceTimersByTime(1000);

    expect(consultar).toHaveBeenCalledTimes(1);
  });
});
