import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { TermoDoPedidoDto } from '@uniplus/shared-data/autorizacao';
import { EU, ok, pedido, recusa } from './testes';
import {
  abrirPedido,
  confirmarNoDialogo,
  decidirNoResumo,
  dublesDoPedido,
  esperar,
  montarPagina,
  provedoresDaPagina,
  textoDoAlerta,
  type Cena,
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

  describe('bordas do aceite', () => {
    let montada: Cena | undefined;
    const fixture = (): Cena => montada as Cena;
    /** A leitura da versão fixada recusada pela API, montada antes da primeira leitura. */
    async function abrirComAVersaoRecusada(): Promise<HTMLElement> {
      vi.resetAllMocks();
      TestBed.resetTestingModule();
      api.obter.mockReturnValue(of(ok(aguardandoMeuAceite())));
      api.trilha.mockReturnValue(of(ok([])));
      termos.versao.mockReturnValue(
        of(
          recusa(
            'uniplus.autorizacao.termo.versao_nao_encontrada',
            404,
            'Versão do termo não encontrada',
          ),
        ),
      );
      TestBed.configureTestingModule({ providers: provedoresDaPagina(dubles, []) });
      montada = await montarPagina(aguardandoMeuAceite().id);
      await esperar(montada);
      return montada.nativeElement as HTMLElement;
    }
    /** O termo marcado e o aceite confirmado no diálogo. */
    async function aceitarComOTermo(cena: Cena, host: HTMLElement) {
      caixa(host)?.click();
      await esperar(cena);
      await decidirNoResumo(cena, host, 'Aceitar o pedido');
      await confirmarNoDialogo(cena, host);
      await esperar(cena);
    }

    it('no pedido próprio com documento, depois da verificação, o aceite informa a versão fixada', async () => {
      const proprio = pedido({
        ...aguardandoMeuAceite(),
        solicitante: { emissor: 'unifesspa', sub: EU.id },
      });
      const { fixture, host } = await abrir([], proprio);
      api.aceitar.mockReturnValue(of(ok(pedido())));
      await esperar(fixture);

      await aceitarComOTermo(fixture, host);

      expect(termos.versao).toHaveBeenCalledWith('termo-v2');
      expect(api.aceitar).toHaveBeenCalledWith(proprio.id, expect.anything(), 'termo-v2');
    });

    it('quem não é o beneficiário não vê o termo nem o aceite', async () => {
      const deOutraPessoa = pedido({
        ...aguardandoMeuAceite(),
        beneficiario: pedido().beneficiario,
      });
      const { host } = await abrir([], deOutraPessoa);

      expect(host.querySelector('cfg-termo-de-responsabilidade')).toBeNull();
      expect(host.textContent).not.toContain('Aceitar o pedido');
      expect(termos.versao).not.toHaveBeenCalled();
    });

    it.each([
      ['pedido.nao_e_o_beneficiario', 403, 'Só o beneficiário aceita o pedido.'],
      ['pedido.termo_divergente', 409, 'O termo apresentado não é o vigente.'],
      ['pedido.anexo_nao_verificado', 422, 'O anexo ainda não foi verificado.'],
    ] as const)('a recusa %s no aceite aparece no alerta', async (codigo, status, titulo) => {
      const { fixture, host } = await abrir([], aguardandoMeuAceite());
      api.aceitar.mockReturnValue(of(recusa(`uniplus.autorizacao.${codigo}`, status, titulo)));
      await esperar(fixture);

      await aceitarComOTermo(fixture, host);

      expect(textoDoAlerta(host)).toContain(titulo);
    });

    it('sem a versão fixada (404), diz isso no lugar do texto e não aceita', async () => {
      const host = await abrirComAVersaoRecusada();

      await decidirNoResumo(fixture(), host, 'Aceitar o pedido');

      expect(host.querySelector('cfg-termo-de-responsabilidade')?.textContent).toContain(
        'Versão do termo não encontrada',
      );
      expect(host.querySelector(':scope > ui-dialog dialog[open]')).toBeNull();
      expect(api.aceitar).not.toHaveBeenCalled();
    });
  });
});
