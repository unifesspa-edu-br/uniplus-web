import { describe, expect, it } from 'vitest';

import { segmentosDoPonteiro } from './segmentos-do-ponteiro';

describe('segmentosDoPonteiro', () => {
  it('lê o ponteiro vazio como a raiz, sem segmentos', () => {
    expect(segmentosDoPonteiro('')).toEqual({ lido: true, segmentos: [] });
  });

  it('separa o ponteiro nos segmentos entre as barras', () => {
    expect(segmentosDoPonteiro('/fases/0/regraRecurso/procedimentos/1/regra')).toEqual({
      lido: true,
      segmentos: ['fases', '0', 'regraRecurso', 'procedimentos', '1', 'regra'],
    });
  });

  it('lê a barra sozinha como um único segmento vazio', () => {
    expect(segmentosDoPonteiro('/')).toEqual({ lido: true, segmentos: [''] });
  });

  it('mantém o segmento vazio entre barras seguidas', () => {
    expect(segmentosDoPonteiro('/a//b')).toEqual({ lido: true, segmentos: ['a', '', 'b'] });
  });

  it('decodifica ~1 como barra e ~0 como til', () => {
    expect(segmentosDoPonteiro('/entrega~1saida/ate~0agora')).toEqual({
      lido: true,
      segmentos: ['entrega/saida', 'ate~agora'],
    });
  });

  it('decodifica ~1 antes de ~0, de modo que ~01 vira ~1 e não barra', () => {
    expect(segmentosDoPonteiro('/~01')).toEqual({ lido: true, segmentos: ['~1'] });
  });

  it('decodifica várias ocorrências do mesmo escape no segmento', () => {
    expect(segmentosDoPonteiro('/~0~0~1~1')).toEqual({ lido: true, segmentos: ['~~//'] });
  });

  it('recusa o ponteiro que não começa com barra', () => {
    expect(segmentosDoPonteiro('fases/0')).toEqual({ lido: false, recusa: 'semBarraInicial' });
  });

  it.each(['/fases/~', '/fases/~2', '/~a/0', '/fases/0~'])(
    'recusa o escape de til inválido em %s',
    (ponteiro) => {
      expect(segmentosDoPonteiro(ponteiro)).toEqual({ lido: false, recusa: 'escapeInvalido' });
    },
  );
});
