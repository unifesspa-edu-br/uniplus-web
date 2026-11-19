import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FALHA_INESPERADA } from './mensagens-de-acesso';
import { ConcessoesPage } from './concessoes.page';
import { ConcessoesStore } from './concessoes.store';
import { RevogacaoDeConcessoes } from './revogacao-de-concessoes';
import { ok, recusa } from './testes';
import {
  URL,
  ativa,
  dublesDeConcessoes,
  configurarConcessoes,
  atualizar,
} from './concessoes.page.testing';

describe('ConcessoesPage — foco e confirmação da revogação', () => {
  let http: HttpTestingController;
  const dubles = dublesDeConcessoes();
  const { api } = dubles;
  beforeEach(() => {
    vi.resetAllMocks();
    http = configurarConcessoes(dubles);
  });
  afterEach(() => http.verify());

  describe('foco e "Tentar novamente" durante a revogação', () => {
    const botaoDeRevogar = (host: HTMLElement) =>
      host.querySelector<HTMLButtonElement>('button[aria-label^="Revogar a concessão"]');

    it('depois de revogar, com a linha ausente da recarga, o foco vai ao título da lista', async () => {
      api.revogar.mockReturnValue(of(ok(undefined)));
      const fixture = TestBed.createComponent(ConcessoesPage);
      const host = fixture.nativeElement as HTMLElement;
      document.body.appendChild(host);
      fixture.detectChanges();
      http.expectOne((r) => r.url === URL).flush([ativa]);
      await atualizar();
      botaoDeRevogar(host)?.focus();
      botaoDeRevogar(host)?.click();
      await atualizar();
      const edicao = fixture.debugElement.injector.get(RevogacaoDeConcessoes);

      await edicao.revogar('Saiu da função.', 'betina@uniplus-test.local');
      await atualizar();
      http.expectOne((r) => r.url === URL).flush([]);
      await atualizar();
      await atualizar();

      expect(document.activeElement).toBe(host.querySelector('#cfg-concessoes-titulo'));
      host.remove();
    });

    it('depois de revogar, com a linha ainda na recarga, o foco volta ao botão dela', async () => {
      api.revogar.mockReturnValue(of(ok(undefined)));
      const fixture = TestBed.createComponent(ConcessoesPage);
      const host = fixture.nativeElement as HTMLElement;
      document.body.appendChild(host);
      fixture.detectChanges();
      http.expectOne((r) => r.url === URL).flush([ativa]);
      await atualizar();
      botaoDeRevogar(host)?.focus();
      botaoDeRevogar(host)?.click();
      await atualizar();
      const edicao = fixture.debugElement.injector.get(RevogacaoDeConcessoes);

      await edicao.revogar('Saiu da função.', 'betina@uniplus-test.local');
      await atualizar();
      expect(botaoDeRevogar(host)?.disabled).toBe(true);
      // O navegador tira o foco de um botão que se desabilita; o jsdom não, então o teste o tira.
      const provisorio = host.appendChild(document.createElement('button'));
      provisorio.focus();
      provisorio.remove();
      http.expectOne((r) => r.url === URL).flush([ativa]);
      await atualizar();
      await atualizar();

      expect(botaoDeRevogar(host)?.disabled).toBe(false);
      expect(document.activeElement).toBe(botaoDeRevogar(host));
      host.remove();
    });

    it.each(['ja_revogada', 'nao_encontrada'])(
      'com a recusa %s, o foco só volta ao fechar o diálogo e vai ao título se a linha saiu',
      async (codigo) => {
        api.revogar.mockReturnValue(of(recusa(`uniplus.autorizacao.concessao.${codigo}`, 409)));
        const fixture = TestBed.createComponent(ConcessoesPage);
        const host = fixture.nativeElement as HTMLElement;
        document.body.appendChild(host);
        fixture.detectChanges();
        http.expectOne((r) => r.url === URL).flush([ativa]);
        await atualizar();
        botaoDeRevogar(host)?.focus();
        botaoDeRevogar(host)?.click();
        await atualizar();
        const edicao = fixture.debugElement.injector.get(RevogacaoDeConcessoes);

        await edicao.revogar('Saiu da função.', 'betina@uniplus-test.local');
        await atualizar();
        http.expectOne((r) => r.url === URL).flush([]);
        await atualizar();
        await atualizar();
        const titulo = host.querySelector('#cfg-concessoes-titulo');
        expect(edicao.revogando()).toBe(true);
        expect(document.activeElement).not.toBe(titulo);

        edicao.revogando.set(false);
        await atualizar();
        await atualizar();

        expect(document.activeElement).toBe(titulo);
        host.remove();
      },
    );

    it('com a revogação pendente, "Revogar" fica indisponível mesmo sem a lista carregar', async () => {
      api.revogar.mockReturnValue(new Subject());
      const fixture = TestBed.createComponent(ConcessoesPage);
      const host = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      http.expectOne((r) => r.url === URL).flush([ativa]);
      await atualizar();
      expect(botaoDeRevogar(host)?.disabled).toBe(false);

      const edicao = fixture.debugElement.injector.get(RevogacaoDeConcessoes);
      edicao.pedirRevogacao(ativa);
      void edicao.revogar('Saiu da função.', 'betina@uniplus-test.local');
      await atualizar();

      expect(botaoDeRevogar(host)?.disabled).toBe(true);
    });

    it('com a lista carregando sem escrita, "Revogar" fica indisponível', async () => {
      const fixture = TestBed.createComponent(ConcessoesPage);
      const host = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      http.expectOne((r) => r.url === URL).flush([ativa]);
      await atualizar();

      fixture.debugElement.injector.get(ConcessoesStore).recarregar();
      await atualizar();

      expect(botaoDeRevogar(host)?.disabled).toBe(true);
      http.expectOne((r) => r.url === URL).flush([ativa]);
      await atualizar();
      expect(botaoDeRevogar(host)?.disabled).toBe(false);
    });

    it('com a revogação pendente, "Tentar novamente" fica indisponível e não recarrega', async () => {
      api.revogar.mockReturnValue(new Subject());
      const fixture = TestBed.createComponent(ConcessoesPage);
      const host = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      http
        .expectOne((r) => r.url === URL)
        .flush({ title: 'Erro' }, { status: 500, statusText: 'Erro' });
      await atualizar();
      const tentar = [...host.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Tentar novamente'),
      );
      expect(tentar?.getAttribute('aria-disabled')).toBeNull();

      const edicao = fixture.debugElement.injector.get(RevogacaoDeConcessoes);
      edicao.pedirRevogacao(ativa);
      void edicao.revogar('Saiu da função.', 'betina@uniplus-test.local');
      await atualizar();
      expect(tentar?.getAttribute('aria-disabled')).toBe('true');
      expect(tentar?.getAttribute('aria-busy')).toBeNull();
      tentar?.click();
      await atualizar();
      http.expectNone((r) => r.url === URL);
    });
  });

  describe('confirmação da revogação', () => {
    async function aberta() {
      const fixture = TestBed.createComponent(ConcessoesPage);
      fixture.detectChanges();
      http.expectOne((r) => r.url === URL).flush([ativa]);
      await atualizar();
      (
        fixture.nativeElement.querySelector(
          'button[aria-label^="Revogar a concessão"]',
        ) as HTMLElement
      ).click();
      await atualizar();
      return fixture.debugElement.injector.get(RevogacaoDeConcessoes);
    }

    it('sem motivo, não envia e marca o motivo', async () => {
      const edicao = await aberta();
      edicao.email.setValue('betina@uniplus-test.local');
      edicao.motivo.setValue('   ');

      edicao.confirmar();

      expect(api.revogar).not.toHaveBeenCalled();
      expect(edicao.tentou()).toBe(true);
      expect(edicao.motivo.hasError('required')).toBe(true);
      expect(edicao.enviando()).toBe(false);
    });

    it('sem e-mail, não envia, mesmo com o motivo preenchido', async () => {
      const edicao = await aberta();
      edicao.motivo.setValue('Saiu da função.');

      edicao.confirmar();

      expect(api.revogar).not.toHaveBeenCalled();
      expect(edicao.tentou()).toBe(true);
      expect(edicao.enviando()).toBe(false);
    });

    it('uma falha que não veio da API libera o diálogo e explica', async () => {
      api.revogar.mockReturnValue(throwError(() => new Error('rede')));
      const edicao = await aberta();

      await edicao.revogar('Saiu da função.', 'betina@uniplus-test.local');

      expect(edicao.erroDaRevogacao()).toBe(FALHA_INESPERADA);
      expect(edicao.enviando()).toBe(false);
      expect(edicao.revogando()).toBe(true);
    });
  });
});
