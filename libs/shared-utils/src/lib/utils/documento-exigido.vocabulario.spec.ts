import { describe, expect, it } from 'vitest';

import {
  CONSEQUENCIA_REENVIO,
  CONSEQUENCIAS_ESCOLHIVEIS,
  consequenciasDaFase,
} from './documento-exigido.vocabulario';

describe('consequenciasDaFase', () => {
  it('oferece o reenvio só em fase resolvida que admite complementação', () => {
    const valores = (admite: boolean | undefined): string[] =>
      consequenciasDaFase(CONSEQUENCIAS_ESCOLHIVEIS, admite).map((c) => c.valor);

    expect(valores(true)).toContain(CONSEQUENCIA_REENVIO);
    expect(valores(false)).not.toContain(CONSEQUENCIA_REENVIO);
    expect(valores(undefined)).not.toContain(CONSEQUENCIA_REENVIO);
  });
});
