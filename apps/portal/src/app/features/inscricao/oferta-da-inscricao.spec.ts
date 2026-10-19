import { describe, expect, it } from 'vitest';

import { nomeDaOferta, numeroDeOpcoesDaInscricao, ofertasDaInscricao } from './oferta-da-inscricao';

const oferta = (id: string, curso: string) => ({
  ofertaCursoOrigemId: id,
  cursoNome: curso,
  cursoGrau: 'Bacharelado',
  unidadeOfertanteNome: 'Campus Marabá',
  turnos: ['MATUTINO', 'VESPERTINO'],
});

describe('ofertas da inscrição', () => {
  it('o nome congela curso, grau, unidade e o rótulo dos turnos', () => {
    expect(nomeDaOferta(oferta('oferta-1', 'Medicina'))).toBe(
      'Medicina (Bacharelado) — Campus Marabá — Matutino e Vespertino',
    );
  });

  it('as ofertas saem da versão fixada da inscrição, em ordem alfabética', () => {
    const ofertas = ofertasDaInscricao({
      ofertas: [oferta('oferta-2', 'Medicina'), oferta('oferta-1', 'Direito')],
    });

    expect(ofertas.map((o) => o.id)).toEqual(['oferta-1', 'oferta-2']);
  });

  it('o número de opções é 2 só quando a versão fixada admite 2', () => {
    expect(numeroDeOpcoesDaInscricao({ numeroDeOpcoesDeCurso: 2 })).toBe(2);
    expect(numeroDeOpcoesDaInscricao({ numeroDeOpcoesDeCurso: '2' })).toBe(2);
    expect(numeroDeOpcoesDaInscricao({ numeroDeOpcoesDeCurso: 1 })).toBe(1);
  });
});
