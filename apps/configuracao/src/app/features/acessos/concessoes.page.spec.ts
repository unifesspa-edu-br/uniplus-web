import { RevogacaoDeConcessoes } from './revogacao-de-concessoes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure, apiResultInterceptor } from '@uniplus/shared-core/http';
import { HttpHeaders } from '@angular/common/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  ConcessoesApi,
  type ConcessaoDto,
} from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { FALHA_INESPERADA } from './mensagens-de-acesso';
import { ConcessoesPage } from './concessoes.page';
import { ConcessoesStore } from './concessoes.store';
import { ok, recusa, UNIDADES } from './testes';

const DIVERGENCIA_DE_EMAIL = apiFailure(
  {
    type: 'x',
    title: 'Dados inválidos',
    status: 422,
    code: 'uniplus.validacao',
    traceId: '',
    errors: [
      {
        field: 'confirmacaoEmail',
        code: 'uniplus.autorizacao.concessao.confirmacao_divergente',
        message: 'O e-mail informado não é o do beneficiário da concessão.',
      },
    ],
  },
  422,
  new HttpHeaders(),
);

const RECUSA_DO_MOTIVO = apiFailure(
  {
    type: 'x',
    title: 'Dados inválidos',
    status: 422,
    code: 'uniplus.validacao',
    traceId: '',
    errors: [
      {
        field: 'Motivo',
        code: 'uniplus.autorizacao.concessao.motivo_invalido',
        message: 'Motivo recusado.',
      },
    ],
  },
  422,
  new HttpHeaders(),
);

const URL = 'http://api.test/api/autorizacao/concessoes';
const ativa: ConcessaoDto = {
  id: 'c1',
  beneficiario: { emissor: 'unifesspa', sub: '0123456789abcdef' },
  perfil: { id: 'p1', nome: 'Operador de inscrições' },
  versao: 2,
  escopo: { tipo: 'unidade', unidadeId: 'unidade-1' },
  origem: { tipo: 'pedido', id: 'pedido-1' },
  concedidaEm: '2026-10-28T12:00:00Z',
  validaAte: null,
  revogadaEm: null,
  revogadaPor: null,
  revogadaPelaJanelaId: null,
  motivoRevogacao: null,
  ativa: true,
};

describe('ConcessoesPage', () => {
  let http: HttpTestingController;
  const api = { revogar: vi.fn() };
  const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        { provide: ConcessoesApi, useValue: api },
        { provide: NotificationService, useValue: notificacoes },
        { provide: UnidadesApi, useValue: { listar: () => of(ok(UNIDADES)) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function atualizar(): Promise<void> {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
  }

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
