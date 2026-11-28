import { describe, expect, it } from 'vitest';
import type { ReferenciaAoSuporte } from '../http/referencia-ao-suporte';
import { incluirNaFila } from './agrupamento-de-avisos';
import type { Notification } from './notification.service';

function servidor(codigo: string | null, pedido: string | null): ReferenciaAoSuporte {
  return { origem: 'servidor', codigoDoErro: codigo, identificadorDoPedido: pedido };
}

function aviso(id: number, parcial: Partial<Notification> = {}): Notification {
  return {
    id,
    type: 'error',
    title: 'Falha ao salvar',
    persistent: true,
    ocorrencias: 1,
    identificadoresAnteriores: [],
    ...parcial,
  };
}

describe('incluirNaFila', () => {
  it('inclui o aviso novo no fim quando a chave é diferente', () => {
    const { fila, repetido } = incluirNaFila([aviso(1)], aviso(2, { title: 'Outro' }));
    expect(repetido).toBe(false);
    expect(fila.map((a) => a.id)).toEqual([1, 2]);
  });

  it('agrupa o mesmo tipo, título e código do erro, mantendo o id do primeiro', () => {
    const existente = aviso(1, { referencia: servidor('a.b', null) });
    const { fila, repetido } = incluirNaFila(
      [existente],
      aviso(2, { referencia: servidor('a.b', null) }),
    );
    expect(repetido).toBe(true);
    expect(fila).toHaveLength(1);
    expect(fila[0].id).toBe(1);
    expect(fila[0].ocorrencias).toBe(2);
  });

  it('não agrupa título igual com código diferente', () => {
    const { fila } = incluirNaFila(
      [aviso(1, { referencia: servidor('a.b', null) })],
      aviso(2, { referencia: servidor('a.c', null) }),
    );
    expect(fila).toHaveLength(2);
  });

  it('não agrupa tipo diferente', () => {
    const { fila } = incluirNaFila([aviso(1)], aviso(2, { type: 'warning' }));
    expect(fila).toHaveLength(2);
  });

  it('agrupa quando os dois não têm código', () => {
    const { fila } = incluirNaFila([aviso(1)], aviso(2));
    expect(fila).toHaveLength(1);
  });

  it('trata código da tela como código do erro', () => {
    const tela: ReferenciaAoSuporte = { origem: 'tela', codigo: 'tela.x' };
    expect(
      incluirNaFila([aviso(1, { referencia: tela })], aviso(2, { referencia: tela })).repetido,
    ).toBe(true);
  });

  it('leva o grupo para o fim, com detalhe e referência da última ocorrência', () => {
    const fila = [aviso(1, { detail: 'a' }), aviso(2, { title: 'Outro' })];
    const resultado = incluirNaFila(
      fila,
      aviso(3, { detail: 'b', referencia: servidor(null, 'p'.repeat(32)) }),
    );
    expect(resultado.fila.map((a) => a.id)).toEqual([2, 1]);
    expect(resultado.fila[1].detail).toBe('b');
  });

  it('guarda o identificador anterior sem duplicar nem aceitar vazio', () => {
    const id1 = 'a'.repeat(32);
    const id2 = 'b'.repeat(32);
    let fila: readonly Notification[] = [aviso(1, { referencia: servidor(null, id1) })];
    fila = incluirNaFila(fila, aviso(2, { referencia: servidor(null, id2) })).fila;
    fila = incluirNaFila(fila, aviso(3, { referencia: servidor(null, id1) })).fila;
    fila = incluirNaFila(fila, aviso(4, { referencia: servidor(null, '') })).fila;
    expect(fila[0].identificadoresAnteriores).toEqual([id2, id1]);
    expect(fila[0].ocorrencias).toBe(4);
  });
});
