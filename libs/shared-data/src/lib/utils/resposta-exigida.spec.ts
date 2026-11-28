import { describe, expect, it } from 'vitest';

import { respostaExigida } from './resposta-exigida';

describe('respostaExigida', () => {
  it.each([true, false])('devolve a resposta %s como a pessoa escolheu', (resposta) => {
    expect(respostaExigida(resposta, 'a pergunta')).toBe(resposta);
  });

  it('interrompe quando a pergunta está em aberto e diz qual é', () => {
    expect(() => respostaExigida(null, 'se o ato é publicável')).toThrow(
      'O comando só é montado depois de responder se o ato é publicável.',
    );
  });
});
