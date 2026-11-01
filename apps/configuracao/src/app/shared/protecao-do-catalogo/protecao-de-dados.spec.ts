import { describe, expect, it } from 'vitest';
import { CLASSIFICACOES_DE_PROTECAO, hipotesesDaClassificacao, rotuloDe } from './protecao-de-dados';

describe('a hipótese legal que cabe na classificação', () => {
  it('a hipótese legal segue o artigo da classificação', () => {
    const sensivel = hipotesesDaClassificacao('SENSIVEL').map((h) => h.valor);
    const pessoal = hipotesesDaClassificacao('PESSOAL').map((h) => h.valor);
    expect(sensivel).toContain('PREVENCAO_A_FRAUDE');
    expect(sensivel).not.toContain('INTERESSE_LEGITIMO');
    expect(pessoal).toContain('INTERESSE_LEGITIMO');
    expect(pessoal).not.toContain('PREVENCAO_A_FRAUDE');
  });

  it('o identificador tem rótulo próprio e segue as hipóteses do art. 7º, como o dado pessoal', () => {
    expect(rotuloDe(CLASSIFICACOES_DE_PROTECAO, 'IDENTIFICADOR')).toBe('Identificador');
    const identificador = hipotesesDaClassificacao('IDENTIFICADOR').map((h) => h.valor);
    expect(identificador).toContain('INTERESSE_LEGITIMO');
    expect(identificador).not.toContain('PREVENCAO_A_FRAUDE');
  });
});
