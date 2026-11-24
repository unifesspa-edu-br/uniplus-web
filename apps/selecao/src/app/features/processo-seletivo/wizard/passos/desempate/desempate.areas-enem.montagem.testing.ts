import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import {
  SELECAO_BASE_PATH,
  StatusProcessoCodigo,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';
import { LeituraDoCadastroDePesos } from '../classificacao/leitura-do-cadastro-de-pesos.service';
import { AreasDoDesempate } from './areas-do-desempate.service';
import { DesempatePassoComponent } from './desempate.component';
import {
  AREAS_CANONICAS,
  area,
  BASE,
  CLASSIFICACAO_COM_QUADRO,
  PESOS,
  REGRA_POR_AREA,
  RESOLUCAO,
  ROTA_AREAS,
  ROTA_PESOS,
  SAUDE,
  TECNOLOGICA,
} from './desempate.areas-enem.dados.testing';
import { EdicaoDosCriterios } from './edicao-dos-criterios.service';

const PROVEDORES = [
  ProcessoSeletivoStore,
  CadastroInicial,
  GravacaoDoProcesso,
  CatalogosDeClassificacao,
  LeituraDoCadastroDePesos,
  ReleituraDoSnapshot,
  provideHttpClient(withInterceptors([apiResultInterceptor])),
  provideHttpClientTesting(),
  { provide: SELECAO_BASE_PATH, useValue: BASE },
  { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
];

export interface Montagem {
  readonly fixture: ComponentFixture<DesempatePassoComponent>;
  readonly componente: DesempatePassoComponent;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
  readonly el: HTMLElement;
}

interface OpcoesDeMontagem {
  /** O rascunho da classificação; `null` deixa o rascunho inicial, sem ENEM. */
  readonly classificacao?: Partial<typeof CLASSIFICACAO_COM_QUADRO> | null;
  readonly antesDeMontar?: (store: ProcessoSeletivoStore) => void;
  /** Deixa sem resposta a leitura do cadastro de Peso por Área. */
  readonly semResponderPesos?: boolean;
  /** Olha as requisições que a montagem fez, antes de respondê-las. */
  readonly antesDeResponder?: (controller: HttpTestingController) => void;
}

let controllerAtual: HttpTestingController | null = null;

/** Solta o módulo mesmo quando a conferência falha, para a falha de um teste não vazar para os seguintes. */
export function conferirERestaurar(): void {
  const controller = controllerAtual;
  controllerAtual = null;
  try {
    controller?.verify();
  } finally {
    TestBed.resetTestingModule();
  }
}

function prepararStore(opcoes: OpcoesDeMontagem): ProcessoSeletivoStore {
  const store = TestBed.inject(ProcessoSeletivoStore);
  const classificacao =
    opcoes.classificacao === undefined ? CLASSIFICACAO_COM_QUADRO : opcoes.classificacao;
  if (classificacao !== null) store.patchObjectSection('classificacao', classificacao);
  opcoes.antesDeMontar?.(store);
  return store;
}

function iniciar(
  fixture: ComponentFixture<DesempatePassoComponent>,
  controller: HttpTestingController,
  opcoes: OpcoesDeMontagem,
): void {
  fixture.detectChanges();
  opcoes.antesDeResponder?.(controller);
  responderPendentes(controller, { semResponderPesos: opcoes.semResponderPesos });
  fixture.detectChanges();
}

async function configurarModulo(): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [DesempatePassoComponent],
    providers: PROVEDORES,
  }).compileComponents();
}

function montagemDe(
  fixture: ComponentFixture<DesempatePassoComponent>,
  store: ProcessoSeletivoStore,
  controller: HttpTestingController,
): Montagem {
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, componente: fixture.componentInstance, store, controller, el };
}

export async function montar(opcoes: OpcoesDeMontagem = {}): Promise<Montagem> {
  await configurarModulo();
  const store = prepararStore(opcoes);
  const fixture = TestBed.createComponent(DesempatePassoComponent);
  const controller = TestBed.inject(HttpTestingController);
  controllerAtual = controller;
  iniciar(fixture, controller, opcoes);
  return montagemDe(fixture, store, controller);
}

export function responderPendentes(
  controller: HttpTestingController,
  opcoes: { readonly semResponderPesos?: boolean } = {},
): void {
  for (const requisicao of controller.match((r) => !r.url.endsWith(ROTA_PESOS))) {
    requisicao.flush(requisicao.request.url.endsWith(ROTA_AREAS) ? [...AREAS_CANONICAS] : []);
  }
  if (opcoes.semResponderPesos) return;
  for (const requisicao of controller.match((r) => r.url.endsWith(ROTA_PESOS))) {
    requisicao.flush([...PESOS]);
  }
}

/** O processo tem a classificação gravada com `resolucao` e este quadro congelado. */
export function classificacaoGravada(
  resolucao: string | null,
  quadro: unknown[],
  status: StatusProcessoCodigo = StatusProcessoCodigo.rascunho,
) {
  return (store: ProcessoSeletivoStore) => {
    const classificacao = { resolucaoPesoAreaEnem: resolucao, quadroPesoAreaEnem: quadro };
    const situacao = { codigo: status, rotulo: status };
    store.remoteSnapshot.set({ status: situacao, classificacao } as unknown as ProcessoSeletivoDto);
    store.classificacao.registrarLida(
      classificacao as unknown as ProcessoSeletivoDto['classificacao'],
    );
  };
}

/** A cópia congelada igual ao quadro que o cadastro tem para a resolução. */
const COPIA_DO_CADASTRO = [TECNOLOGICA, SAUDE].map((grupo) => ({
  grupoAreaEnem: grupo,
  baseLegal: 'Anexo I',
  areas: [area('MATEMATICA', 'Matemática'), area('REDACAO', 'Redação')],
}));

/** O processo já tem a classificação gravada com o quadro: o Desempate grava direto. */
export function comQuadroGravado(m: Montagem): void {
  classificacaoGravada(RESOLUCAO, COPIA_DO_CADASTRO)(m.store);
  m.fixture.detectChanges();
  responderPendentes(m.controller);
  m.fixture.detectChanges();
}

export function criterioPorArea(m: Montagem): void {
  edicaoDosCriterios(m).acrescentar();
  edicaoDosCriterios(m).escolherRegra(m.componente.criterios().length - 1, REGRA_POR_AREA);
  m.fixture.detectChanges();
}

export function seletor(m: Montagem, indice: number): HTMLSelectElement | null {
  return m.el.querySelector<HTMLSelectElement>(`#desemp-area-nova-${indice}`);
}

export function opcoesDoSeletor(m: Montagem, indice: number): readonly string[] {
  return Array.from(seletor(m, indice)?.options ?? [])
    .slice(1)
    .map((opcao) => opcao.textContent?.trim() ?? '');
}

export function botao(m: Montagem, id: string): HTMLButtonElement {
  const elemento = m.el.querySelector<HTMLButtonElement>(`#${id}`);
  if (elemento === null) throw new Error(`botão ${id} ausente`);
  return elemento;
}

/** Escolhe a área no seletor e confirma pelo botão "Acrescentar". */
export function acrescentarPelaTela(m: Montagem, indice: number, codigo: string): void {
  const elemento = seletor(m, indice);
  if (elemento === null) throw new Error('seletor de área ausente');
  elemento.value = codigo;
  elemento.dispatchEvent(new Event('change'));
  botao(m, `desemp-area-acrescentar-${indice}`).click();
  m.fixture.detectChanges();
}

export function areasNaTela(m: Montagem, indice: number): readonly string[] {
  return Array.from(
    m.el.querySelectorAll(`[aria-labelledby="desemp-areas-rotulo-${indice}"] li`),
  ).map((item) => item.querySelector('.desempate-area__nome')?.textContent?.trim() ?? '');
}

/** As áreas que a consulta lê no critério, na lista numerada da ordem gravada. */
export function areasEmConsulta(m: Montagem, indice: number): readonly string[] {
  const leitura = Array.from(m.el.querySelectorAll('.valor-em-consulta')).filter(
    (valor) => valor.querySelector('dt')?.textContent?.trim() === 'Ordem das áreas do ENEM',
  )[indice];
  return Array.from(
    leitura?.querySelectorAll('ol > li') ?? [],
    (item) => item.textContent?.trim() ?? '',
  );
}

export function textoDaTela(m: Montagem): string {
  return m.el.textContent?.replace(/\s+/g, ' ') ?? '';
}

export function edicaoDosCriterios(m: Montagem): EdicaoDosCriterios {
  return m.fixture.debugElement.injector.get(EdicaoDosCriterios);
}

export function areasDoDesempate(m: Montagem): AreasDoDesempate {
  return m.fixture.debugElement.injector.get(AreasDoDesempate);
}
