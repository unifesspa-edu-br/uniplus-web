import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from './processo-seletivo.store';

function classificacaoCom(peso: number): ProcessoSeletivoDto['classificacao'] {
  return {
    resolucaoPesoAreaEnem: 'Resolução nº 805/2024/Consepe',
    quadroPesoAreaEnem: [
      {
        grupoAreaEnem: { codigo: 'G', rotulo: 'Grupo' },
        baseLegal: 'Anexo I',
        areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso, corte: null }],
      },
    ],
  } as unknown as ProcessoSeletivoDto['classificacao'];
}

describe('ProcessoSeletivoStore — versão da classificação lida', () => {
  it('muda quando a leitura traz outro quadro', () => {
    const store = new ProcessoSeletivoStore();
    store.registrarClassificacaoLida(classificacaoCom(1));
    const antes = store.versaoDaClassificacaoLida();

    store.registrarClassificacaoLida(classificacaoCom(2));

    expect(store.versaoDaClassificacaoLida()).toBe(antes + 1);
  });

  it('não muda quando a leitura só confirma a cópia presumida', () => {
    const store = new ProcessoSeletivoStore();
    store.registrarClassificacaoLida(classificacaoCom(1));
    const confirmada = store.classificacaoGravada();
    if (confirmada.estado !== 'com-quadro') throw new Error('cópia esperada');
    store.registrarClassificacaoGravadaComQuadro(confirmada.resolucao, confirmada.grupos);
    const antes = store.versaoDaClassificacaoLida();

    store.registrarClassificacaoLida(classificacaoCom(1));

    expect(store.versaoDaClassificacaoLida()).toBe(antes);
    expect(store.motivoDaReleituraDaClassificacao()).not.toBe('por-confirmar');
  });
});
