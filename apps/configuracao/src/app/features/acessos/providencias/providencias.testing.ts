import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { AUTORIZACAO_BASE_PATH, type ProvidenciaDto } from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { ok } from '../testes';

export const ADMINISTRAR = PERMISSAO.autorizacao.concessoesAdministrar;
export const SOLICITAR = PERMISSAO.autorizacao.providenciasSolicitar;
export const ROTA = 'http://api.test/api/autorizacao/providencias';
export const ID = '01960000-0000-7000-0000-0000000000e1';
const EMISSOR = 'https://sso.unifesspa.edu.br/realms/unifesspa';

export const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn(), info: vi.fn() };

export function pessoa(sub: string, nome: string) {
  return { emissor: EMISSOR, sub, nome };
}

/** A concessão ativa do Leandro, sobre a qual a providência é pedida. */
const CONCESSAO_DO_LEANDRO: ProvidenciaDto['concessao'] = {
  id: 'c1',
  beneficiario: pessoa('sub-leandro', 'Leandro Viana'),
  perfil: { id: 'p1', nome: 'Banca de documentos' },
  escopo: { tipo: 'unidade', unidadeId: 'unidade-1' },
  validaAte: null,
  ativa: true,
};

const ABERTA: Omit<ProvidenciaDto, 'solicitadaPor' | 'concessao'> = {
  id: ID,
  tipo: 'retirada',
  fundamento: 'Deixou a banca e mantém acesso a documentos sensíveis.',
  situacao: 'aberta',
  abertaEm: '2026-11-10T12:00:00Z',
  encerramentoDaConcessao: null,
  desfecho: null,
  impedidoDeResponder: false,
};

/** A providência aberta do Kevin, Encarregado de dados, sobre a concessão do Leandro. */
export function providencia(parcial: Partial<ProvidenciaDto> = {}): ProvidenciaDto {
  const solicitadaPor = pessoa('sub-kevin', 'Kevin Carvalho');
  return { ...ABERTA, solicitadaPor, concessao: CONCESSAO_DO_LEANDRO, ...parcial };
}

/** O 409 ou o 422 como a API o devolve, em problem+json. */
export function problema(status: number, code: string, extra: object = {}) {
  return [
    JSON.stringify({ type: 'x', title: 'Recusado', status, code, traceId: 't', ...extra }),
    { status, statusText: 'Recusado', headers: { 'content-type': 'application/problem+json' } },
  ] as const;
}

function permissoesDe(concedidas: readonly string[]) {
  return {
    tem: (c: string) => concedidas.includes(c),
    temAlguma: (...c: string[]) => c.some((x) => concedidas.includes(x)),
    garantir: () => Promise.resolve(),
  };
}

export interface Montagem<T> {
  readonly fixture: ComponentFixture<T>;
  readonly host: HTMLElement;
  readonly http: HttpTestingController;
}

function provedores(concedidas: readonly string[]) {
  return [
    provideRouter([]),
    provideMensagensDeAcesso(),
    provideHttpClient(withInterceptors([apiResultInterceptor])),
    provideHttpClientTesting(),
    { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
    { provide: NotificationService, useValue: notificacoes },
    { provide: PermissoesService, useValue: permissoesDe(concedidas) },
    { provide: UnidadesApi, useValue: { listar: () => of(ok([])) } },
  ];
}

/** Monta a tela com a API de teste, as permissões dadas e as mensagens de acesso registradas. */
export function montar<T>(componente: Type<T>, concedidas: readonly string[]): Montagem<T> {
  TestBed.configureTestingModule({ providers: provedores(concedidas) });
  const fixture = TestBed.createComponent(componente);
  const host = fixture.nativeElement as HTMLElement;
  document.body.appendChild(host);
  return { fixture, host, http: TestBed.inject(HttpTestingController) };
}

export async function assentar(): Promise<void> {
  for (let vez = 0; vez < 3; vez++) {
    await new Promise((resolver) => setTimeout(resolver));
    TestBed.inject(ApplicationRef).tick();
  }
}

/** O botão visível pelo texto, onde quer que esteja (diálogos inclusive). */
export function botao(texto: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.replace(/\s+/g, ' ').trim() === texto,
  );
}

export function digitar(campo: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}
