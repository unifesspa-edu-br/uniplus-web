import type { ProblemDetails } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { recusaDoServidor } from './recusa-do-servidor';

function problema(code: string, traceId: string): ProblemDetails {
  return { type: 'about:blank', title: 'Recusa', status: 422, code, traceId };
}

describe('recusaDoServidor', () => {
  it('leva as mensagens e a referência que a resposta traz', () => {
    const recusa = recusaDoServidor(
      problema('uniplus.selecao.exemplo', '0af7651916cd43dd8448eb211c80319c'),
      ['Uma recusa.'],
    );

    expect(recusa).toEqual({
      valid: false,
      messages: ['Uma recusa.'],
      referenciaAoSuporte: {
        origem: 'servidor',
        codigoDoErro: 'uniplus.selecao.exemplo',
        identificadorDoPedido: '0af7651916cd43dd8448eb211c80319c',
      },
    });
  });

  it('sem código nem identificador no formato, não leva referência', () => {
    const recusa = recusaDoServidor(problema('', ''), ['Uma recusa.']);

    expect(recusa).toEqual({ valid: false, messages: ['Uma recusa.'] });
    expect('referenciaAoSuporte' in recusa).toBe(false);
  });
});
