import { describe, expect, it } from 'vitest';

import { fatosParaGatilho } from './gatilho-de-exigencia';
import {
  CATALOGO,
  FAIXA_ETARIA,
  MODALIDADE,
  SEXO,
  escolhivel,
} from './gatilho-de-exigencia.testing';

describe('o catálogo na forma que a tela oferece', () => {
  it('categórico com valores declarados é estático; sem eles, dinâmico', () => {
    expect(escolhivel(SEXO).tipoDominio).toBe('CATEGORICO_ESTATICO');
    expect(escolhivel(MODALIDADE).tipoDominio).toBe('CATEGORICO_DINAMICO');
  });

  it('só é coletável o fato perguntado ao candidato na inscrição', () => {
    expect(escolhivel(SEXO).coletavel).toBe(true);
    expect(escolhivel(FAIXA_ETARIA).coletavel).toBe(false);
    expect(escolhivel(MODALIDADE).coletavel).toBe(false);
  });

  /**
   * A modalidade tem controle próprio — "quem deve entregar" — alimentado pelo quadro de
   * vagas. Oferecê-la aqui deixaria duas telas escrevendo a mesma cláusula.
   */
  it('a modalidade não entra no editor de gatilho', () => {
    const codigos = fatosParaGatilho(CATALOGO).map((fato) => fato.codigo);
    expect(codigos).not.toContain('MODALIDADE');
  });

  /**
   * O domínio dinâmico vem do que o processo oferta, não de um catálogo global — é o que o
   * servidor confere. Sem saber a oferta, a tela proporia valor que a gravação recusaria.
   */
  it('fato de domínio dinâmico só é oferecido quando o processo declara o que oferta', () => {
    expect(fatosParaGatilho(CATALOGO).map((f) => f.codigo)).not.toContain('CONDICAO_ATENDIMENTO');

    const comOferta = fatosParaGatilho(
      CATALOGO,
      new Map([['CONDICAO_ATENDIMENTO', ['TEMPO_ADICIONAL', 'LEITOR']]]),
    );
    expect(comOferta.find((f) => f.codigo === 'CONDICAO_ATENDIMENTO')?.valores).toEqual([
      'TEMPO_ADICIONAL',
      'LEITOR',
    ]);
  });
});
