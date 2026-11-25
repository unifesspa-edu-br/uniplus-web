import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { atalhosDoAcompanhamento } from './atalhos-do-acompanhamento';

const com = (status: string) => ({
  id: 'p1',
  situacao: { codigo: status as SituacaoDoProcessoSeletivoCodigo, rotulo: status },
});
const rotulos = (status: string, pode: boolean) =>
  atalhosDoAcompanhamento(com(status), pode).map((a) => a.rotulo);

describe('atalhosDoAcompanhamento', () => {
  it('sem a permissão de configurar não oferece nada', () => {
    expect(rotulos('PUBLICADO', false)).toEqual([]);
  });

  it.each(['PUBLICADO', 'ENCERRADO', 'CANCELADO'])('%s oferece editar e publicações', (status) => {
    expect(rotulos(status, true)).toEqual(['Editar processo', 'Publicações']);
  });

  it.each(['RASCUNHO', 'nenhum', 'desconhecido'])('%s oferece só editar', (status) => {
    expect(rotulos(status, true)).toEqual(['Editar processo']);
  });

  it('aponta para as rotas do editor e das publicações', () => {
    const destinos = atalhosDoAcompanhamento(com('PUBLICADO'), true).map((a) => a.destino);
    expect(destinos).toEqual([
      ['/processo-seletivo', 'p1'],
      ['/processo-seletivo', 'p1', 'publicacoes'],
    ]);
  });
});
