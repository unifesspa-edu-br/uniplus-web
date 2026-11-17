import { describe, expect, it } from 'vitest';

import { rotuloDoTipoDeDecisao, TIPOS_DE_DECISAO } from './tipos-de-decisao';

describe('tipos de decisão', () => {
  it('traz os oito códigos do contrato, sem repetição', () => {
    const codigos = TIPOS_DE_DECISAO.map((tipo) => tipo.codigo);

    expect(codigos).toHaveLength(8);
    expect(new Set(codigos).size).toBe(8);
    expect(codigos).toContain('GABARITO_DA_PROVA');
    expect(codigos).toContain('NOTA_DA_ETAPA');
  });

  it('dá o nome em português ao código conhecido e devolve o código desconhecido', () => {
    expect(rotuloDoTipoDeDecisao('NOTA_DA_ETAPA')).toBe('Nota da etapa');
    expect(rotuloDoTipoDeDecisao('OUTRO')).toBe('OUTRO');
  });
});
