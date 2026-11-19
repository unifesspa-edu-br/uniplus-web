import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConcessoesPage } from './concessoes.page';
import { RevogacaoDeConcessoes } from './revogacao-de-concessoes';
import { ok, recusa } from './testes';
import {
  DIVERGENCIA_DE_EMAIL,
  RECUSA_DO_MOTIVO,
  URL,
  ativa,
  dublesDeConcessoes,
  configurarConcessoes,
  atualizar,
} from './concessoes.page.testing';

describe('ConcessoesPage — revogação e suas recusas', () => {
  let http: HttpTestingController;
  const dubles = dublesDeConcessoes();
  const { api, notificacoes } = dubles;
  beforeEach(() => {
    vi.resetAllMocks();
    http = configurarConcessoes(dubles);
  });
  afterEach(() => http.verify());

  describe('recusa da revogação', () => {
    async function revogarComRecusa(
      resposta: ReturnType<typeof recusa>,
      email = 'betina@uniplus-test.local',
    ) {
      api.revogar.mockReturnValue(of(resposta));
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
      await pagina.revogar('Saiu da função.', email);
      return { fixture, pagina };
    }

    it('mantém o diálogo aberto e apresenta a recusa de negócio', async () => {
      const { pagina } = await revogarComRecusa(
        recusa('uniplus.autorizacao.concessao.minimo_de_gestores'),
      );

      expect(pagina.revogando()).toBe(true);
      expect(pagina.erroDaRevogacao()).toBe('Recusado');
      expect(notificacoes.success).not.toHaveBeenCalled();
      await atualizar();
    });

    it('confirmar de novo sem editar o motivo recusado volta a enviar a revogação à API', async () => {
      const { pagina } = await revogarComRecusa(RECUSA_DO_MOTIVO);
      pagina.email.setValue('betina@uniplus-test.local');
      pagina.motivo.setValue('Saiu da função.');
      pagina.confirmar();
      await atualizar();
      expect(pagina.motivo.hasError('backend')).toBe(true);
      api.revogar.mockClear();

      pagina.confirmar();

      expect(api.revogar).toHaveBeenCalledTimes(1);
      await atualizar();
    });

    it('confirmar de novo apaga a recusa antiga do e-mail quando a nova resposta é uma falha do servidor', async () => {
      const { pagina } = await revogarComRecusa(DIVERGENCIA_DE_EMAIL);
      pagina.email.setValue('outra@uniplus-test.local');
      pagina.motivo.setValue('Saiu da função.');
      pagina.confirmar();
      await atualizar();
      expect(pagina.email.hasError('backend')).toBe(true);
      api.revogar.mockReturnValue(of(recusa('uniplus.internal.unexpected', 500, 'Erro interno')));

      pagina.confirmar();
      await atualizar();

      expect(pagina.email.hasError('backend')).toBe(false);
    });

    it('a divergência do e-mail chega em errors[] e fica no campo, sem alerta geral', async () => {
      const { pagina } = await revogarComRecusa(DIVERGENCIA_DE_EMAIL, 'outra@uniplus-test.local');

      expect(pagina.revogando()).toBe(true);
      expect(pagina.email.errors?.['backend'].message).toBe(
        'O e-mail informado não é o do beneficiário da concessão.',
      );
      expect(pagina.erroDaRevogacao()).toBeNull();
      expect(notificacoes.success).not.toHaveBeenCalled();
    });

    it.each(['ja_revogada', 'nao_encontrada'])(
      'a recusa %s mostra o motivo e recarrega a lista desatualizada',
      async (codigo) => {
        const { fixture, pagina } = await revogarComRecusa(
          recusa(`uniplus.autorizacao.concessao.${codigo}`, 409),
        );

        expect(pagina.revogando()).toBe(true);
        expect(pagina.erroDaRevogacao()).toBe('Recusado');
        await atualizar();
        http.expectOne((r) => r.url === URL).flush([]);
        await atualizar();
        expect(
          fixture.nativeElement.querySelector('button[aria-label^="Revogar a concessão"]'),
        ).toBeNull();
      },
    );

    it('a falha de servidor da revogação vira notificação; a recusa 4xx, não', async () => {
      await revogarComRecusa(recusa('uniplus.internal.unexpected', 500, 'Erro interno'));
      expect(notificacoes.errorFromProblem).toHaveBeenCalledOnce();
      expect(notificacoes.errorFromProblem.mock.calls[0]?.[1]).toEqual({ title: 'Erro interno' });
    });

    it('a recusa 4xx da revogação não vira notificação', async () => {
      await revogarComRecusa(recusa('uniplus.autorizacao.concessao.minimo_de_gestores', 422));
      expect(notificacoes.errorFromProblem).not.toHaveBeenCalled();
    });
  });

  it('mantém o diálogo somente leitura durante a revogação e impede envios concorrentes', async () => {
    const resposta = new Subject<ReturnType<typeof ok>>();
    api.revogar.mockReturnValue(resposta);
    const fixture = TestBed.createComponent(ConcessoesPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([ativa]);
    await atualizar();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('button[aria-label^="Revogar a concessão"]')?.click();
    await atualizar();
    const edicao = fixture.debugElement.injector.get(RevogacaoDeConcessoes);
    edicao.email.setValue('betina@uniplus-test.local');
    edicao.motivo.setValue('Saiu da função.');
    await atualizar();
    const botao = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Revogar concessão'),
    );
    expect(botao).toBeDefined();
    botao?.click();
    await atualizar();
    expect(host.querySelector('fieldset')?.disabled).toBe(true);
    expect(botao?.getAttribute('aria-disabled')).toBe('true');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Revogando concessão');
    botao?.click();
    edicao.confirmar();
    expect(api.revogar).toHaveBeenCalledTimes(1);
    host.querySelector('dialog')?.dispatchEvent(new Event('cancel', { cancelable: true }));
    await atualizar();
    expect(edicao.revogando()).toBe(true);
    resposta.next(ok(undefined));
    resposta.complete();
    await atualizar();
    await atualizar();
    http.expectOne((r) => r.url === URL).flush([]);
    await atualizar();
  });

  it('foca o e-mail recusado pela API', async () => {
    api.revogar.mockReturnValue(of(DIVERGENCIA_DE_EMAIL));
    const fixture = TestBed.createComponent(ConcessoesPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([ativa]);
    await atualizar();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('button[aria-label^="Revogar a concessão"]')?.click();
    await atualizar();
    const edicao = fixture.debugElement.injector.get(RevogacaoDeConcessoes);
    edicao.email.setValue('betina@uniplus-test.local');
    edicao.motivo.setValue('Saiu da função.');
    edicao.confirmar();
    await atualizar();
    await atualizar();
    const email = host.querySelector<HTMLInputElement>('input[type="email"]');
    expect(email?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(email);
  });

  it('mostra e foca a recusa do motivo enviada pela API', async () => {
    api.revogar.mockReturnValue(of(RECUSA_DO_MOTIVO));
    const fixture = TestBed.createComponent(ConcessoesPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL).flush([ativa]);
    await atualizar();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('button[aria-label^="Revogar a concessão"]')?.click();
    await atualizar();
    const edicao = fixture.debugElement.injector.get(RevogacaoDeConcessoes);
    edicao.email.setValue('betina@uniplus-test.local');
    edicao.motivo.setValue('Saiu da função.');
    edicao.confirmar();
    await atualizar();
    await atualizar();
    const motivo = host.querySelector<HTMLTextAreaElement>('textarea');
    expect(motivo?.getAttribute('aria-invalid')).toBe('true');
    expect(host.textContent).toContain('Motivo recusado.');
    expect(edicao.motivo.errors?.['backend'].code).toBe(
      'uniplus.autorizacao.concessao.motivo_invalido',
    );
    expect(document.activeElement).toBe(motivo);
  });
});
