import { describe, expect, it } from 'vitest';
import { avisosDosGrupos } from './conferencia-das-exigencias-declaradas';

describe('o que a publicação vai cobrar dos grupos', () => {
  /**
   * Aviso, não impedimento. A norma de um grupo não se edita no wizard — bloquear a gravação
   * por causa dela prenderia o passo sem saída, e a única fuga seria remover os documentos do
   * grupo um a um até ele desaparecer, destruindo a configuração. Quem recusa é a publicação.
   */
  it('avisa sobre o grupo que decide o resultado sem norma, nomeando o que ele reúne', () => {
    const avisos = avisosDosGrupos([
      { decideResultado: true, normaResolvida: false, documentos: ['Contracheque', 'Extrato'] },
    ]);

    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('Contracheque, Extrato');
    expect(avisos[0]).toContain('A publicação vai cobrá-la.');
  });

  it('não avisa sobre grupo com norma resolvida nem sobre grupo transparente', () => {
    expect(
      avisosDosGrupos([
        { decideResultado: true, normaResolvida: true, documentos: ['Contracheque'] },
        { decideResultado: false, normaResolvida: false, documentos: ['Extrato'] },
      ]),
    ).toEqual([]);
  });

  /** Sem documentos nomeáveis a frase não pode terminar em "reúne ." */
  it('avisa mesmo quando não há documento a nomear', () => {
    const avisos = avisosDosGrupos([
      { decideResultado: true, normaResolvida: false, documentos: [] },
    ]);

    expect(avisos[0]).not.toContain('reúne');
    expect(avisos[0]).toContain('A publicação vai cobrá-la.');
  });
});
