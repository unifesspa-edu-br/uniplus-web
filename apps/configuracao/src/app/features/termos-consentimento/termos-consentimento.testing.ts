import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  TermoConsentimentoDto,
  TermoConsentimentoVersaoDto,
} from '@uniplus/shared-data/configuracao';
import { expect } from 'vitest';
import { EdicaoDosTermosConsentimento } from './edicao-dos-termos-consentimento';
import { TermoConsentimentoStore } from './termo-consentimento.store';
import { TermosConsentimentoDetailPage } from './termos-consentimento-detail.page';

export const BASE = 'http://localhost:5000';
export const ID = '01960000-0000-7000-0000-0000000000a1';
export const LEITURA = `${BASE}/api/configuracao/termos-consentimento/${ID}`;
export const ADMIN = `${BASE}/api/configuracao/admin/termos-consentimento`;
export const RASCUNHO = `${ADMIN}/${ID}/rascunho`;
export const REVISAR = `${ADMIN}/${ID}/revisar`;
export const PROMOVER = `${ADMIN}/${ID}/promover`;
export const REMOVER = `${ADMIN}/${ID}`;

/** Códigos que a API emite para o termo de consentimento e para o filtro de idempotência. */
export const CODIGOS = {
  revisaoSemTexto: 'uniplus.configuracao.termo_consentimento.revisao_sem_texto',
  textoTamanho: 'uniplus.configuracao.termo_consentimento.texto_tamanho',
  nomeObrigatorio: 'uniplus.configuracao.termo_consentimento.nome_obrigatorio',
  remocaoBloqueada:
    'uniplus.configuracao.termo_consentimento.remocao_bloqueada_com_versao_promovida',
  conflitoDeConcorrencia: 'uniplus.configuracao.termo_consentimento.conflito_de_concorrencia',
  processingConflict: 'uniplus.idempotency.processing_conflict',
  erroInterno: 'uniplus.internal.unexpected',
} as const;

export const SEM_CONTEUDO = { status: 204, statusText: 'No Content' } as const;

export function termo(sobrescritas: Partial<TermoConsentimentoDto> = {}): TermoConsentimentoDto {
  return {
    id: ID,
    nome: 'Declaração de veracidade',
    textoRascunho: 'Declaro que as informações são verdadeiras.',
    baseLegalRascunho: 'Lei nº 13.709/2018',
    formaAceiteRascunho: 'A_DEFINIR',
    revisado: false,
    revisadoEm: null,
    versoes: [],
    criadoEm: '2026-08-11T12:00:00Z',
    ...sobrescritas,
  };
}

export function versao(
  sobrescritas: Partial<TermoConsentimentoVersaoDto> = {},
): TermoConsentimentoVersaoDto {
  return {
    id: '01960000-0000-7000-0000-0000000000a2',
    texto: 'Declaro que as informações são verdadeiras.',
    baseLegal: 'Lei nº 13.709/2018',
    formaAceite: 'A_DEFINIR',
    hash: 'abc123',
    promovidaEm: '2026-08-11T13:00:00Z',
    ...sobrescritas,
  };
}

export const REVISADO = termo({ revisado: true, revisadoEm: '2026-08-11T13:00:00Z' });

/** Responde a requisição com um `ProblemDetails`, como a API. */
export function recusar(
  requisicao: TestRequest,
  status: number,
  code: string,
  title: string,
): void {
  responderComProblema(requisicao, { type: 'about:blank', title, status, code });
}

/** Responde com a recusa 422 de campos que a API devolve para dados inválidos. */
export function recusarCampos(
  requisicao: TestRequest,
  errors: readonly { field: string; code: string; message: string }[],
): void {
  responderComProblema(requisicao, {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    code: 'uniplus.validacao',
    errors,
  });
}

function responderComProblema(
  requisicao: TestRequest,
  problema: { status: number } & Record<string, unknown>,
): void {
  requisicao.flush(problema, {
    status: problema.status,
    statusText: 'Erro',
    headers: { 'content-type': 'application/problem+json' },
  });
}

export interface CenaDoDetalhe {
  readonly fixture: ComponentFixture<TermosConsentimentoDetailPage>;
  readonly controller: HttpTestingController;
  readonly edicao: EdicaoDosTermosConsentimento;
  readonly store: TermoConsentimentoStore;
  readonly notificacoes: NotificationService;
  propagar(): Promise<void>;
  elemento<T extends HTMLElement>(seletor: string): T;
  /** O botão pelo texto visível, sem os espaços das bordas. */
  botao(texto: string): HTMLButtonElement;
  /** O cabeçalho da página, destino do foco quando o acionador some. */
  titulo(): HTMLElement;
  /** Os títulos dos avisos na tela, na ordem. */
  avisos(): string[];
}

function configurarDetalhe(id: string | null): void {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TermosConsentimentoDetailPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([
        { path: 'termos-consentimento', children: [] },
        { path: 'termos-consentimento/:id', children: [] },
      ]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap(id === null ? {} : { id }) } },
      },
    ],
  });
}

function buscarElemento<T extends HTMLElement>(raiz: HTMLElement, seletor: string): T {
  const encontrado = raiz.querySelector<T>(seletor);
  expect(encontrado, seletor).not.toBeNull();
  return encontrado as T;
}

function buscarBotao(raiz: HTMLElement, texto: string): HTMLButtonElement {
  const encontrado = [...raiz.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === texto,
  );
  expect(encontrado, texto).toBeDefined();
  return encontrado as HTMLButtonElement;
}

function criarCena(fixture: ComponentFixture<TermosConsentimentoDetailPage>): CenaDoDetalhe {
  const appRef = TestBed.inject(ApplicationRef);
  const notificacoes = TestBed.inject(NotificationService);
  const raiz: HTMLElement = fixture.nativeElement;
  const cena: CenaDoDetalhe = {
    fixture,
    controller: TestBed.inject(HttpTestingController),
    edicao: fixture.debugElement.injector.get(EdicaoDosTermosConsentimento),
    store: fixture.debugElement.injector.get(TermoConsentimentoStore),
    notificacoes,
    async propagar() {
      await Promise.resolve();
      appRef.tick();
      fixture.detectChanges();
    },
    elemento: <T extends HTMLElement>(seletor: string): T => buscarElemento<T>(raiz, seletor),
    botao: (texto: string): HTMLButtonElement => buscarBotao(raiz, texto),
    titulo: () => cena.elemento('h1'),
    avisos: () => notificacoes.notifications().map((item) => item.title),
  };
  return cena;
}

/**
 * Monta a página do termo. Com `id`, a leitura inicial é respondida com `leitura` (ou fica
 * pendente se `leitura` for `null`); sem `id`, é a página de criação.
 */
export async function montarDetalhe(
  id: string | null,
  leitura: TermoConsentimentoDto | null = termo(),
): Promise<CenaDoDetalhe> {
  configurarDetalhe(id);
  const fixture = TestBed.createComponent(TermosConsentimentoDetailPage);
  const cena = criarCena(fixture);
  fixture.detectChanges();
  if (id !== null && leitura !== null) {
    cena.controller.expectOne(LEITURA).flush(leitura);
    await cena.propagar();
  }
  return cena;
}
