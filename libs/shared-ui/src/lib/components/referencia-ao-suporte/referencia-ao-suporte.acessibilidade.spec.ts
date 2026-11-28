import axe from 'axe-core';
import { vi, describe, expect, it } from 'vitest';
import type { ReferenciaAoSuporte } from '@uniplus/shared-core/http';

import { montar } from './referencia-ao-suporte.testing';

const SERVIDOR: ReferenciaAoSuporte = {
  origem: 'servidor',
  codigoDoErro: 'uniplus.selecao.exemplo',
  identificadorDoPedido: '0af7651916cd43dd8448eb211c80319c',
};

describe('ReferenciaAoSuporteComponent: acessibilidade', () => {
  it.each<[string, ReferenciaAoSuporte]>([
    ['resposta do servidor', SERVIDOR],
    ['erro da própria tela', { origem: 'tela', codigo: 'regra_x' }],
  ])('não tem violações no %s, com o botão de copiar', async (_nome, referencia) => {
    const fixture = montar(referencia, 'Passo 4 — Vagas', { writeText: vi.fn() });
    document.body.append(fixture.nativeElement);

    const resultado = await axe.run(fixture.nativeElement, {
      rules: { region: { enabled: false } },
    });

    fixture.nativeElement.remove();
    expect(resultado.violations).toEqual([]);
  });
});
