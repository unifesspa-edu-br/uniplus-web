import { describe, expect, it } from 'vitest';

import {
  campoDoInstante,
  hojeNoFusoInstitucional,
  instanteDoCampo,
  instanteLegivel,
  inicioDeHojeNoFusoInstitucional,
  pisoDoCampoDeData,
} from './fuso-institucional';

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

describe('o piso dos campos de data e hora', () => {
  const HOJE = '2026-09-16T00:00';

  it('o piso de hoje sai do fuso de Belém, não do relógio do navegador', () => {
    // 22h em Belém é 01h do dia seguinte em UTC: quem usasse UTC ofereceria o dia 17.
    expect(inicioDeHojeNoFusoInstitucional(new Date('2026-09-17T01:00:00Z'))).toBe(HOJE);
  });

  it('campo vazio recebe o limite mais tardio', () => {
    expect(pisoDoCampoDeData('', HOJE, '2026-10-01T08:00')).toBe('2026-10-01T08:00');
    expect(pisoDoCampoDeData('', '2026-08-01T08:00', HOJE)).toBe(HOJE);
  });

  it('sem limite algum, não impõe piso', () => {
    expect(pisoDoCampoDeData('', null, undefined, '')).toBeNull();
  });

  /**
   * O caso que a regra existe para não quebrar: certame publicado em janeiro, inscrição em
   * fevereiro, retificado em março. A data já ocorrida não pode ficar fora do intervalo do
   * próprio campo — senão a retificação seria impossível.
   */
  it('nunca invalida a data que o campo já carrega', () => {
    expect(pisoDoCampoDeData('2026-02-10T08:00', HOJE)).toBe('2026-02-10T08:00');
  });

  it('mantém o piso quando o valor atual já o respeita', () => {
    expect(pisoDoCampoDeData('2026-12-01T08:00', HOJE)).toBe(HOJE);
  });

  it('cede ao valor atual mesmo quando o limite vem de outro campo, não de hoje', () => {
    // Etapa que começou antes da fase num processo já em curso: o campo continua editável.
    expect(pisoDoCampoDeData('2026-02-01T08:00', HOJE, '2026-03-01T08:00')).toBe('2026-02-01T08:00');
  });
  /**
   * O prazo que termina às 23:59:59 é declaração comum. Truncá-lo para 23:59 encurtava a
   * janela a cada regravação — inclusive na varredura que a publicação faz dos passos
   * anteriores, sem ninguém ter editado nada.
   */
  it('preserva os segundos no ida e volta do campo', () => {
    const fimDoDia = '2027-03-15T23:59:59-03:00';

    const campo = campoDoInstante(fimDoDia);
    expect(campo).toBe('2027-03-15T23:59:59');
    expect(instanteDoCampo(campo)).toBe(fimDoDia);
  });

  /** Sem segundos, nada muda: é o valor que o campo devolve depois de editado. */
  it('mantém o campo sem segundos quando o instante não os tem', () => {
    const campo = campoDoInstante('2027-03-15T08:30:00-03:00');

    expect(campo).toBe('2027-03-15T08:30');
    expect(instanteDoCampo(campo)).toBe('2027-03-15T08:30:00-03:00');
  });

});


describe('instante para leitura', () => {
  it('mostra o instante em UTC como data e hora do fuso institucional', () => {
    expect(instanteLegivel('2026-12-10T03:00:00+00:00')).toBe('10/12/2026 às 00:00');
    expect(instanteLegivel('2027-01-11T02:59:00+00:00')).toBe('10/01/2027 às 23:59');
  });

  it('devolve o valor como veio quando não é instante', () => {
    expect(instanteLegivel('não é data')).toBe('não é data');
  });
});
