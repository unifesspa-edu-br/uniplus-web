import { describe, expect, it } from 'vitest';

import { STATUS_HTTP, ehRecusaDefinitiva } from './status-http';

describe('ehRecusaDefinitiva', () => {
  it.each([STATUS_HTTP.NAO_AUTENTICADO, STATUS_HTTP.SEM_PERMISSAO, STATUS_HTTP.NAO_ENCONTRADO])(
    'o %s não muda se a leitura for repetida',
    (status) => {
      expect(ehRecusaDefinitiva({ status })).toBe(true);
    },
  );

  it.each([STATUS_HTTP.REQUISICAO_INVALIDA, STATUS_HTTP.REMOVIDO_EM_DEFINITIVO, 500, 503])(
    'o %s pode ser resolvido repetindo ou recomeçando a leitura',
    (status) => {
      expect(ehRecusaDefinitiva({ status })).toBe(false);
    },
  );

  it('a leitura sem problema não é recusa', () => {
    expect(ehRecusaDefinitiva(null)).toBe(false);
    expect(ehRecusaDefinitiva(undefined)).toBe(false);
  });
});
