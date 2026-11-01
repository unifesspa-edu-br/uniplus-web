import { describe, expect, it } from 'vitest';

import { nomeDaOferta } from './nome-da-oferta';

const oferta = (turnos: readonly string[]) => ({
  ofertaCursoOrigemId: 'oferta-1',
  cursoNome: 'Medicina',
  cursoGrau: 'Bacharelado',
  unidadeOfertanteNome: 'Campus Marabá',
  turnos,
});

describe('nomeDaOferta', () => {
  it('congela curso, grau, unidade e o rótulo dos turnos', () => {
    expect(nomeDaOferta(oferta(['MATUTINO', 'VESPERTINO']))).toBe(
      'Medicina (Bacharelado) — Campus Marabá — Matutino e Vespertino',
    );
  });

  it('mantém o turno que o catálogo não rotula como veio', () => {
    expect(nomeDaOferta(oferta(['INTEGRAL']))).toBe(
      'Medicina (Bacharelado) — Campus Marabá — INTEGRAL',
    );
  });
});
