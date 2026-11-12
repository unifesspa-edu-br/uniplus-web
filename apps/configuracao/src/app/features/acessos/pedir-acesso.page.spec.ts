import { HttpHeaders } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure } from '@uniplus/shared-core/http';
import { EdicaoDoPedidoDeAcesso } from './edicao-do-pedido-de-acesso';
import { ok, pedido, recusa } from './testes';
import { dublesDoPedirAcesso, montarPedirAcesso } from './pedir-acesso.page.testing';

describe('PedirAcessoPage — formulário e leitura dos perfis', () => {
  const dubles = dublesDoPedirAcesso();
  const { api, notificacoes } = dubles;
  const montar = (primeiraLeituraDosPerfis?: ReturnType<typeof recusa>) =>
    montarPedirAcesso(dubles, primeiraLeituraDosPerfis);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
    const { host, digitar, campo, fixture } = await montar();
    digitar('select[formcontrolname="perfilId"]', 'perfil-1');
    campo<HTMLInputElement>('input[value="outra"]').click();
    fixture.detectChanges();
    for (const campo of ['perfilId', 'justificativa', 'unidadeId', 'beneficiarioEmail']) {
      expect(
        host.querySelector(`[formcontrolname="${campo}"]`)?.getAttribute('aria-required'),
      ).toBe('true');
    }
  });

  it('mantém os valores e o foco durante o envio e recusa nova submissão', async () => {
    const resposta = new Subject<ReturnType<typeof ok<ReturnType<typeof pedido>>>>();
    api.criar.mockReturnValue(resposta);
    const { fixture, host, digitar, campo } = await montar();
    digitar('select[formcontrolname="perfilId"]', 'perfil-2');
    digitar('textarea[formcontrolname="justificativa"]', 'Preciso deste acesso para trabalhar.');
    const botao = campo<HTMLButtonElement>('button[type="submit"]');
    botao.focus();
    botao.click();
    fixture.detectChanges();

    const justificativa = campo<HTMLTextAreaElement>('textarea[formcontrolname="justificativa"]');
    expect(justificativa.matches(':disabled')).toBe(true);
    expect(justificativa.value).toBe('Preciso deste acesso para trabalhar.');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(botao);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Enviando pedido');
    botao.click();
    campo<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(api.criar).toHaveBeenCalledTimes(1);

    resposta.next(ok(pedido()));
    resposta.complete();
    await fixture.whenStable();
  });

  it('apresenta a recusa no campo e leva o foco a ele', async () => {
    api.criar.mockReturnValue(
      of(
        apiFailure(
          {
            type: 'x',
            title: 'Dados inválidos',
            status: 422,
            code: 'validacao',
            traceId: '',
            errors: [
              { field: 'Justificativa', code: 'invalida', message: 'Justificativa recusada.' },
            ],
          },
          422,
          new HttpHeaders(),
        ),
      ),
    );
    const { fixture, digitar, enviar, campo, host } = await montar();
    digitar('select[formcontrolname="perfilId"]', 'perfil-2');
    digitar('textarea', 'Preciso deste acesso para trabalhar.');
    campo<HTMLButtonElement>('button[type="submit"]').focus();
    await enviar();
    await fixture.whenStable();
    const justificativa = campo<HTMLTextAreaElement>('textarea');
    expect(justificativa.getAttribute('aria-invalid')).toBe('true');
    expect(host.textContent).toContain('Justificativa recusada.');
    expect(document.activeElement).toBe(justificativa);
    expect(notificacoes.errorFromProblem).not.toHaveBeenCalled();
  });

  it('Enter num campo leva o foco ao botão de enviar e, na falha 500, o foco fica nele e a falha é notificada', async () => {
    const resposta = new Subject<ReturnType<typeof recusa>>();
    api.criar.mockReturnValue(resposta);
    const { fixture, host, digitar, campo } = await montar();
    digitar('select[formcontrolname="perfilId"]', 'perfil-2');
    digitar('textarea', 'Preciso deste acesso para trabalhar.');
    const justificativa = campo<HTMLTextAreaElement>('textarea');
    justificativa.focus();

    campo<HTMLFormElement>('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const botao = campo<HTMLButtonElement>('button[type="submit"]');
    expect(justificativa.matches(':disabled')).toBe(true);
    expect(document.activeElement).toBe(botao);

    resposta.next(recusa('uniplus.internal.unexpected', 500, 'Erro interno'));
    resposta.complete();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.textContent).toContain('Erro interno');
    expect(document.activeElement).toBe(botao);
    expect(botao.getAttribute('aria-disabled')).toBeNull();
    expect(api.criar).toHaveBeenCalledTimes(1);
    expect(notificacoes.errorFromProblem).toHaveBeenCalledOnce();
    expect(notificacoes.errorFromProblem.mock.calls[0]?.[1]).toEqual({ title: 'Erro interno' });
  });

  it('recusa chamadas concorrentes à classe de escrita', async () => {
    const resposta = new Subject<ReturnType<typeof ok<ReturnType<typeof pedido>>>>();
    api.criar.mockReturnValue(resposta);
    const { fixture, digitar } = await montar();
    digitar('select[formcontrolname="perfilId"]', 'perfil-2');
    digitar('textarea', 'Preciso deste acesso para trabalhar.');
    const edicao = fixture.debugElement.injector.get(EdicaoDoPedidoDeAcesso);
    const primeira = edicao.enviar();
    expect(edicao.enviando()).toBe(true);
    await edicao.enviar();
    expect(api.criar).toHaveBeenCalledTimes(1);
    resposta.next(ok(pedido()));
    resposta.complete();
    await primeira;
    expect(edicao.enviando()).toBe(false);
  });

  it('lista os perfis que a API oferece para pedir', async () => {
    const { host } = await montar();

    const opcoes = Array.from(
      host.querySelectorAll('select[formcontrolname="perfilId"] option'),
    ).map((o) => o.textContent?.trim());
    expect(opcoes).toEqual([
      'Selecione um perfil',
      'Operador de inscrições',
      'Gestor de acessos',
      'Representante do controlador',
    ]);
    expect(host.querySelector('input[formcontrolname="perfilId"]')).toBeNull();
  });

  it('a recusa da leitura dos perfis não oferece nova tentativa nem pede o código do perfil', async () => {
    const { host } = await montar(
      recusa('uniplus.autorizacao.pedido.solicitante_nao_institucional', 403),
    );

    expect(host.textContent).toContain('Acesso negado');
    expect(host.textContent).toContain('Recusado');
    expect(host.textContent).not.toContain('Tentar novamente');
    expect(host.querySelector('select[formcontrolname="perfilId"]')).toBeNull();
    expect(host.querySelector('input[formcontrolname="perfilId"]')).toBeNull();
  });

  describe('perfis indisponíveis', () => {
    const indisponiveis = () => recusa('uniplus.internal.unexpected', 503, 'Indisponível');
    const tentar = (host: HTMLElement) =>
      [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Tentar novamente'));

    it('"Tentar novamente" lê os perfis de novo e leva o foco ao seletor de perfil', async () => {
      const { fixture, host } = await montar(indisponiveis());
      expect(host.querySelector('select[formcontrolname="perfilId"]')).toBeNull();
      const consultas = api.perfisParaPedir.mock.calls.length;
      tentar(host)?.focus();

      tentar(host)?.click();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(api.perfisParaPedir.mock.calls.length).toBe(consultas + 1);
      expect(tentar(host)).toBeUndefined();
      expect(document.activeElement).toBe(host.querySelector('select[formcontrolname="perfilId"]'));
    });

    it('o botão fica indisponível enquanto os perfis carregam e não pede de novo', async () => {
      const { fixture, host } = await montar(indisponiveis());
      const resposta = new Subject<ReturnType<typeof ok>>();
      api.perfisParaPedir.mockReturnValue(resposta);
      const botao = tentar(host);
      botao?.click();
      fixture.detectChanges();
      const consultas = api.perfisParaPedir.mock.calls.length;

      expect(botao?.getAttribute('aria-disabled')).toBe('true');
      expect(botao?.getAttribute('aria-busy')).toBe('true');
      botao?.click();
      expect(api.perfisParaPedir.mock.calls.length).toBe(consultas);
    });
  });

  it('não envia o pedido incompleto', async () => {
    const { enviar, host } = await montar();

    await enviar();

    expect(api.criar).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Selecione o perfil.');
    expect(host.textContent).toContain('A justificativa deve ter de 10 a 2000 caracteres.');
  });

  it('liga cada mensagem de erro ao campo e leva o foco ao primeiro inválido', async () => {
    const { enviar, host, fixture } = await montar();

    await enviar();
    await fixture.whenStable();

    const perfil = host.querySelector('select[formcontrolname="perfilId"]') as HTMLElement;
    expect(perfil.getAttribute('aria-describedby')).toBe('cfg-pedir-perfilId-erro');
    expect(host.querySelector('#cfg-pedir-perfilId-erro')?.textContent).toContain('Selecione');
    const justificativa = host.querySelector('textarea') as HTMLElement;
    expect(justificativa.getAttribute('aria-describedby')).toBe('cfg-pedir-justificativa-erro');
    expect(document.activeElement).toBe(perfil);
  });
});
