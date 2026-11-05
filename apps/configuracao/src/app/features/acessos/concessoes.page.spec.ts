import { RevogacaoDeConcessoes } from './revogacao-de-concessoes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
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
import { ConcessoesPage } from './concessoes.page';
import { ConcessoesStore } from './concessoes.store';
import { ok, recusa, UNIDADES } from './testes';

const URL = 'http://api.test/api/autorizacao/concessoes';
const ativa: ConcessaoDto = {
  id: 'c1',
  beneficiario: { emissor: 'unifesspa', sub: '0123456789abcdef' },
  perfil: { id: 'p1', nome: 'Operador de inscrições' },
  escopo: { tipo: 'unidade', unidadeId: 'unidade-1' },
  origem: { tipo: 'pedido', id: 'pedido-1' },
  concedidaEm: '2026-10-28T12:00:00Z',
  validaAte: null,
  revogadaEm: null,
  revogadaPor: null,
  motivoRevogacao: null,
  ativa: true,
};

describe('ConcessoesPage', () => {
  let http: HttpTestingController;
  const api = { revogar: vi.fn() };
  const notificacoes = { success: vi.fn() };
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

  it.each([
    ['uniplus.autorizacao.concessao.minimo_de_gestores', false],
    ['uniplus.autorizacao.concessao.confirmacao_divergente', true],
  ])('mantém o diálogo aberto e apresenta a recusa %s', async (codigo, noEmail) => {
    api.revogar.mockReturnValue(of(recusa(codigo)));
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
    await pagina.revogar(
      'Saiu da função.',
      noEmail ? 'outra@uniplus-test.local' : 'betina@uniplus-test.local',
    );
    expect(pagina.revogando()).toBe(true);
    expect(pagina.erroDoEmail()).toBe(noEmail ? 'Recusado' : null);
    expect(pagina.erroDaRevogacao()).toBe(noEmail ? null : 'Recusado');
    expect(notificacoes.success).not.toHaveBeenCalled();
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
    api.revogar.mockReturnValue(of(recusa('uniplus.autorizacao.concessao.confirmacao_divergente')));
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
    api.revogar.mockReturnValue(
      of(
        apiFailure(
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
        ),
      ),
    );
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
});
