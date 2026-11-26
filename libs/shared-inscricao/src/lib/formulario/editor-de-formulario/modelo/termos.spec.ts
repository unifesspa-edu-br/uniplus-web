import { describe, expect, it } from 'vitest';

import { conteudo } from './conteudos-de-exemplo.testing';
import { acrescentarTermo } from './termos';

describe('acrescentarTermo', () => {
  const lgpd = {
    termoId: 'T1',
    nome: 'Consentimento à LGPD',
    versoes: [
      { versaoId: 'V2', rotulo: 'nova' },
      { versaoId: 'V1', rotulo: 'antiga' },
    ],
  };

  it('escreve por extenso o número inicial', () => {
    const resultado = acrescentarTermo(conteudo({}), { ...lgpd, nome: '21 de abril' });
    expect(resultado.ok && resultado.conteudo.termos?.[0].codigo).toBe('VINTE_E_UM_DE_ABRIL');
  });

  it('aceita código com 60 caracteres sem cortar', () => {
    const resultado = acrescentarTermo(conteudo({}), { ...lgpd, nome: 'a'.repeat(60) });
    expect(resultado.ok && resultado.conteudo.termos?.[0].codigo).toBe('A'.repeat(60));
  });

  it('recusa código com 61 caracteres sem repetir o nome', () => {
    expect(acrescentarTermo(conteudo({}), { ...lgpd, nome: 'a'.repeat(61) })).toEqual({
      ok: false,
      recusa:
        'O código formado a partir do nome deste termo passaria de 60 caracteres, e o termo não pode ser exigido. O nome é definido no cadastro de termos de consentimento.',
    });
  });

  it('recusa quando o sufixo ultrapassa o limite', () => {
    const primeiro = acrescentarTermo(conteudo({}), { ...lgpd, nome: 'a'.repeat(60) });
    if (!primeiro.ok) throw new Error(primeiro.recusa);
    expect(
      acrescentarTermo(primeiro.conteudo, { ...lgpd, termoId: 'T2', nome: 'a'.repeat(60) }).ok,
    ).toBe(false);
  });

  it('exige o termo na versão mais nova, com código do nome sem acento e sem repetir o de outro termo', () => {
    const comUm = acrescentarTermo(conteudo({}), lgpd);
    if (!comUm.ok) throw new Error(comUm.recusa);
    const comDois = acrescentarTermo(comUm.conteudo, { ...lgpd, termoId: 'T2' });

    expect(
      comDois.ok && comDois.conteudo.termos?.map((t) => [t.codigo, t.termo.versaoId, t.ordem]),
    ).toEqual([
      ['CONSENTIMENTO_A_LGPD', 'V2', 0],
      ['CONSENTIMENTO_A_LGPD_2', 'V2', 1],
    ]);
  });

  it('o termo novo vem depois da maior ordem gravada, mesmo com buraco na numeração', () => {
    const resultado = acrescentarTermo(conteudoComTermoGravado(), lgpd);
    expect(resultado.ok && resultado.conteudo.termos?.at(-1)?.ordem).toBe(3);
  });
});

function conteudoComTermoGravado() {
  return conteudo({
    termos: [
      {
        codigo: 'A',
        ordem: 2,
        termo: { termoId: 'TA', versaoId: 'VA' },
        regras: { exibicao: null, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } },
      },
    ],
  });
}
