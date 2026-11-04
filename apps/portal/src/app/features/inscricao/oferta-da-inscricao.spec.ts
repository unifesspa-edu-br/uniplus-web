import { describe, expect, it } from 'vitest';

import {
  escolhaInicialDeOfertas,
  numeroDeOpcoesDeCurso,
  ofertasDaInscricao,
} from './oferta-da-inscricao';

const oferta = (id: string, curso: string) => ({
  ofertaCursoOrigemId: id,
  cursoNome: curso,
  cursoGrau: 'Bacharelado',
  unidadeOfertanteNome: 'Campus Marabá',
  turnos: ['MATUTINO', 'VESPERTINO'],
});

describe('ofertas da inscrição', () => {
  it('as ofertas saem da versão fixada da inscrição, em ordem alfabética', () => {
    const ofertas = ofertasDaInscricao({
      ofertas: [oferta('oferta-2', 'Medicina'), oferta('oferta-1', 'Direito')],
    });

    expect(ofertas.map((o) => o.id)).toEqual(['oferta-1', 'oferta-2']);
  });

  it('o número de opções é 2 só quando a versão fixada admite 2', () => {
    expect(numeroDeOpcoesDeCurso(2)).toBe(2);
    expect(numeroDeOpcoesDeCurso(1)).toBe(1);
  });

  describe('escolha com que a tela abre', () => {
    const ofertas = [
      { id: 'oferta-1', nome: 'Direito' },
      { id: 'oferta-2', nome: 'Medicina' },
    ];
    const gravada = (primeira: string | null, segunda: string | null) => ({
      ofertaCursoId: primeira,
      ofertaCursoSegundaOpcaoId: segunda,
    });

    it('com uma oferta só, ela é a escolha mesmo que a gravada seja de outra que saiu do processo', () => {
      const unica = [ofertas[0]];

      expect(escolhaInicialDeOfertas(gravada('oferta-9', null), unica, 1).oferta).toBe('oferta-1');
    });

    it('a oferta gravada que saiu do processo não vale, e a 2ª opção cai junto', () => {
      expect(escolhaInicialDeOfertas(gravada('oferta-9', 'oferta-2'), ofertas, 2)).toEqual({
        oferta: null,
        segunda: null,
      });
    });

    it('a 2ª opção só vale com 2 opções admitidas e sendo outra oferta', () => {
      expect(escolhaInicialDeOfertas(gravada('oferta-1', 'oferta-2'), ofertas, 2).segunda).toBe(
        'oferta-2',
      );
      expect(
        escolhaInicialDeOfertas(gravada('oferta-1', 'oferta-2'), ofertas, 1).segunda,
      ).toBeNull();
      expect(
        escolhaInicialDeOfertas(gravada('oferta-1', 'oferta-1'), ofertas, 2).segunda,
      ).toBeNull();
    });
  });
});
