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
  versaoDataset: '2026.1',
  vigente: true,
  criadoEm: '2026-08-13T12:00:00+00:00',
};

export const CALENDARIO_ANTERIOR: CalendarioDiasUteisResumoDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b028',
  versaoDataset: '2025.2',
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

/** A página montada com a lista já carregada, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarLista(
  itens: readonly CalendarioDiasUteisResumoDto[] = [CALENDARIO_VIGENTE, CALENDARIO_ANTERIOR],
) {
  TestBed.configureTestingModule({
    imports: [CalendarioDiasUteisListPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  });
  const fixture: ComponentFixture<CalendarioDiasUteisListPage> = TestBed.createComponent(
    CalendarioDiasUteisListPage,
  );
  const http = TestBed.inject(HttpTestingController);
  const app = TestBed.inject(ApplicationRef);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDosCalendarios);
  const store = injetor.get(CalendariosStore);
  const notificacoes = TestBed.inject(NotificationService);
  const sucessos = vi.spyOn(notificacoes, 'success');
  const erros = vi.spyOn(notificacoes, 'errorFromProblem');

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const encontrado = (fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  };
  const pelaEtiqueta = (nome: string): HTMLButtonElement =>
    elemento(`button[aria-label="${nome}"]`);
  const confirmacao = (qual: Confirmacao): HTMLElement =>
    elemento(`cfg-confirmacao-de-remocao:nth-of-type(${POSICAO_DA_CONFIRMACAO[qual]})`);
  const acionar = async (botao: HTMLButtonElement): Promise<void> => {
    botao.focus();
    botao.click();
    await propagar();
  };
  const recarregarCom = async (lista: readonly CalendarioDiasUteisResumoDto[]): Promise<void> => {
    await propagar();
    http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(lista);
    await propagar();
  };
  const botaoDaConfirmacao = (qual: Confirmacao, testid: string): HTMLButtonElement =>
    confirmacao(qual).querySelector(`[data-testid="${testid}"]`) as HTMLButtonElement;

  fixture.detectChanges();
  http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(itens);
  await propagar();

  return {
    fixture,
    http,
    edicao,
    store,
    sucessos,
    erros,
    propagar,
    elemento,
    recarregarCom,
    confirmacao,
    acionar,
    marcarVigente: (c: CalendarioDiasUteisResumoDto = CALENDARIO_ANTERIOR) =>
      pelaEtiqueta(`Marcar vigente ${c.versaoDataset}`),
    remover: (c: CalendarioDiasUteisResumoDto = CALENDARIO_ANTERIOR) =>
      pelaEtiqueta(`Remover calendário ${c.versaoDataset}`),
    visualizar: (c: CalendarioDiasUteisResumoDto = CALENDARIO_ANTERIOR): HTMLAnchorElement =>
      elemento(`a[aria-label="Visualizar calendário ${c.versaoDataset}"]`),
    confirmar: (qual: Confirmacao = 'remocao') =>
      botaoDaConfirmacao(qual, 'confirm-dialog-confirm'),
    cancelarDaConfirmacao: (qual: Confirmacao = 'remocao') =>
      botaoDaConfirmacao(qual, 'confirm-dialog-cancel'),
    dialogo: (qual: Confirmacao): HTMLDialogElement =>
      confirmacao(qual).querySelector('dialog') as HTMLDialogElement,
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
    /** Clica de verdade em "Remover", confirma e devolve a requisição de remoção. */
    async confirmarRemocao(c: CalendarioDiasUteisResumoDto = CALENDARIO_ANTERIOR) {
      await acionar(pelaEtiqueta(`Remover calendário ${c.versaoDataset}`));
      botaoDaConfirmacao('remocao', 'confirm-dialog-confirm').click();
      await propagar();
      return http.expectOne(`${ESCRITA}/${c.id}`);
    },
    /** Clica de verdade em "Marcar vigente", confirma e devolve a requisição de vigência. */
    async confirmarVigencia(c: CalendarioDiasUteisResumoDto = CALENDARIO_ANTERIOR) {
      await acionar(pelaEtiqueta(`Marcar vigente ${c.versaoDataset}`));
      botaoDaConfirmacao('vigencia', 'confirm-dialog-confirm').click();
      await propagar();
      return http.expectOne(`${ESCRITA}/${c.id}/vigente`);
    },
  };
}

export type PaginaDaLista = Awaited<ReturnType<typeof montarLista>>;

export function chaveDe(requisicao: {
  request: { headers: { get(nome: string): string | null } };
}): string | null {
  return requisicao.request.headers.get('Idempotency-Key');
}
