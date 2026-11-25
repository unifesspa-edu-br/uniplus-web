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

  it('exige o termo na versão mais nova, com código do nome sem acento e sem repetir o de outro termo', () => {
    const comUm = acrescentarTermo(conteudo({}), lgpd);
    const comDois = acrescentarTermo(comUm, { ...lgpd, termoId: 'T2' });

    expect(comDois.termos?.map((t) => [t.codigo, t.termo.versaoId, t.ordem])).toEqual([
      ['CONSENTIMENTO_A_LGPD', 'V2', 0],
      ['CONSENTIMENTO_A_LGPD_2', 'V2', 1],
    ]);
  });

  it('o termo novo vem depois da maior ordem gravada, mesmo com buraco na numeração', () => {
    const gravado = conteudo({
      termos: [
        {
          codigo: 'A',
          ordem: 2,
          termo: { termoId: 'TA', versaoId: 'VA' },
          regras: { exibicao: null, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } },
        },
      ],
    });

    expect(acrescentarTermo(gravado, lgpd).termos?.at(-1)?.ordem).toBe(3);
  });
});
