import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { expect } from 'vitest';
import { EdicaoDasFasesCanonicas } from './edicao-das-fases-canonicas';
import { FasesCanonicasPage } from './fases-canonicas.page';
import { FasesCanonicasStore } from './fases-canonicas.store';

export const BASE = 'http://localhost:5000';
export const URL_DA_LISTA = `${BASE}/api/configuracao/fases-canonicas`;
export const URL_DAS_UNIDADES = `${BASE}/api/organizacao/unidades`;
export const CRIAR_URL = `${BASE}/api/configuracao/admin/fases-canonicas`;

export const faseAvaliacaoSeed: FaseCanonicaDto = {
  id: '01960000-0000-7000-0000-0000000000f1',
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  descricao: null,
  unidadeSugerida: null,
  agrupaEtapas: true,
  permiteComplementacao: false,
  admiteAgruparEtapas: true,
  admiteComplementacao: false,
  baseLegal: null,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: 'NO_EDITAL',
  criadoEm: '2026-06-10T12:00:00Z',
};

export const faseRecursoSeed: FaseCanonicaDto = {
  ...faseAvaliacaoSeed,
  id: '01960000-0000-7000-0000-0000000000f2',
  codigo: 'RECURSO',
  nome: 'Recurso',
};

export const urlRemocao = (fase: FaseCanonicaDto): string => `${CRIAR_URL}/${fase.id}`;

export interface CenaDaPagina {
  readonly fixture: ComponentFixture<FasesCanonicasPage>;
  readonly store: FasesCanonicasStore;
  readonly edicao: EdicaoDasFasesCanonicas;
  readonly controller: HttpTestingController;
  readonly appRef: ApplicationRef;
}

function configurarModuloDaPagina(): void {
  TestBed.configureTestingModule({
    imports: [FasesCanonicasPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
    ],
  });
}

export function montarPagina(): CenaDaPagina {
  configurarModuloDaPagina();
  const fixture = TestBed.createComponent(FasesCanonicasPage);
  const injetor = fixture.debugElement.injector;
  const cena = {
    fixture,
    store: injetor.get(FasesCanonicasStore),
    edicao: injetor.get(EdicaoDasFasesCanonicas),
    controller: TestBed.inject(HttpTestingController),
    appRef: TestBed.inject(ApplicationRef),
  };
  fixture.detectChanges();
  return cena;
}

/** A tela nunca deve emitir a criação de fase canônica. */
export function verificarRequisicoesDaPagina(cena: CenaDaPagina): void {
  cena.controller.expectNone((r) => r.method === 'POST' && r.url === CRIAR_URL);
  cena.controller.verify();
}

export async function propagar(cena: CenaDaPagina): Promise<void> {
  await Promise.resolve();
  cena.appRef.tick();
}

export async function responderLista(
  cena: CenaDaPagina,
  itens: readonly FaseCanonicaDto[],
  unidades: readonly unknown[] = [],
): Promise<void> {
  const req = cena.controller.expectOne((r) => r.url === URL_DA_LISTA);
  expect(req.request.params.get('limit')).toBe('50');
  req.flush(itens);
  cena.controller.match((r) => r.url === URL_DAS_UNIDADES).forEach((r) => r.flush(unidades));
  await propagar(cena);
}

export function nomesDeBotoes(cena: CenaDaPagina): string[] {
  return Array.from(cena.fixture.nativeElement.querySelectorAll('button')).map((b) =>
    ((b as HTMLButtonElement).textContent ?? '').trim().replace(/\s+/gu, ' '),
  );
}

export function opcoesDaUnidade(cena: CenaDaPagina): string[] {
  const opcoes: HTMLOptionElement[] = Array.from(
    (cena.fixture.nativeElement as HTMLElement).querySelectorAll(
      'select[formControlName="unidadeSugeridaId"] option',
    ),
  );
  return opcoes.map((opcao) => opcao.textContent?.replace(/\s+/g, ' ').trim() ?? '');
}
