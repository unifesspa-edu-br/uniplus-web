import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { ok, pedido, recusa } from './testes';
import { EdicaoDoPedidoDeAcesso } from './edicao-do-pedido-de-acesso';
import { dublesDoPedirAcesso, montarPedirAcesso, versaoDoTermo } from './pedir-acesso.page.testing';

/** O title do contrato; a mensagem registrada no lugar dele é conferida em mensagens-do-termo.spec. */
const SEM_TERMO = 'Não há termo de responsabilidade publicado';
const TERMO_DIVERGENTE = 'uniplus.autorizacao.pedido.termo_divergente';

describe('PedirAcessoPage — termo de responsabilidade no envio', () => {
  const dubles = dublesDoPedirAcesso();
  const { api, termos } = dubles;

  beforeEach(() => {
    vi.resetAllMocks();
    termos.vigente.mockReturnValue(of(ok(versaoDoTermo())));
  });

  async function montarComPerfilSensivel() {
    const pagina = await montarPedirAcesso(dubles);
    pagina.digitar('select[formcontrolname="perfilId"]', 'perfil-4');
    pagina.digitar('select[formcontrolname="unidadeId"]', 'unidade-1');
    pagina.digitar('textarea', 'Analiso os documentos pessoais do processo.');
    await pagina.fixture.whenStable();
    pagina.fixture.detectChanges();
    return pagina;
  }

  const aceite = (host: HTMLElement) =>
    host.querySelector<HTMLInputElement>('cfg-termo-de-responsabilidade input[type="checkbox"]');

  function marcarAceite(host: HTMLElement): void {
    aceite(host)?.click();
  }

  it('no pedido próprio sem documento, apresenta a vigente com versão, resumo e texto focável', async () => {
    const { host } = await montarComPerfilSensivel();

    const termo = host.querySelector('cfg-termo-de-responsabilidade');
    expect(termo?.textContent).toContain('2, publicada em');
    expect(termo?.textContent).toContain('a'.repeat(64));
    const texto = termo?.querySelector('[role="region"]');
    expect(texto?.getAttribute('tabindex')).toBe('0');
    expect(texto?.getAttribute('aria-label')).toBe('Texto do termo de responsabilidade, versão 2');
  });

  it('não envia sem o aceite e liga o erro à caixa', async () => {
    const { host, enviar } = await montarComPerfilSensivel();

    await enviar();

    expect(api.criar).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Marque o aceite do termo para continuar.');
    expect(aceite(host)?.getAttribute('aria-invalid')).toBe('true');
  });

  it('com o aceite, o envio apresenta a versão e é o próprio aceite', async () => {
    api.criar.mockReturnValue(of(ok(pedido({ id: 'novo' }))));
    const { host, enviar, fixture } = await montarComPerfilSensivel();

    marcarAceite(host);
    fixture.detectChanges();
    await enviar();

    expect(api.criar.mock.calls[0]?.[0]).toMatchObject({
      anexaraDocumento: false,
      termoVersaoApresentadaId: 'termo-v2',
    });
  });

  const termoInformado = (host: HTMLElement) =>
    host.querySelector('cfg-termo-de-responsabilidade')?.textContent ?? '';

  it('no pedido para outra pessoa, informa a vigente sem a caixa e envia a versão', async () => {
    api.criar.mockReturnValue(of(ok(pedido({ id: 'novo' }))));
    const { host, campo, digitar, enviar, fixture } = await montarComPerfilSensivel();

    campo<HTMLInputElement>('input[value="outra"]').click();
    fixture.detectChanges();
    digitar('input[formcontrolname="beneficiarioEmail"]', 'betina.teste@unifesspa.edu.br');
    await enviar();

    expect(aceite(host)).toBeNull();
    expect(termoInformado(host)).toContain('aceitará o termo no próprio pedido');
    expect(api.criar.mock.calls[0]?.[0]).toMatchObject({ termoVersaoApresentadaId: 'termo-v2' });
  });

  it('no pedido para outra pessoa com a vigente trocada (409), reapresenta e reenvia sob chave nova', async () => {
    termos.vigente
      .mockReturnValueOnce(of(ok(versaoDoTermo())))
      .mockReturnValueOnce(of(ok(versaoDoTermo({ id: 'termo-v3', numero: 3 }))));
    api.criar
      .mockReturnValueOnce(of(recusa(TERMO_DIVERGENTE, 409, 'x')))
      .mockReturnValueOnce(of(ok(pedido({ id: 'novo' }))));
    const { host, campo, digitar, enviar, fixture } = await montarComPerfilSensivel();
    campo<HTMLInputElement>('input[value="outra"]').click();
    fixture.detectChanges();
    digitar('input[formcontrolname="beneficiarioEmail"]', 'betina.teste@unifesspa.edu.br');

    await enviar();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector('[aria-live="polite"]')?.textContent).toContain('envie de novo');
    await enviar();

    const [primeira, segunda] = api.criar.mock.calls;
    expect(segunda?.[0]).toMatchObject({ termoVersaoApresentadaId: 'termo-v3' });
    expect(segunda?.[1].get(IDEMPOTENCY_KEY_TOKEN)).not.toBe(
      primeira?.[1].get(IDEMPOTENCY_KEY_TOKEN),
    );
  });

  it('sem termo publicado, diz isso no lugar do texto e não envia', async () => {
    termos.vigente.mockReturnValue(
      of(
        recusa(
          'uniplus.autorizacao.termo.sem_versao_vigente',
          404,
          'Não há termo de responsabilidade publicado',
        ),
      ),
    );
    const { host, enviar } = await montarComPerfilSensivel();

    await enviar();

    expect(host.textContent).toContain('Não há termo de responsabilidade publicado');
    expect(api.criar).not.toHaveBeenCalled();
  });

  it('com a vigente trocada (409), apresenta a nova, desmarca o aceite, avisa e reenvia sob chave nova', async () => {
    termos.vigente
      .mockReturnValueOnce(of(ok(versaoDoTermo())))
      .mockReturnValueOnce(of(ok(versaoDoTermo({ id: 'termo-v3', numero: 3 }))));
    api.criar
      .mockReturnValueOnce(of(recusa(TERMO_DIVERGENTE, 409, 'x')))
      .mockReturnValueOnce(of(ok(pedido({ id: 'novo' }))));
    const { host, enviar, fixture } = await montarComPerfilSensivel();

    marcarAceite(host);
    fixture.detectChanges();
    await enviar();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(aceite(host)?.checked).toBe(false);
    expect(host.querySelector('[aria-live="polite"]')?.textContent).toContain('versão 3');
    marcarAceite(host);
    fixture.detectChanges();
    await enviar();

    const [primeira, segunda] = api.criar.mock.calls;
    expect(segunda?.[0]).toMatchObject({ termoVersaoApresentadaId: 'termo-v3' });
    expect(segunda?.[1].get(IDEMPOTENCY_KEY_TOKEN)).not.toBe(
      primeira?.[1].get(IDEMPOTENCY_KEY_TOKEN),
    );
  });

  it('com conflito de concorrência, repete o mesmo pedido sob a mesma chave', async () => {
    api.criar
      .mockReturnValueOnce(of(recusa('uniplus.concorrencia.conflito', 409, 'x')))
      .mockReturnValueOnce(of(ok(pedido({ id: 'novo' }))));
    const { host, enviar, fixture } = await montarComPerfilSensivel();

    marcarAceite(host);
    fixture.detectChanges();
    await enviar();
    await enviar();

    const [primeira, segunda] = api.criar.mock.calls;
    expect(segunda?.[0]).toEqual(primeira?.[0]);
    expect(segunda?.[1].get(IDEMPOTENCY_KEY_TOKEN)).toBe(primeira?.[1].get(IDEMPOTENCY_KEY_TOKEN));
  });

  it('no pedido próprio com documento, informa a vigente sem a caixa: o beneficiário aceita depois da verificação', async () => {
    api.criar.mockReturnValue(of(ok(pedido({ id: 'novo' }))));
    const { host, enviar, fixture } = await montarComPerfilSensivel();

    fixture.debugElement.injector
      .get(EdicaoDoPedidoDeAcesso)
      .arquivo.set(new File(['%PDF'], 'designacao.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();
    await enviar();

    expect(aceite(host)).toBeNull();
    expect(termoInformado(host)).toContain('depois da verificação');
    expect(api.criar.mock.calls[0]?.[0]).toMatchObject({
      anexaraDocumento: true,
      termoVersaoApresentadaId: 'termo-v2',
    });
  });

  it('o perfil sem dado pessoal não apresenta termo nem lê a vigente', async () => {
    api.criar.mockReturnValue(of(ok(pedido({ id: 'novo' }))));
    const pagina = await montarPedirAcesso(dubles);
    pagina.digitar('select[formcontrolname="perfilId"]', 'perfil-1');
    pagina.digitar('select[formcontrolname="unidadeId"]', 'unidade-1');
    pagina.digitar('textarea', 'Atendo a comissão do processo seletivo.');
    await pagina.enviar();

    expect(pagina.host.querySelector('cfg-termo-de-responsabilidade')).toBeNull();
    expect(termos.vigente).not.toHaveBeenCalled();
    expect(api.criar.mock.calls[0]?.[0]).not.toHaveProperty('termoVersaoApresentadaId');
  });

  it('com a criação recusada por falta de termo publicado (422), explica e não segue', async () => {
    api.criar.mockReturnValue(
      of(recusa('uniplus.autorizacao.pedido.sem_termo_vigente', 422, SEM_TERMO)),
    );
    const { host, enviar, fixture, navegar } = await montarComPerfilSensivel();

    marcarAceite(host);
    fixture.detectChanges();
    await enviar();

    expect(host.textContent).toContain('Não foi possível enviar o pedido');
    expect(host.textContent).toContain(SEM_TERMO);
    expect(api.criar).toHaveBeenCalledTimes(1);
    expect(navegar).not.toHaveBeenCalled();
  });
});
