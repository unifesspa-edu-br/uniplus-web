import { describe, expect, it } from 'vitest';

import { atalhosDoAcompanhamento } from './atalhos-do-acompanhamento';

const com = (status: string) => ({ id: 'p1', status });
const rotulos = (status: string, pode: boolean) =>
  atalhosDoAcompanhamento(com(status), pode).map((a) => a.rotulo);

describe('atalhosDoAcompanhamento', () => {
  it('sem a permissão de configurar não oferece nada', () => {
    expect(rotulos('publicado', false)).toEqual([]);
  });

  it.each(['publicado', 'encerrado', 'cancelado'])('%s oferece editar e publicações', (status) => {
    expect(rotulos(status, true)).toEqual(['Editar processo', 'Publicações']);
  });

  it.each(['rascunho', 'nenhum', 'desconhecido'])('%s oferece só editar', (status) => {
    expect(rotulos(status, true)).toEqual(['Editar processo']);
  });

  it('aponta para as rotas do editor e das publicações', () => {
    const destinos = atalhosDoAcompanhamento(com('publicado'), true).map((a) => a.destino);
    expect(destinos).toEqual([
      ['/processo-seletivo', 'p1'],
      ['/processo-seletivo', 'p1', 'publicacoes'],
    ]);
  });
});
