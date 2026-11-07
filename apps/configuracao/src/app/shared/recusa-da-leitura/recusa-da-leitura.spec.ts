import { describe, expect, it } from 'vitest';

import { recusaDe, tituloDaRecusa } from './recusa-da-leitura';

const problema = (status: number) => ({
  type: 'about:blank',
  title: 'x',
  status,
  code: 'uniplus.x',
  traceId: '',
});

describe('recusa da leitura', () => {
  it('o 404 leva o título que nomeia o que não foi encontrado', () => {
    expect(tituloDaRecusa(404, 'Pedido não encontrado')).toBe('Pedido não encontrado');
  });

  it('o 401 e o 403, que a tela deixa em seguida, não dizem que algo não foi encontrado', () => {
    expect(tituloDaRecusa(401, 'Pedido não encontrado')).toBe('Sessão encerrada');
    expect(tituloDaRecusa(403, 'Pedido não encontrado')).toBe('Acesso negado');
  });

  it('só a recusa definitiva vira recusa, com o status que a explica', () => {
    expect(recusaDe(problema(404), 'texto')).toEqual({ texto: 'texto', status: 404 });
    expect(recusaDe(problema(503), 'texto')).toBeNull();
    expect(recusaDe(null, 'texto')).toBeNull();
  });
});
