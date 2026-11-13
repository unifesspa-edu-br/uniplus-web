import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import type { TermoDoPedidoDto } from '@uniplus/shared-data/autorizacao';
import { EU, ok, pedido } from './testes';
import {
  abrirPedido,
  confirmarNoDialogo,
  decidirNoResumo,
  dublesDoPedido,
  esperar,
} from './pedido-detalhe.page.testing';

const TERMO_FIXADO: TermoDoPedidoDto = {
  versaoId: 'termo-v2',
  numero: 2,
  resumo: 'a'.repeat(64),
  aceite: null,
};

/** Pedido protegido para a pessoa autenticada, já verificado, que espera o aceite dela. */
const aguardandoMeuAceite = (termo: TermoDoPedidoDto | null = TERMO_FIXADO) =>
  pedido({
    situacao: 'aguardando_beneficiario',
    etapaAtual: null,
    beneficiario: { email: EU.email, identidade: null, nome: null },
    anexaraDocumento: true,
    termo,
  });

describe('PedidoDetalhePage — aceite do termo fixado', () => {
  const dubles = dublesDoPedido();
  const { api, termos } = dubles;
  const abrir = abrirPedido(dubles);

  const caixa = (host: HTMLElement) =>
    host.querySelector<HTMLInputElement>('cfg-termo-de-responsabilidade input[type="checkbox"]');

  it('apresenta a versão fixada no pedido, buscada pelo id', async () => {
    const { fixture, host } = await abrir([], aguardandoMeuAceite());
    await esperar(fixture);

    expect(termos.versao).toHaveBeenCalledWith('termo-v2');
    const termo = host.querySelector('cfg-termo-de-responsabilidade');
    expect(termo?.textContent).toContain('Termo de responsabilidade a aceitar');
    expect(termo?.querySelector('[role="region"]')?.textContent).toContain('Declaro que tratarei');
  });

  it('não aceita o pedido sem marcar o termo e leva o foco à caixa', async () => {
    const { fixture, host } = await abrir([], aguardandoMeuAceite());
    await esperar(fixture);

    await decidirNoResumo(fixture, host, 'Aceitar o pedido');

    expect(host.querySelector(':scope > ui-dialog dialog[open]')).toBeNull();
    expect(document.activeElement).toBe(caixa(host));
    expect(caixa(host)?.getAttribute('aria-invalid')).toBe('true');
    expect(host.textContent).toContain('Marque o aceite do termo para continuar.');
    expect(api.aceitar).not.toHaveBeenCalled();
  });

  it('com o termo marcado, o aceite informa a versão fixada', async () => {
    const { fixture, host } = await abrir([], aguardandoMeuAceite());
    api.aceitar.mockReturnValue(of(ok(pedido())));
    await esperar(fixture);

    caixa(host)?.click();
    await esperar(fixture);
    await decidirNoResumo(fixture, host, 'Aceitar o pedido');
    await confirmarNoDialogo(fixture, host);

    expect(api.aceitar).toHaveBeenCalledWith(pedido().id, expect.anything(), 'termo-v2');
  });

  it('pedido sem termo é aceito sem versão e sem apresentar termo', async () => {
    const { fixture, host } = await abrir([], aguardandoMeuAceite(null));
    api.aceitar.mockReturnValue(of(ok(pedido())));

    await decidirNoResumo(fixture, host, 'Aceitar o pedido');
    await confirmarNoDialogo(fixture, host);

    expect(host.querySelector('cfg-termo-de-responsabilidade')).toBeNull();
    expect(api.aceitar).toHaveBeenCalledWith(pedido().id, expect.anything(), null);
  });

  it('o pedido que espera o documento não oferece o aceite nem apresenta o termo', async () => {
    const { host } = await abrir(
      [],
      pedido({ ...aguardandoMeuAceite(), situacao: 'aguardando_documento' }),
    );

    expect(host.textContent).not.toContain('Aceitar o pedido');
    expect(host.querySelector('cfg-termo-de-responsabilidade')).toBeNull();
  });

  it('mostra a evidência do aceite: quem, quando, a versão e o resumo', async () => {
    const aceito = pedido({
      termo: {
        ...TERMO_FIXADO,
        aceite: {
          pessoa: { emissor: 'unifesspa', sub: 'sub-betina-000', nome: 'Betina Teste' },
          aceitoEm: '2026-11-10T13:00:00Z',
          versaoId: 'termo-v2',
          numero: 2,
          resumo: 'a'.repeat(64),
        },
      },
    });
    const { host } = await abrir([], aceito);

    const evidencia = host.querySelector('cfg-evidencia-do-termo')?.textContent ?? '';
    expect(evidencia).toContain('Aceito por Betina Teste');
    expect(evidencia).toContain('10/11/2026');
    expect(evidencia).toContain('versão 2');
    expect(evidencia).toContain('a'.repeat(64));
  });
});
