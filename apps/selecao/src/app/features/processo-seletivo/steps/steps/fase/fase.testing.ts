import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { DebugElement } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import type { AtributosCongeladosDaFase, FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { CatalogosDoCronograma } from '../cronograma/catalogos-do-cronograma.service';
import { FasePassoComponent } from './fase.component';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
export const ROTA_FASES = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/cronograma-fases`;

/** O interceptor só lê o corpo como ProblemDetails sob este media type. */
export const PROBLEM_JSON = { 'content-type': 'application/problem+json' };

export const ID_AVALIACAO = '01960000-0000-7000-0000-0000000000c2';
export const ID_RECURSOS = '01960000-0000-7000-0000-0000000000c3';
export const ID_BANCA_HETERO = '01960000-0000-7000-0000-0000000000b1';
export const ID_CATEGORIA_RACA = '01960000-0000-7000-0000-0000000000d1';
export const ID_CATEGORIA_RENDA = '01960000-0000-7000-0000-0000000000d2';

export const FASES_CANONICAS = [
  {
    id: ID_AVALIACAO,
    codigo: 'AVALIACAO',
    nome: 'Avaliação',
    unidadeSugerida: null,
    agrupaEtapas: false,
    permiteComplementacao: false,
    coletaInscricao: false,
    origemData: 'NO_EDITAL',
  },
  {
    id: ID_RECURSOS,
    codigo: 'RECURSOS',
    nome: 'Recursos',
    unidadeSugerida: null,
    agrupaEtapas: false,
    permiteComplementacao: false,
    coletaInscricao: false,
    origemData: 'NO_EDITAL',
  },
];

/** Vigência aberta, para que o seletor de publicação ofereça os três. */
export function ato(codigo: string, nome: string, ehResultado: boolean) {
  return {
    id: `ato-${codigo}`,
    codigo,
    nome,
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado,
    vigenciaInicio: '2020-01-01',
    vigenciaFim: null,
    baseLegal: null,
    criadoEm: '2026-08-30T12:00:00Z',
  };
}

export const ATOS = [
  ato('GABARITO_PRELIMINAR', 'Gabarito preliminar', true),
  ato('RESULTADO_PRELIMINAR', 'Resultado preliminar', true),
  ato('RESULTADO_FINAL', 'Resultado final', true),
  ato('COMUNICADO', 'Comunicado', false),
];

export const BANCAS = [
  {
    id: ID_BANCA_HETERO,
    codigo: 'HETEROIDENTIFICACAO',
    nome: 'Heteroidentificação',
    faseTipica: null,
    descricao: null,
    criadoEm: '2026-08-30T12:00:00Z',
  },
];

/** O cadastro de onde a tela tira os documentos — antes era uma lista escrita nela. */
export const ID_CPF = '01960000-0000-7000-0000-0000000000f1';
export const ID_ETAPA_DOCUMENTAL = '01960000-0000-7000-0000-0000000000c1';
export const ID_TIPO_ETAPA = '01960000-0000-7000-0000-0000000000c2';
export const TIPOS_DOCUMENTO = [
  {
    id: ID_CPF,
    codigo: 'CPF',
    nome: 'CPF',
    descricao: null,
    categoria: 'IDENTIFICACAO',
    formatosAceitos: 'pdf,jpg',
    tamanhoMaximoMb: 10,
    tipoEquivalente: null,
    classificacaoProtecao: 'PESSOAL',
    finalidadeTratamento: 'Conferir a identidade do candidato.',
    hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    protecaoAprovada: true,
    criadoEm: '2026-08-30T12:00:00Z',
  },
];

export const CATEGORIAS = [
  {
    id: ID_CATEGORIA_RACA,
    codigo: 'RACA_ETNIA',
    nome: 'Raça e etnia',
    descricao: null,
    ordem: 1,
    criadoEm: '2026-08-30T12:00:00Z',
  },
  {
    id: ID_CATEGORIA_RENDA,
    codigo: 'RENDA',
    nome: 'Renda',
    descricao: null,
    ordem: 2,
    criadoEm: '2026-08-30T12:00:00Z',
  },
];

export const REGRAS = [
  {
    codigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
    versao: 'v1',
    tipo: 'regra_prazo_recurso',
    esquemaArgs: {},
    invariantes: {},
    baseLegal: 'Lei 9.784/1999',
    hash: 'abc',
    modalidadesAdmitidas: null,
  },
];

/**
 * O que a fase congelou na gravação — tem precedência sobre o catálogo vivo, porque editar a
 * fase canônica depois não pode mudar o que um edital já congelou.
 */
export function congeladosDaFase(
  parcial: Partial<AtributosCongeladosDaFase> = {},
): AtributosCongeladosDaFase {
  return {
    origemData: 'NO_EDITAL',
    agrupaEtapas: false,
    coletaInscricao: false,
    permiteComplementacao: false,
    coletaSolicitacaoIsencao: false,
    bancas: [],
    ...parcial,
  };
}

/** Uma fase do rascunho, com o que este passo não edita já preenchido. */
export function fase(parcial: Partial<FaseDoCronograma>): FaseDoCronograma {
  return {
    faseCanonicaId: ID_AVALIACAO,
    codigo: 'AVALIACAO',
    ordem: 1,
    inicio: '2026-03-01T08:00:00-03:00',
    fim: '2026-03-10T18:00:00-03:00',
    unidadeResponsavelId: null,
    produtos: [],
    faseConcluinteCodigo: null,
    emiteParecerIndividual: false,
    bancasRequeridas: [],
    regraRecurso: null,
    congelados: null,
    ...parcial,
  };
}

/** Deixa a cadeia de `await` do comando avançar antes da próxima expectativa. */
export const proximoPasso = () => new Promise((resolve) => setTimeout(resolve, 0));

/** As fases como o corpo do comando as declara. */
export const fasesEnviadas = (corpo: unknown) => corpo as Record<string, unknown>[];

export interface FaseMontada {
  readonly componente: FasePassoComponent;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
  readonly detectar: () => void;
  readonly nativo: HTMLElement;
  readonly raiz: DebugElement;
  readonly atenderCatalogos: () => void;
  readonly comCronograma: (...fases: readonly FaseDoCronograma[]) => void;
  readonly selecionado: (id: string) => string;
}

/** O passo da fase montado com os catálogos já atendidos, como ele abre para o operador. */
export async function montarFase(
  catalogos: 'atendidos' | 'pendentes' | 'com-erro' = 'atendidos',
): Promise<FaseMontada> {
  await TestBed.configureTestingModule({
    imports: [FasePassoComponent],
    providers: [
      ProcessoSeletivoStore,
      CadastroInicial,
      GravacaoDoProcesso,
      CatalogosDoCronograma,
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      { provide: SELECAO_BASE_PATH, useValue: BASE },
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(FasePassoComponent);
  const store = TestBed.inject(ProcessoSeletivoStore);
  const controller = TestBed.inject(HttpTestingController);
  const nativo = fixture.nativeElement as HTMLElement;
  const detectar = () => fixture.detectChanges();

  /** Responde ao que os catálogos pedem quando um passo abre. */
  const atenderCatalogos = (): void => {
    for (const requisicao of controller.match(() => true)) {
      const { url } = requisicao.request;
      if (url.includes('fases-canonicas')) requisicao.flush(FASES_CANONICAS);
      else if (url.includes('tipos-banca')) requisicao.flush(BANCAS);
      else if (url.includes('categorias-documento')) requisicao.flush(CATEGORIAS);
      else if (url.includes('tipos-documento')) requisicao.flush(TIPOS_DOCUMENTO);
      else if (url.includes('tipos-ato')) requisicao.flush(ATOS);
      else if (url.includes('regras')) requisicao.flush(REGRAS);
      else requisicao.flush([]);
    }
  };

  const comCronograma = (...fases: readonly FaseDoCronograma[]): void => {
    store.patchObjectSection('cronograma', { fases: [...fases] });
    detectar();
  };

  /** O seletor, como o operador o vê — não como o modelo o guarda. */
  const selecionado = (id: string): string => {
    const campo = nativo.querySelector<HTMLSelectElement>(`#${id}`);
    if (campo === null) throw new Error(`Seletor ${id} não está na tela.`);
    return campo.value;
  };

  detectar();
  if (catalogos === 'atendidos') atenderCatalogos();
  if (catalogos === 'com-erro') {
    for (const requisicao of controller.match(() => true)) {
      requisicao.flush('indisponível', { status: 500, statusText: 'Server Error' });
    }
  }
  detectar();

  return {
    componente: fixture.componentInstance,
    store,
    controller,
    detectar,
    nativo,
    raiz: fixture.debugElement,
    atenderCatalogos,
    comCronograma,
    selecionado,
  };
}
