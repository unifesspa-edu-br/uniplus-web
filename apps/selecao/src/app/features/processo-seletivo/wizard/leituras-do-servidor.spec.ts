import { TestBed } from '@angular/core/testing';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { registrarGravadoLido } from './leituras-do-servidor';
import { ProcessoSeletivoStore } from './processo-seletivo.store';

const detalheComEdicoes = (anos: readonly string[]): ProcessoSeletivoDto =>
  ({
    classificacao: null,
    criteriosDesempate: [],
    opcoesDeclaradas: [
      {
        fatoCodigo: 'EDICAO_ENEM',
        opcoes: anos.map((codigo, ordem) => ({ codigo, rotulo: `ENEM ${codigo}`, ordem })),
      },
    ],
  }) as unknown as ProcessoSeletivoDto;

describe('registrarGravadoLido', () => {
  it('toda leitura do processo diz quais edições do ENEM o servidor tem', () => {
    const store = TestBed.configureTestingModule({
      providers: [ProcessoSeletivoStore],
    }).inject(ProcessoSeletivoStore);

    registrarGravadoLido(store, detalheComEdicoes(['2024', '2026']));
    expect(store.classificacao.edicoesGravadas()).toEqual(['2024', '2026']);

    registrarGravadoLido(store, detalheComEdicoes([]));
    expect(store.classificacao.edicoesGravadas()).toEqual([]);
  });

  it('a leitura depois de uma gravação sem resposta conclusiva restaura as edições', () => {
    const store = TestBed.configureTestingModule({
      providers: [ProcessoSeletivoStore],
    }).inject(ProcessoSeletivoStore);
    store.classificacao.edicoesGravadas.set(null);

    registrarGravadoLido(store, detalheComEdicoes(['2024']));

    expect(store.classificacao.edicoesGravadas()).toEqual(['2024']);
  });
});
