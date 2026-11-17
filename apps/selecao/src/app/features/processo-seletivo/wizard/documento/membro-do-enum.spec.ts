import { TipoDeDecisaoDoDocumento } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { membroDoEnum } from './membro-do-enum';

describe('membro do enum', () => {
  it('devolve o membro que tem o valor', () => {
    expect(membroDoEnum(TipoDeDecisaoDoDocumento, 'CLASSIFICACAO')).toBe(
      TipoDeDecisaoDoDocumento.CLASSIFICACAO,
    );
  });

  it('não devolve nada para o valor que o enum não tem', () => {
    expect(membroDoEnum(TipoDeDecisaoDoDocumento, 'TIPO_DO_FUTURO')).toBeUndefined();
  });
});
