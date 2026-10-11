import { describe, expect, it } from 'vitest';
import { termoDisponivelDe } from './termos-disponiveis';

const versao = (id: string, promovidaEm: string) => ({ id, promovidaEm });

describe('termoDisponivelDe', () => {
  it('oferece a versão promovida mais nova primeiro, que é a do termo recém-exigido', () => {
    const termo = { id: 'T1', nome: 'Consentimento LGPD', versoes: [versao('V1', '2026-08-01T12:00:00Z'), versao('V2', '2026-09-15T12:00:00Z')] };

    expect(termoDisponivelDe(termo).versoes.map((v) => v.versaoId)).toEqual(['V2', 'V1']);
  });

  /**
   * Em 01/12/2018, 02:30 UTC ainda era 30/11 em Belém e já era 01/12 em São Paulo, que observava
   * horário de verão: o rótulo da versão não pode depender do fuso de quem abre o editor.
   */
  it('nomeia a versão pela data da promoção no fuso institucional', () => {
    const termo = { id: 'T1', nome: 'Consentimento LGPD', versoes: [versao('V1', '2018-12-01T02:30:00Z')] };

    expect(termoDisponivelDe(termo).versoes[0].rotulo).toBe('Versão de 30/11/2018, 23:30');
  });
});
