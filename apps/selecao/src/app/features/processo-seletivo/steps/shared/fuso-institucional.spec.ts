import { describe, expect, it } from 'vitest';

import { campoDoInstante, hojeNoFusoInstitucional, instanteDoCampo } from './fuso-institucional';

describe('hoje no fuso institucional', () => {
  /**
   * O caso que `toISOString()` erra: 22h de 20/03 em Belém já é 21/03 em UTC.
   * Conferir vigência pela data UTC ofereceria um ato que só passa a valer
   * amanhã — e o servidor, que confere no próprio relógio, o recusaria.
   */
  it('devolve o dia local mesmo quando UTC já virou', () => {
    const noiteEmBelem = new Date('2026-03-21T01:30:00Z');

    expect(noiteEmBelem.toISOString().slice(0, 10)).toBe('2026-03-21');
    expect(hojeNoFusoInstitucional(noiteEmBelem)).toBe('2026-03-20');
  });

  it('devolve o mesmo dia quando UTC e o fuso coincidem', () => {
    expect(hojeNoFusoInstitucional(new Date('2026-03-20T15:00:00Z'))).toBe('2026-03-20');
  });

  it('formata como AAAA-MM-DD, comparável com as datas do contrato', () => {
    expect(hojeNoFusoInstitucional(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });
});

describe('janela como instante, não como hora de parede', () => {
  /**
   * O campo devolve `AAAA-MM-DDTHH:mm` sem fuso. Lê-lo no fuso do navegador
   * faria "8h em Belém" virar o que forem 8h onde a pessoa está — e o prazo
   * publicado passaria a valer em outro momento do que se declarou.
   */
  it('carimba a hora digitada com o deslocamento do fuso institucional', () => {
    expect(instanteDoCampo('2026-03-20T08:00')).toBe('2026-03-20T08:00:00-03:00');
  });

  it('ida e volta preserva a hora que o operador digitou', () => {
    const digitado = '2026-07-15T23:59';
    const instante = instanteDoCampo(digitado);

    expect(instante).not.toBeNull();
    expect(campoDoInstante(instante as string)).toBe(digitado);
  });

  /**
   * O instante gravado pode chegar em qualquer deslocamento — inclusive `Z`.
   * O campo mostra a hora de parede do certame, que é como ela foi declarada.
   */
  it('exibe o instante recebido em UTC como hora do fuso institucional', () => {
    expect(campoDoInstante('2026-03-20T11:00:00Z')).toBe('2026-03-20T08:00');
  });

  it('recusa valor fora do formato do campo, em vez de inventar instante', () => {
    expect(instanteDoCampo('')).toBeNull();
    expect(instanteDoCampo('20/03/2026 08:00')).toBeNull();
    expect(instanteDoCampo('2026-03-20')).toBeNull();
  });

  it('devolve texto vazio para instante ilegível, sem quebrar a tela', () => {
    expect(campoDoInstante('nem data')).toBe('');
  });
});
