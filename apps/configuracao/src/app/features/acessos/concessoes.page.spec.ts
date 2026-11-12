import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConcessoesPage } from './concessoes.page';
import { ConcessoesStore } from './concessoes.store';
import { RevogacaoDeConcessoes } from './revogacao-de-concessoes';
import { ok } from './testes';
import {
  URL,
  ativa,
  dublesDeConcessoes,
  configurarConcessoes,
  atualizar,
} from './concessoes.page.testing';

describe('ConcessoesPage — lista e trilha', () => {
  let http: HttpTestingController;
  const dubles = dublesDeConcessoes();
  const { api, notificacoes } = dubles;
  beforeEach(() => {
    vi.resetAllMocks();
    http = configurarConcessoes(dubles);
  });
  afterEach(() => http.verify());

  it('lista as ativas por padrão com pessoa, escopo e vínculo com o pedido', async () => {
    const fixture = TestBed.createComponent(ConcessoesPage);
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('situacao')).toBe('ativa');
    req.flush([ativa]);
    await atualizar();
    expect(fixture.nativeElement.textContent).toContain('Pessoa 01234567');
    expect(fixture.nativeElement.textContent).not.toContain('0123456789abcdef');
    expect(fixture.nativeElement.textContent).toContain('CEPS');
    expect(
      fixture.nativeElement.querySelector('a[href="/acessos/pedidos/pedido-1"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('button[aria-label^="Revogar a concessão"]'),
    ).not.toBeNull();
  });

  it('mostra a versão do perfil de cada concessão, ou que o perfil não tem versão', async () => {
    const fixture = TestBed.createComponent(ConcessoesPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([ativa, { ...ativa, id: 'c2', versao: null }]);
    await atualizar();
    const versoes = [
      ...fixture.nativeElement.querySelectorAll('td[data-label="Versão do perfil"]'),
    ].map((celula) => (celula as HTMLElement).textContent?.trim());
    expect(versoes).toEqual(['2', 'Sem versão']);
  });

  it('carrega a trilha da concessão selecionada', async () => {
    const fixture = TestBed.createComponent(ConcessoesPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([ativa]);
    await atualizar();
    const store = fixture.debugElement.injector.get(ConcessoesStore);
    store.carregarTrilha('c1');
    await atualizar();
    http.expectOne(`${URL}/c1/trilha`).flush([
      {
        tipo: 'concedida',
        instante: '2026-10-28T12:00:00Z',
        autor: ativa.beneficiario,
        detalhe: null,
      },
    ]);
    await atualizar();
    expect(store.trilha()).toHaveLength(1);
  });

  it('abre a trilha ao acionar a concessão na lista', async () => {
    const fixture = TestBed.createComponent(ConcessoesPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([ativa]);
    await atualizar();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('button[aria-label^="Ver a trilha"]')?.click();
    await atualizar();
    http.expectOne(`${URL}/c1/trilha`).flush([]);
    await atualizar();
    expect(host.querySelector('dialog[open]')?.textContent).toContain('Nenhum evento registrado.');
  });

  describe('trilha indisponível', () => {
    const falhar = (req: ReturnType<HttpTestingController['expectOne']>, status: number) =>
      req.flush(
        {
          title: 'Trilha indisponível',
          status,
          code: 'uniplus.x',
          type: 'about:blank',
          traceId: '',
        },
        {
          status,
          statusText: 'Erro',
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );

    async function abrirComTrilhaPendente() {
      const fixture = TestBed.createComponent(ConcessoesPage);
      const host = fixture.nativeElement as HTMLElement;
      document.body.appendChild(host);
      fixture.detectChanges();
      http.expectOne((r) => r.url === URL).flush([ativa]);
      await atualizar();
      host.querySelector<HTMLButtonElement>('button[aria-label^="Ver a trilha"]')?.click();
      await atualizar();
      return { host, requisicao: http.expectOne(`${URL}/c1/trilha`) };
    }

    const tentar = (host: HTMLElement) =>
      host.querySelector<HTMLButtonElement>('dialog[open] ui-alert button');

    it('a falha do servidor permite tentar novamente e leva o foco à região da trilha', async () => {
      const { host, requisicao } = await abrirComTrilhaPendente();
      falhar(requisicao, 503);
      await atualizar();
      expect(host.querySelector('dialog[open]')?.textContent).toContain('Trilha indisponível');
      expect(host.querySelector('dialog[open]')?.textContent).not.toContain('Nenhum evento');

      tentar(host)?.focus();
      tentar(host)?.click();
      await atualizar();
      http.expectOne(`${URL}/c1/trilha`).flush([]);
      await atualizar();
      await atualizar();

      expect(tentar(host)).toBeNull();
      expect(host.querySelector('dialog[open]')?.textContent).toContain(
        'Nenhum evento registrado.',
      );
      expect(document.activeElement).toBe(host.querySelector('#cfg-concessao-trilha'));
      host.remove();
    });

    it('a recusa por concessão inexistente mostra o motivo sem oferecer nova tentativa', async () => {
      const { host, requisicao } = await abrirComTrilhaPendente();
      falhar(requisicao, 404);
      await atualizar();

      const gaveta = host.querySelector('dialog[open]');
      expect(gaveta?.textContent).toContain('Trilha indisponível');
      expect(tentar(host)).toBeNull();
      expect(gaveta?.textContent).not.toContain('Tentar novamente');
      host.remove();
    });
  });

  it('recarrega a lista depois da revogação', async () => {
    api.revogar.mockReturnValue(of(ok(undefined)));
    const fixture = TestBed.createComponent(ConcessoesPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([ativa]);
    await atualizar();
    (
      fixture.nativeElement.querySelector(
        'button[aria-label^="Revogar a concessão"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const pagina = fixture.debugElement.injector.get(RevogacaoDeConcessoes);
    await pagina.revogar('Mudou de unidade.', 'betina@uniplus-test.local');
    await atualizar();
    expect(api.revogar.mock.calls[0]?.slice(0, 2)).toEqual([
      'c1',
      { motivo: 'Mudou de unidade.', confirmacaoEmail: 'betina@uniplus-test.local' },
    ]);
    expect(notificacoes.success).toHaveBeenCalledWith('Concessão revogada');
    expect(fixture.debugElement.injector.get(RevogacaoDeConcessoes).revogando()).toBe(false);
    http.expectOne((r) => r.url === URL).flush([]);
    await atualizar();
  });

  it('não oferece revogação para concessões revogadas ou vencidas', async () => {
    const fixture = TestBed.createComponent(ConcessoesPage);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === URL)
      .flush([
        { ...ativa, ativa: false, revogadaEm: '2026-10-29T00:00:00Z' },
        { ...ativa, id: 'c2', ativa: false },
      ]);
    await atualizar();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('button[aria-label^="Revogar a concessão"]')).toBeNull();
    expect(host.textContent).toContain('Revogada');
    expect(host.textContent).toContain('Vencida');
  });

  it('descarta a trilha de uma concessão substituída por outra', async () => {
    const fixture = TestBed.createComponent(ConcessoesPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([ativa]);
    await atualizar();
    const store = fixture.debugElement.injector.get(ConcessoesStore);
    store.carregarTrilha('c1');
    await atualizar();
    const primeira = http.expectOne(`${URL}/c1/trilha`);
    store.carregarTrilha('c2');
    await atualizar();
    expect(primeira.cancelled).toBe(true);
    http.expectOne(`${URL}/c2/trilha`).flush([
      {
        tipo: 'revogada',
        instante: '2026-10-28T12:00:00Z',
        autor: ativa.beneficiario,
        detalhe: null,
      },
    ]);
    await atualizar();
    expect(store.trilha()).toHaveLength(1);
    expect(store.trilha()[0]?.tipo).toBe('revogada');
  });

  it('recarrega pela situação escolhida', async () => {
    const fixture = TestBed.createComponent(ConcessoesPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([ativa]);
    await atualizar();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'todas';
    select.dispatchEvent(new Event('change'));
    await atualizar();
    const filtro = http.expectOne((r) => r.url === URL);
    expect(filtro.request.params.get('situacao')).toBe('todas');
    filtro.flush([]);
    await atualizar();
  });
});
