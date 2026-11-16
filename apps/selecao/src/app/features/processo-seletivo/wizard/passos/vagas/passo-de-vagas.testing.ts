import {
  HttpInterceptorFn,
  HttpRequest,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDosCamposPressupostos } from '../../shared/campos-pressupostos.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { CatalogoDeFatos } from '../cronograma/catalogos/catalogo-de-fatos.service';
import { VagasPassoComponent } from './vagas.component';
import { quantidadeSimulada, simulada } from './simulacao.testing';
import { BASE, LISTA_DE_CURSOS, MODALIDADE, ServicosDasVagas, servicosDe } from './vagas.testing';

/** As respostas dos catálogos que o passo lê ao abrir. */
export interface DadosDosCatalogos {
  readonly ofertas: readonly unknown[];
  readonly modalidades: readonly unknown[];
  readonly regras?: (tipo: string | null) => readonly unknown[];
}

export interface PassoDeVagas {
  readonly fixture: ComponentFixture<VagasPassoComponent>;
  readonly servicos: ServicosDasVagas;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
}

function servicosDoPasso(): Provider[] {
  return [
    ProcessoSeletivoStore,
    CadastroInicial,
    GravacaoDoProcesso,
    CatalogoDeFatos,
    GravacaoDosCamposPressupostos,
  ];
}

function rotasDaApi(): Provider[] {
  return [
    { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
    { provide: SELECAO_BASE_PATH, useValue: BASE },
    { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
  ];
}

function redeDeTeste(
  interceptadores: readonly HttpInterceptorFn[],
): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withInterceptors([apiResultInterceptor, ...interceptadores])),
    provideHttpClientTesting(),
  ];
}

/** O passo de vagas criado, ainda sem renderizar nem responder catálogo algum. */
export async function criarPassoDeVagas(
  interceptadores: readonly HttpInterceptorFn[] = [],
): Promise<PassoDeVagas> {
  await TestBed.configureTestingModule({
    imports: [VagasPassoComponent],
    providers: [...servicosDoPasso(), ...rotasDaApi(), ...redeDeTeste(interceptadores)],
  }).compileComponents();

  return passoDe(TestBed.createComponent(VagasPassoComponent));
}

function passoDe(fixture: ComponentFixture<VagasPassoComponent>): PassoDeVagas {
  return {
    fixture,
    servicos: servicosDe(fixture),
    store: TestBed.inject(ProcessoSeletivoStore),
    controller: TestBed.inject(HttpTestingController),
  };
}

/** Renderiza o passo, responde os catálogos que ele pediu e renderiza de novo. */
export function abrirPasso(passo: PassoDeVagas, dados: DadosDosCatalogos): void {
  passo.fixture.detectChanges();
  for (const requisicao of passo.controller.match(() => true)) {
    requisicao.flush(respostaDo(requisicao.request, dados));
  }
  passo.fixture.detectChanges();
}

function respostaDo(
  requisicao: HttpRequest<unknown>,
  dados: DadosDosCatalogos,
): readonly unknown[] {
  const url = requisicao.url;
  if (url.includes('ofertas-curso')) return dados.ofertas;
  if (url.includes('cursos')) return LISTA_DE_CURSOS;
  if (url.includes('modalidades')) return dados.modalidades;
  if (url.includes('regras-catalogo')) return dados.regras?.(requisicao.params.get('tipo')) ?? [];
  return [];
}

/** A oferta simulada com o total de 42 vagas e uma só modalidade, AC_I, com 2. */
export function simuladaComUmaModalidade(ofertaCursoId: string): ReturnType<typeof simulada> {
  return simulada(ofertaCursoId, {
    quadro: [quantidadeSimulada(MODALIDADE, 'AC_I', 2)],
    totalDeVagasDoEdital: 42,
  });
}
