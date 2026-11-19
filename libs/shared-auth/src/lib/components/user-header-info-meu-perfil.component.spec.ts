import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import type { UserHeaderInfoComponent } from './user-header-info.component';
import {
  concedidos,
  estadoDosPerfis,
  perfil,
  recarregar,
  responderRecarga,
  setup,
} from './user-header-info.component.testing';

describe('UserHeaderInfoComponent — Meu perfil', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const resposta = {
    userId: 'abc-123',
    name: 'Usuário Candidato',
    email: 'candidato@teste.unifesspa.edu.br',
    cpf: '69959836371',
    nomeSocial: 'Candidato Teste',
    perfis: [],
    timestamp: '2026-10-05T12:00:00Z',
  };

  const perfilComPrazo = {
    ...perfil('Gestor de processo seletivo', 'CEPS'),
    validaAte: '2026-12-31T23:59:00-03:00',
  };

  function achar(host: HTMLElement, seletor: string): HTMLElement {
    const el = host.querySelector<HTMLElement>(seletor);
    if (el === null) throw new Error(`elemento não renderizado: ${seletor}`);
    return el;
  }

  function clicarEAtualizar(fixture: ComponentFixture<UserHeaderInfoComponent>, alvo: HTMLElement) {
    alvo.click();
    fixture.detectChanges();
  }

  function pedirMeuPerfil(fixture: ComponentFixture<UserHeaderInfoComponent>): void {
    const host: HTMLElement = fixture.nativeElement;
    clicarEAtualizar(fixture, achar(host, 'button.user-chip'));
    clicarEAtualizar(fixture, achar(host, '[data-testid="auth-user-profile-item"]'));
  }

  function botaoDoCpf(host: HTMLElement): HTMLElement {
    return achar(host, '[data-testid="auth-profile-cpf-toggle"]');
  }

  function cpfExibido(host: HTMLElement): string | undefined {
    return host.querySelector('[data-testid="auth-profile-cpf"]')?.textContent?.trim();
  }

  function abrirPerfil() {
    const ctx = setup();
    pedirMeuPerfil(ctx.fixture);
    /** Entrega a resposta da consulta única que o serviço faz ao abrir o modal. */
    const responder = async (resposta: unknown) => {
      responderRecarga(resposta);
      await ctx.fixture.whenStable();
      ctx.fixture.detectChanges();
    };
    return { ...ctx, responder };
  }

  async function abrirPerfilRespondido(dados: unknown = resposta) {
    const ctx = abrirPerfil();
    await ctx.responder(dados);
    return ctx;
  }

  it('só consulta o perfil depois de pedir Meu perfil, e uma única vez', () => {
    const { fixture } = setup();
    fixture.nativeElement.querySelector('button.user-chip').click();
    fixture.detectChanges();
    expect(recarregar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('auth-user-profile-dialog')).toBeNull();

    fixture.nativeElement.querySelector('[data-testid="auth-user-profile-item"]').click();
    fixture.detectChanges();

    expect(recarregar).toHaveBeenCalledOnce();
    expect(TestBed.inject(HttpTestingController).match(() => true)).toEqual([]);
  });

  it('fecha o menu e abre o modal exibindo os dados retornados pela API', async () => {
    const { fixture } = await abrirPerfilRespondido();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.menu')?.hasAttribute('hidden')).toBe(true);
    const dados = el.querySelector('[data-testid="auth-profile-data"]');
    expect(dados?.textContent).toContain('Usuário Candidato');
    expect(dados?.textContent).toContain('Candidato Teste');
    expect(dados?.textContent).toContain('candidato@teste.unifesspa.edu.br');
    // CPF abre mascarado no padrão do Uni+ (***.999.999-**): sem os verificadores.
    expect(dados?.textContent).toContain('***.598.363-**');
    expect(dados?.textContent).not.toContain('699.');
    expect(dados?.textContent).not.toContain('-71');
  });

  it('oferece "Alterar nome social" quando a conta tem nome social e abre a atualização do perfil', async () => {
    const { fixture, atualizarPerfil } = await abrirPerfilRespondido();

    const acao = fixture.nativeElement.querySelector(
      '[data-testid="auth-profile-nome-social-acao"]',
    ) as HTMLButtonElement;
    expect(acao.textContent?.trim()).toBe('Alterar nome social');
    acao.click();
    expect(atualizarPerfil).toHaveBeenCalledTimes(1);
  });

  it('oferece "Cadastrar nome social" quando a conta não tem nome social', async () => {
    const { fixture, responder } = abrirPerfil();
    await responder({ ...resposta, nomeSocial: null });

    const acao = fixture.nativeElement.querySelector(
      '[data-testid="auth-profile-nome-social-acao"]',
    );
    expect(acao?.textContent?.trim()).toBe('Cadastrar nome social');
  });

  it('anuncia o carregamento, mas não lê os dados do perfil, com o CPF, sozinho', async () => {
    const { fixture, responder } = abrirPerfil();
    const el: HTMLElement = fixture.nativeElement;
    expect(
      el.querySelector('[data-testid="auth-profile-loading"]')?.closest('[aria-live]'),
    ).not.toBeNull();

    await responder(resposta);

    expect(
      el.querySelector('[data-testid="auth-profile-data"]')?.closest('[aria-live]'),
    ).toBeNull();
  });

  it('revela e volta a ocultar o CPF pelo botão de olho', async () => {
    const { fixture, host } = await abrirPerfilRespondido();
    const toggle = botaoDoCpf(host);
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar CPF');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    clicarEAtualizar(fixture, toggle);
    expect(cpfExibido(host)).toBe('699.598.363-71');
    // O nome não muda: o estado é dito só pelo aria-pressed.
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar CPF');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    clicarEAtualizar(fixture, toggle);
    expect(cpfExibido(host)).toBe('***.598.363-**');
  });

  it('não oferece o botão de olho quando o CPF não tem 11 dígitos', async () => {
    const { fixture, responder } = abrirPerfil();
    await responder({ ...resposta, cpf: '123' });

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="auth-profile-cpf-toggle"]')).toBeNull();
    expect(el.querySelector('[data-testid="auth-profile-cpf"]')?.textContent?.trim()).toBe(
      '***.***.***-**',
    );
  });

  it('volta a mascarar o CPF ao reabrir o modal', async () => {
    const { fixture, host, responder } = await abrirPerfilRespondido();
    clicarEAtualizar(fixture, botaoDoCpf(host));
    expect(cpfExibido(host)).toBe('699.598.363-71');

    achar(host, 'dialog').dispatchEvent(new Event('close'));
    fixture.detectChanges();
    pedirMeuPerfil(fixture);
    await responder(resposta);

    expect(cpfExibido(host)).toBe('***.598.363-**');
  });

  it('fecha ao clicar fora do painel, mas não ao clicar dentro dele', async () => {
    const { fixture } = await abrirPerfilRespondido();
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    expect(dialog.open).toBe(true);

    dialog.querySelector<HTMLElement>('.uni-dialog__panel')?.click();
    expect(dialog.open).toBe(true);

    dialog.click();
    expect(dialog.open).toBe(false);
  });

  function perfisDoModal(fixture: ComponentFixture<UserHeaderInfoComponent>): HTMLElement {
    const el = fixture.nativeElement.querySelector('[data-testid="auth-profile-perfis"]');
    if (el === null) throw new Error('perfis do modal não renderizados');
    return el;
  }

  it('lista os perfis com o escopo e o prazo "até dd/mm/aaaa" quando há prazo', async () => {
    const { fixture } = await abrirPerfilRespondido();
    concedidos.set([perfilComPrazo, perfil('Consulta institucional', null)]);
    fixture.detectChanges();

    const itens = perfisDoModal(fixture).querySelectorAll('li');
    expect(itens[0]?.textContent).toContain('Gestor de processo seletivo');
    expect(itens[0]?.textContent).toContain('CEPS');
    expect(itens[0]?.textContent).toContain('até 31/12/2026');
    expect(itens[1]?.textContent).not.toContain('até');
  });

  it('mostra "Unidade não identificada" para o perfil numa unidade que não existe mais', async () => {
    const { fixture } = await abrirPerfilRespondido();
    concedidos.set([perfil('Gestor de processo seletivo', null)]);
    fixture.detectChanges();

    expect(perfisDoModal(fixture).textContent).toContain('Unidade não identificada');
  });

  it('mostra "Nenhum perfil de acesso" e nada de "Candidato" a quem não tem perfil', async () => {
    const { fixture } = await abrirPerfilRespondido();

    expect(perfisDoModal(fixture).textContent).toContain('Nenhum perfil de acesso');
    expect(perfisDoModal(fixture).textContent).not.toContain('Candidato');
  });

  it('distingue a falha da consulta de perfis de "sem perfil"', async () => {
    const { fixture } = await abrirPerfilRespondido();
    estadoDosPerfis.set('indisponivel');
    fixture.detectChanges();

    expect(perfisDoModal(fixture).textContent).toContain(
      'Não foi possível carregar os perfis de acesso',
    );
    expect(perfisDoModal(fixture).textContent).not.toContain('Nenhum perfil de acesso');
  });

  it('mostra mensagem de erro quando a API falha', async () => {
    const { fixture, responder } = abrirPerfil();
    await responder(null);
    expect(fixture.nativeElement.querySelector('[data-testid="auth-profile-error"]')).toBeTruthy();
  });

  it('desmonta o modal e devolve o foco ao chip quando ele fecha', async () => {
    const { fixture } = await abrirPerfilRespondido();

    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialog.dispatchEvent(new Event('close'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('auth-user-profile-dialog')).toBeNull();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('button.user-chip'));
  });
});
