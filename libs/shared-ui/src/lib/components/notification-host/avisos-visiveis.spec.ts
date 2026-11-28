import { describe, expect, it } from 'vitest';
import type { Notification } from '@uniplus/shared-core/notifications';

import { destinoDoFoco, dividirAvisos } from './avisos-visiveis';

function fila(quantidade: number): Notification[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    id: i + 1,
    type: 'info',
    title: `Aviso ${i + 1}`,
    persistent: true,
    ocorrencias: 1,
    identificadoresAnteriores: [],
  }));
}

const ids = (avisos: readonly Notification[]): number[] => avisos.map((aviso) => aviso.id);

describe('dividirAvisos', () => {
  it('deixa à vista os mais novos e recolhe os mais antigos', () => {
    const divisao = dividirAvisos(fila(5), 3);
    expect(ids(divisao.visiveis)).toEqual([3, 4, 5]);
    expect(ids(divisao.recolhidos)).toEqual([1, 2]);
  });

  it('não recolhe nada quando a fila cabe no limite', () => {
    const divisao = dividirAvisos(fila(2), 3);
    expect(ids(divisao.visiveis)).toEqual([1, 2]);
    expect(divisao.recolhidos).toEqual([]);
  });

  it('com limite 1 só o mais novo fica à vista', () => {
    expect(ids(dividirAvisos(fila(3), 1).visiveis)).toEqual([3]);
  });
});

describe('destinoDoFoco', () => {
  it('vai ao aviso que seguia o fechado', () => {
    expect(destinoDoFoco(fila(3), 1, 3, false)).toEqual({ tipo: 'aviso', id: 2 });
  });

  it('vai ao anterior quando o fechado era o último', () => {
    expect(destinoDoFoco(fila(3), 3, 3, false)).toEqual({ tipo: 'aviso', id: 2 });
  });

  it('vai ao "Mais N" quando o fechado era o único à vista e ainda há recolhidos', () => {
    expect(destinoDoFoco(fila(3), 3, 1, false)).toEqual({ tipo: 'mais-avisos' });
  });

  it('vai ao aviso que passou a ficar à vista quando não resta "Mais N"', () => {
    expect(destinoDoFoco(fila(2), 2, 1, false)).toEqual({ tipo: 'aviso', id: 1 });
  });

  it('vai ao aviso recolhido seguinte quando a lista está aberta', () => {
    expect(destinoDoFoco(fila(4), 1, 1, true)).toEqual({ tipo: 'aviso', id: 2 });
  });

  it('vai ao conteúdo principal quando não sobra aviso', () => {
    expect(destinoDoFoco(fila(1), 1, 3, false)).toEqual({ tipo: 'principal' });
  });
});
