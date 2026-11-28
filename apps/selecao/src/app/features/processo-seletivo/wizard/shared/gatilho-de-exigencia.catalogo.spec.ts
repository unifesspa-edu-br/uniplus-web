import { describe, expect, it } from 'vitest';

import { dominiosDoGatilho, fatosParaGatilho, rotulosDoGatilho } from './gatilho-de-exigencia';
import { fatosParaLerOGatilho } from './documentos-exigidos';
import { VALORES_MODALIDADE } from './valores-do-catalogo.testing';
import {
  CATALOGO,
  FAIXA_ETARIA,
  MODALIDADE,
  SEXO,
  escolhivel,
  view,
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

describe('rótulo das modalidades nos fatos do gatilho', () => {
  const DA_CONVOCACAO = view({
    codigo: 'MODALIDADE_CONVOCACAO',
    nome: 'Modalidade da convocação',
    fonteValores: VALORES_MODALIDADE,
  });
  const CATALOGO_DE_MODALIDADES = [...CATALOGO, DA_CONVOCACAO];
  const ROTULOS = new Map([['ZZ_TESTE', 'ZZ_TESTE — Modalidade de teste Alfa']]);

  it('só os fatos cujos valores são modalidades recebem o rótulo, pelo código do fato', () => {
    const rotulos = rotulosDoGatilho(CATALOGO_DE_MODALIDADES, ROTULOS);

    expect([...rotulos.keys()]).not.toContain('SEXO');
    expect(rotulos.get('MODALIDADE_CONVOCACAO')).toBe(ROTULOS);
  });

  it('o editor mostra o rótulo e guarda o código como valor', () => {
    const dominios = dominiosDoGatilho(CATALOGO_DE_MODALIDADES, [], ['ZZ_TESTE', 'ZZ_SEM_NOME']);
    const rotulos = rotulosDoGatilho(CATALOGO_DE_MODALIDADES, ROTULOS);

    const fato = fatosParaGatilho(CATALOGO_DE_MODALIDADES, dominios, rotulos).find(
      (f) => f.codigo === 'MODALIDADE_CONVOCACAO',
    );

    expect(fato?.valores).toEqual(['ZZ_TESTE', 'ZZ_SEM_NOME']);
    expect(fato?.rotulos?.get('ZZ_TESTE')).toBe('ZZ_TESTE — Modalidade de teste Alfa');
    expect(fato?.rotulos?.get('ZZ_SEM_NOME')).toBeUndefined();
  });

  it('sem rótulos, os fatos ficam como o catálogo os declara', () => {
    const fato = fatosParaGatilho(
      CATALOGO_DE_MODALIDADES,
      new Map([['MODALIDADE_CONVOCACAO', ['ZZ_TESTE']]]),
    ).find((f) => f.codigo === 'MODALIDADE_CONVOCACAO');

    expect(fato?.rotulos).toBeUndefined();
  });

  it('o vocabulário de leitura dos documentos também leva o rótulo', () => {
    const fatos = fatosParaLerOGatilho(CATALOGO_DE_MODALIDADES, [], ['ZZ_TESTE'], ROTULOS);

    expect(fatos.get('MODALIDADE_CONVOCACAO')?.rotulos).toBe(ROTULOS);
  });
});
