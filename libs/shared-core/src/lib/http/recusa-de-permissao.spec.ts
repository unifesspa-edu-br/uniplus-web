import { HttpContext } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  comRecusaDePermissaoTratadaNaChamada,
  RECUSA_DE_PERMISSAO_TRATADA_NA_CHAMADA,
} from './recusa-de-permissao';

describe('recusa de permissão tratada na chamada', () => {
  it('a chamada não trata a recusa por padrão', () => {
    expect(new HttpContext().get(RECUSA_DE_PERMISSAO_TRATADA_NA_CHAMADA)).toBe(false);
  });

  it('comRecusaDePermissaoTratadaNaChamada marca a chamada', () => {
    expect(comRecusaDePermissaoTratadaNaChamada().get(RECUSA_DE_PERMISSAO_TRATADA_NA_CHAMADA)).toBe(
      true,
    );
  });
});
