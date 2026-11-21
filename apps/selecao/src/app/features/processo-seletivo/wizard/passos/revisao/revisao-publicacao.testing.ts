import { afterEach, beforeEach } from 'vitest';

import { montarOCenario, type CenarioDaRevisao } from './revisao.testing';

/**
 * Registra, no `describe` que a chama, a montagem do cenário da Revisão antes de cada caso e a
 * conferência de que nenhuma requisição ficou sem resposta depois dele.
 */
export function usarRevisao(aoMontar: (cenario: CenarioDaRevisao) => void): void {
  let atual: CenarioDaRevisao;
  beforeEach(async () => {
    atual = await montarOCenario();
    aoMontar(atual);
  });
  afterEach(() => atual.controller.verify());
}
