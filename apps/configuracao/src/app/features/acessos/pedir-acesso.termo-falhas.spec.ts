import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, pedido, recusa } from './testes';
import {
  caixaDoAceite,
  chavesDasCriacoes,
  dublesDoPedirAcesso,
  montarComPerfilSensivel,
  versaoDoTermo,
} from './pedir-acesso.page.testing';

const TERMO_DIVERGENTE = 'uniplus.autorizacao.pedido.termo_divergente';
const FALHA = recusa('uniplus.internal.unexpected', 500, 'Erro interno');
const TEXTO_V2 = versaoDoTermo().texto;
const TEXTO_V3 = 'Declaro que guardarei sigilo sobre os dados da versão três do termo.';
const V3 = versaoDoTermo({ id: 'termo-v3', numero: 3, texto: TEXTO_V3 });

describe('PedirAcessoPage — falhas na leitura do termo e retentativas', () => {
  const dubles = dublesDoPedirAcesso();
  const { api, termos } = dubles;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const botaoTentar = (host: HTMLElement) =>
    [...host.querySelectorAll<HTMLButtonElement>('cfg-termo-de-responsabilidade button')].find(
      (b) => b.textContent?.trim() === 'Tentar novamente',
    );

  async function assentar(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('com a leitura inicial da vigente falha, não envia e oferece tentar de novo', async () => {
    termos.vigente.mockReturnValueOnce(of(FALHA)).mockReturnValueOnce(of(ok(versaoDoTermo())));
    const { host, enviar, fixture } = await montarComPerfilSensivel(dubles);

    await enviar();
    expect(api.criar).not.toHaveBeenCalled();
    const tentar = botaoTentar(host);
    expect(tentar?.type).toBe('button');
    tentar?.click();
    await assentar(fixture);

    expect(host.textContent).toContain(TEXTO_V2);
    // A falha sai quando a nova tentativa conclui, depois da atualização seguinte da tela.
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(botaoTentar(host)).toBeUndefined();
    });
  });

  it('depois do 409, a versão rejeitada sai e o envio espera a nova, mesmo se a releitura falhar', async () => {
    termos.vigente
      .mockReturnValueOnce(of(ok(versaoDoTermo())))
      .mockReturnValueOnce(of(FALHA))
      .mockReturnValueOnce(of(ok(V3)));
    api.criar
      .mockReturnValueOnce(of(recusa(TERMO_DIVERGENTE, 409, 'x')))
      .mockReturnValueOnce(of(ok(pedido({ id: 'novo' }))));
    const { host, enviar, fixture } = await montarComPerfilSensivel(dubles);
    caixaDoAceite(host)?.click();
    fixture.detectChanges();

    await enviar();
    await assentar(fixture);
    expect(host.textContent).not.toContain(TEXTO_V2);
    await enviar();
    expect(api.criar).toHaveBeenCalledTimes(1);

    expect(host.querySelector('[aria-live="polite"]')?.textContent).not.toContain('versão 3');
    botaoTentar(host)?.click();
    await assentar(fixture);
    expect(host.textContent).toContain(TEXTO_V3);
    expect(host.querySelector('[aria-live="polite"]')?.textContent).toContain('versão 3');
    caixaDoAceite(host)?.click();
    fixture.detectChanges();
    await enviar();
    expect(api.criar.mock.calls[1]?.[0]).toMatchObject({ termoVersaoApresentadaId: 'termo-v3' });
  });

  it('depois do conflito de concorrência, a edição do pedido descarta a retentativa e renova a chave', async () => {
    termos.vigente.mockReturnValue(of(ok(versaoDoTermo())));
    api.criar
      .mockReturnValueOnce(of(recusa('uniplus.concorrencia.conflito', 409, 'x')))
      .mockReturnValueOnce(of(ok(pedido({ id: 'novo' }))));
    const { host, digitar, enviar, fixture } = await montarComPerfilSensivel(dubles);
    caixaDoAceite(host)?.click();
    fixture.detectChanges();

    await enviar();
    digitar('textarea', 'Analiso os documentos pessoais do processo seletivo de 2027.');
    await enviar();

    expect(api.criar.mock.calls[1]?.[0]).toMatchObject({
      justificativa: 'Analiso os documentos pessoais do processo seletivo de 2027.',
    });
    const [primeira, segunda] = chavesDasCriacoes(dubles);
    expect(primeira.length * segunda.length).toBeGreaterThan(0);
    expect(segunda).not.toBe(primeira);
  });
});
