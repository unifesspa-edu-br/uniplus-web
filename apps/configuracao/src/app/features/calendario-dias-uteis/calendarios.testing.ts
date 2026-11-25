import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  CalendarioDiasUteisResumoDto,
} from '@uniplus/shared-data/configuracao';
import { expect, vi } from 'vitest';
import { CalendarioDiasUteisListPage } from './calendario-dias-uteis-list.page';
import { CalendariosStore } from './calendarios.store';
import { EdicaoDosCalendarios } from './edicao-dos-calendarios';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/calendarios-dias-uteis`;
export const ESCRITA = `${BASE}/api/configuracao/admin/calendarios-dias-uteis`;
export const TITULO_DA_LISTA = '#cfg-calendario-dias-uteis-list-title';

export const CALENDARIO_VIGENTE: CalendarioDiasUteisResumoDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b027',
  versaoDoCalendario: '2026.1',
  vigente: true,
  criadoEm: '2026-08-13T12:00:00+00:00',
};

export const CALENDARIO_ANTERIOR: CalendarioDiasUteisResumoDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b028',
  versaoDoCalendario: '2025.2',
  vigente: false,
  criadoEm: '2025-11-04T12:00:00+00:00',
};

export const REMOCAO_DO_VIGENTE = 'uniplus.configuracao.calendario_dias_uteis.nao_remove_vigente';
export const JA_VIGENTE = 'uniplus.configuracao.calendario_dias_uteis.ja_vigente';
export const NAO_ENCONTRADO = 'uniplus.configuracao.calendario_dias_uteis.nao_encontrado';
export const CONFLITO_DE_CONCORRENCIA =
  'uniplus.configuracao.calendario_dias_uteis.conflito_de_concorrencia';
export const PROCESSANDO = 'uniplus.idempotency.processing_conflict';

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const semConteudo = () => [null, { status: 204, statusText: 'No Content' }] as const;

type Confirmacao = 'remocao' | 'vigencia';
const POSICAO_DA_CONFIRMACAO: Readonly<Record<Confirmacao, number>> = { remocao: 1, vigencia: 2 };

/** A página montada com a lista já carregada. */
export async function montarLista(
  itens: readonly CalendarioDiasUteisResumoDto[] = [CALENDARIO_VIGENTE, CALENDARIO_ANTERIOR],
) {
  configurarLista();
  const fixture = TestBed.createComponent(CalendarioDiasUteisListPage);
  const http = TestBed.inject(HttpTestingController);
  const tela = controlesDaLista(fixture);
  const pagina = paginaDaLista(fixture, http, tela);
  fixture.detectChanges();
  http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(itens);
  await tela.propagar();
  return pagina;
}

function paginaDaLista(
  fixture: ComponentFixture<CalendarioDiasUteisListPage>,
  http: HttpTestingController,
  tela: ControlesDaLista,
) {
  return {
    fixture,
    http,
    ...dependenciasDaLista(fixture),
    ...tela,
    ...linhasDaLista(tela),
    ...respostasDaLista(tela, http),
  };
}

function dependenciasDaLista(fixture: ComponentFixture<CalendarioDiasUteisListPage>) {
  const notificacoes = TestBed.inject(NotificationService);
  return {
    edicao: fixture.debugElement.injector.get(EdicaoDosCalendarios),
    store: fixture.debugElement.injector.get(CalendariosStore),
    sucessos: vi.spyOn(notificacoes, 'success'),
    erros: vi.spyOn(notificacoes, 'errorFromProblem'),
  };
}

function configurarLista(): void {
  TestBed.configureTestingModule({
    imports: [CalendarioDiasUteisListPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  });
}

function controlesDaLista(fixture: ComponentFixture<CalendarioDiasUteisListPage>) {
  const app = TestBed.inject(ApplicationRef);
  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const acionar = async (botao: HTMLButtonElement): Promise<void> => {
    botao.focus();
    botao.click();
    await propagar();
  };
  return { propagar, elemento: seletorDaLista(fixture), acionar };
}

function seletorDaLista(fixture: ComponentFixture<CalendarioDiasUteisListPage>) {
  return <T extends HTMLElement>(seletor: string): T => {
    const encontrado = (fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  };
}

type ControlesDaLista = ReturnType<typeof controlesDaLista>;

function linhasDaLista({ elemento }: ControlesDaLista) {
  const pelaEtiqueta = (nome: string): HTMLButtonElement =>
    elemento(`button[aria-label="${nome}"]`);
  return {
    marcarVigente: (c: CalendarioDiasUteisResumoDto = CALENDARIO_ANTERIOR) =>
      pelaEtiqueta(`Marcar vigente ${c.versaoDoCalendario}`),
    remover: (c: CalendarioDiasUteisResumoDto = CALENDARIO_ANTERIOR) =>
      pelaEtiqueta(`Remover calendário ${c.versaoDoCalendario}`),
    visualizar: (c: CalendarioDiasUteisResumoDto = CALENDARIO_ANTERIOR): HTMLAnchorElement =>
      elemento(`a[aria-label="Visualizar calendário ${c.versaoDoCalendario}"]`),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
  };
}

function dialogosDaLista({ elemento }: ControlesDaLista) {
  const confirmacao = (qual: Confirmacao): HTMLElement =>
    elemento(`cfg-confirmacao-de-remocao:nth-of-type(${POSICAO_DA_CONFIRMACAO[qual]})`);
  const botao = (qual: Confirmacao, testid: string): HTMLButtonElement =>
    confirmacao(qual).querySelector(`[data-testid="${testid}"]`) as HTMLButtonElement;
  return {
    confirmacao,
    confirmar: (qual: Confirmacao = 'remocao') => botao(qual, 'confirm-dialog-confirm'),
    cancelarDaConfirmacao: (qual: Confirmacao = 'remocao') => botao(qual, 'confirm-dialog-cancel'),
    dialogo: (qual: Confirmacao): HTMLDialogElement =>
      confirmacao(qual).querySelector('dialog') as HTMLDialogElement,
  };
}

function respostasDaLista(tela: ControlesDaLista, http: HttpTestingController) {
  const dialogos = dialogosDaLista(tela);
  return {
    ...dialogos,
    recarregarCom: (lista: readonly CalendarioDiasUteisResumoDto[]) =>
      recarregarLista(tela, http, lista),
    confirmarRemocao: (c: CalendarioDiasUteisResumoDto = CALENDARIO_ANTERIOR) =>
      confirmarAcao(tela, http, 'remocao', c),
    confirmarVigencia: (c: CalendarioDiasUteisResumoDto = CALENDARIO_ANTERIOR) =>
      confirmarAcao(tela, http, 'vigencia', c),
  };
}

async function recarregarLista(
  tela: ControlesDaLista,
  http: HttpTestingController,
  lista: readonly CalendarioDiasUteisResumoDto[],
): Promise<void> {
  await tela.propagar();
  http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(lista);
  await tela.propagar();
}

async function confirmarAcao(
  tela: ControlesDaLista,
  http: HttpTestingController,
  qual: Confirmacao,
  c: CalendarioDiasUteisResumoDto,
) {
  const linhas = linhasDaLista(tela);
  await tela.acionar(qual === 'remocao' ? linhas.remover(c) : linhas.marcarVigente(c));
  dialogosDaLista(tela).confirmar(qual).click();
  await tela.propagar();
  return http.expectOne(`${ESCRITA}/${c.id}${qual === 'vigencia' ? '/vigente' : ''}`);
}

export type PaginaDaLista = Awaited<ReturnType<typeof montarLista>>;

export function chaveDe(requisicao: {
  request: { headers: { get(nome: string): string | null } };
}): string | null {
  return requisicao.request.headers.get('Idempotency-Key');
}
