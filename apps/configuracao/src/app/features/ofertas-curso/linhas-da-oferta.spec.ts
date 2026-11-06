import { describe, expect, it } from 'vitest';
import { montarLinhas } from './linhas-da-oferta';
import { engCiv, maraba, oferta } from './ofertas-curso.testing';

const resolvedor = {
  cursoDaOferta: () => ({ estado: 'resolvido', rotulo: engCiv.nome }) as never,
  grauDoCurso: () => engCiv.grau,
  localDaOferta: () =>
    ({ estado: 'resolvido', rotulo: `Campus sede — ${maraba.cidade.nome}` }) as never,
};

describe('linhas da oferta', () => {
  it('monta o nome acessível com curso, unidade, local, programa e turnos', () => {
    const [linha] = montarLinhas([oferta], resolvedor);
    expect(linha.oferta).toBe(oferta);
    expect(linha.grau).toBe('Bacharelado');
    expect(linha.identificador).toContain('IGE');
    expect(linha.identificador).toContain('Regular');
    expect(linha.identificador).toContain('Matutino');
  });

  it('acrescenta o ordinal só quando o nome se repete', () => {
    const outra = {
      ...oferta,
      id: 'outra',
      unidadeOfertante: { ...oferta.unidadeOfertante, sigla: 'ICH' },
    };
    const linhas = montarLinhas([oferta, { ...oferta, id: 'dupla' }, outra], resolvedor);
    const nomes = linhas.map((linha) => linha.identificador);
    expect(nomes[0]).toMatch(/\(1 de 2\)$/);
    expect(nomes[1]).toMatch(/\(2 de 2\)$/);
    expect(nomes[2]).not.toMatch(/\(\d de \d\)$/);
  });
});
