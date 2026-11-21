import { describe, expect, it } from 'vitest';

import { umaEtapaDoCronograma, umRecursoDaEtapa } from '../../shared/etapa-do-cronograma.testing';
import {
  campoNasNovasPosicoes,
  listasDaEtapa,
  novasPosicoes,
  parteNasNovasPosicoes,
  recusaNasNovasPosicoes,
  todasNoLugar,
} from './posicao-viva-na-etapa';

const a = umRecursoDaEtapa({ prazoValor: '1' });
const b = umRecursoDaEtapa({ prazoValor: '2' });
const c = umRecursoDaEtapa({ prazoValor: '3' });

const recursos = (...lista: (typeof a)[]) =>
  listasDaEtapa(umaEtapaDoCronograma({ recursos: lista }));
const novas = (antes: (typeof a)[], depois: (typeof a)[]) =>
  novasPosicoes(recursos(...antes), recursos(...depois));

describe('novasPosicoes', () => {
  it('mantém as posições quando nada mudou', () => {
    const resultado = novas([a, b, c], [a, b, c]);

    expect(resultado.recursos).toEqual([0, 1, 2]);
    expect(todasNoLugar(resultado)).toBe(true);
  });

  it('leva os seguintes para trás quando o primeiro sai, e marca o que saiu', () => {
    expect(novas([a, b, c], [b, c]).recursos).toEqual([null, 0, 1]);
  });

  it('marca o que saiu quando é o do meio ou o último', () => {
    expect(novas([a, b, c], [a, c]).recursos).toEqual([0, null, 1]);
    expect(novas([a, b, c], [a, b]).recursos).toEqual([0, 1, null]);
  });

  it('mantém as posições quando só se acrescenta no fim', () => {
    const resultado = novas([a, b], [a, b, c]);

    expect(resultado.recursos).toEqual([0, 1]);
    expect(todasNoLugar(resultado)).toBe(true);
  });

  it('segue o item reordenado', () => {
    const resultado = novas([a, b, c], [c, a, b]);

    expect(resultado.recursos).toEqual([1, 2, 0]);
    expect(todasNoLugar(resultado)).toBe(false);
  });

  it('mantém na mesma posição o item editado no lugar', () => {
    const editado = { ...b, prazoValor: '9' };

    expect(novas([a, b, c], [a, editado, c]).recursos).toEqual([0, 1, 2]);
  });

  it('trata cada lista da etapa por si', () => {
    const itens = [{ id: null, rotulo: 'A', pontuacaoMaxima: '1' }];
    const antes = listasDaEtapa(umaEtapaDoCronograma({ itensDeAvaliacao: itens, recursos: [a] }));
    const depois = listasDaEtapa(umaEtapaDoCronograma({ itensDeAvaliacao: [], recursos: [a] }));

    const resultado = novasPosicoes(antes, depois);

    expect(resultado.itensDeAvaliacao).toEqual([null]);
    expect(resultado.recursos).toEqual([0]);
  });
});

describe('as bancas da etapa', () => {
  const primeira = {
    id: null,
    identificadorLocal: 'primeira',
    copiaDoTipo: null,
    tipoBancaId: 'primeira',
    regraDeDeliberacao: null,
  };
  const segunda = {
    id: null,
    identificadorLocal: 'segunda',
    copiaDoTipo: null,
    tipoBancaId: 'segunda',
    regraDeDeliberacao: null,
  };
  const bancas = (...lista: (typeof primeira)[]) =>
    listasDaEtapa(umaEtapaDoCronograma({ bancas: lista }));

  it('leva a banca seguinte para a posição da que saiu e marca a que saiu', () => {
    const resultado = novasPosicoes(bancas(primeira, segunda), bancas(segunda));

    expect(resultado.bancas).toEqual([null, 0]);
  });

  it('põe o campo da regra na posição de hoje da banca e descarta o da que saiu', () => {
    const resultado = novasPosicoes(bancas(primeira, segunda), bancas(segunda));

    expect(campoNasNovasPosicoes('bancas.1.quorum', resultado)).toBe('bancas.0.quorum');
    expect(campoNasNovasPosicoes('bancas.0.quorum', resultado)).toBeNull();
  });

  it('mantém na mesma posição a banca de regra editada no lugar', () => {
    const editada = { ...primeira };

    const resultado = novasPosicoes(bancas(primeira, segunda), bancas(editada, segunda));

    expect(resultado.bancas).toEqual([0, 1]);
  });
});

describe('campoNasNovasPosicoes', () => {
  const sai0 = novas([a, b, c], [b, c]);

  it('põe o campo na posição de hoje do item', () => {
    expect(campoNasNovasPosicoes('recursos.2.prazoValor', sai0)).toBe('recursos.1.prazoValor');
  });

  it('devolve null quando o item saiu', () => {
    expect(campoNasNovasPosicoes('recursos.0.prazoValor', sai0)).toBeNull();
  });

  it('deixa como está o campo que não é de item', () => {
    expect(campoNasNovasPosicoes('notaMaxima', sai0)).toBe('notaMaxima');
    expect(campoNasNovasPosicoes('', sai0)).toBe('');
  });
});

describe('parteNasNovasPosicoes e recusaNasNovasPosicoes', () => {
  const sai0 = novas([a, b], [b]);

  it('leva a parte do recurso para a posição de hoje e deixa a da etapa', () => {
    expect(parteNasNovasPosicoes({ recurso: 1 }, sai0)).toEqual({ recurso: 0 });
    expect(parteNasNovasPosicoes('etapa', sai0)).toBe('etapa');
  });

  it('devolve null para o recurso que saiu', () => {
    expect(parteNasNovasPosicoes({ recurso: 0 }, sai0)).toBeNull();
  });

  it('muda campo e parte juntos, e descarta a recusa do item que saiu', () => {
    const recusa = { campo: 'recursos.1.prazoValor', parte: { recurso: 1 }, mensagem: 'x' };

    expect(recusaNasNovasPosicoes(recusa, sai0)).toEqual({
      campo: 'recursos.0.prazoValor',
      parte: { recurso: 0 },
      mensagem: 'x',
    });
    expect(
      recusaNasNovasPosicoes(
        { ...recusa, campo: 'recursos.0.prazoValor', parte: { recurso: 0 } },
        sai0,
      ),
    ).toBeNull();
  });
});
