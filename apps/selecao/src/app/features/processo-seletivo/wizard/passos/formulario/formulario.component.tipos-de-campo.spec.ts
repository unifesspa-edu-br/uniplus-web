import { rotuloSimuladoDoTipoDeCampo } from '@uniplus/shared-testing';
import { describe, expect, it } from 'vitest';

import { usarPasso, type ContextoDoPasso } from './formulario-passo.testing';

describe('FormularioPassoComponent: tipos de campo do vocabulário', () => {
  let host: ContextoDoPasso['host'];

  usarPasso((contexto) => {
    ({ host } = contexto);
  });

  it('entrega ao editor os tipos de campo da API: o cartão mostra o rótulo do vocabulário', () => {
    const tags = Array.from(host.querySelectorAll('ui-tag')).map((tag) => tag.textContent?.trim());

    expect(tags).toContain(rotuloSimuladoDoTipoDeCampo('SIM_OU_NAO'));
  });
});
