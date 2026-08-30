import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { resolverVinculo } from './resolucao-de-vinculo';

interface Curso {
  readonly codigo: string;
}

const rotular = (curso: Curso): string => `Curso ${curso.codigo}`;

function lookupFake(estado: { comErro?: boolean; pendente?: boolean } = {}) {
  return {
    comErro: signal(estado.comErro ?? false).asReadonly(),
    pendente: signal(estado.pendente ?? false).asReadonly(),
  };
}

describe('resolverVinculo', () => {
  it('devolve o rótulo montado quando o item foi encontrado', () => {
    const resolucao = resolverVinculo(lookupFake(), { codigo: 'ENG-CIV' }, rotular);

    expect(resolucao).toEqual({ estado: 'resolvido', rotulo: 'Curso ENG-CIV' });
  });

  it('acusa a recusa do catálogo quando o item não veio', () => {
    const resolucao = resolverVinculo(lookupFake({ comErro: true }), undefined, rotular);

    expect(resolucao.estado).toBe('falhou');
    expect(resolucao.rotulo).toBe('');
  });

  it('acusa que o catálogo ainda não chegou quando o item não veio', () => {
    const resolucao = resolverVinculo(lookupFake({ pendente: true }), undefined, rotular);

    expect(resolucao.estado).toBe('carregando');
  });

  /**
   * O caso que "Vinculado" escondia junto com os outros dois: o catálogo
   * chegou inteiro e o id não está nele — não adianta esperar nem tentar de
   * novo, o vínculo é que está quebrado.
   */
  it('acusa ausência quando o catálogo chegou íntegro sem o item', () => {
    const resolucao = resolverVinculo(lookupFake(), undefined, rotular);

    expect(resolucao.estado).toBe('ausente');
  });

  /**
   * `lookupCompleto` preserva as opções da última busca boa, então apagar o
   * rótulo já resolvido por causa de uma nova tentativa seria uma regressão
   * visível na tela.
   */
  it('mantém o rótulo resolvido mesmo com uma nova tentativa em curso ou recusada', () => {
    const emAndamento = lookupFake({ pendente: true });
    const recusado = lookupFake({ comErro: true });
    const item = { codigo: 'ENG-CIV' };

    expect(resolverVinculo(emAndamento, item, rotular).estado).toBe('resolvido');
    expect(resolverVinculo(recusado, item, rotular).estado).toBe('resolvido');
  });
});
