import {
  ClassificacaoDeProtecaoCodigo,
  HipoteseLegalTratamentoCodigo,
} from '@uniplus/shared-data/configuracao';
import { codigoComRotulo } from '@uniplus/shared-testing/contrato';
import { fornecerVocabulariosDaRegra } from '../../shared/deliberacao/vocabularios-da-regra.testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import type { AtributosCongeladosDaFase, FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { opcoesDoRecursoDaUrl } from '../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { umaFaseDoCronograma } from '../../shared/fase-do-cronograma.testing';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { SEM_PERMISSAO_PARA_OS_MOTIVOS } from './motivos/motivos-nos-passos.testing';
import { FasesNoServidor } from '../cronograma/servicos/fases-no-servidor.service';
import { SEM_RECUSAS_DA_PUBLICACAO } from '../cronograma/servicos/recusas-da-publicacao-no-cronograma.testing';
import { RecusasDoServidorNasFases } from '../cronograma/servicos/recusas-do-servidor-nas-fases.service';
import { CATALOGOS_DO_CRONOGRAMA } from '../cronograma/catalogos/catalogos-do-cronograma';
import { FormularioDoCronograma } from '../cronograma/servicos/formulario-do-cronograma.service';
import { ReleituraDosIdentificadores } from '../cronograma/servicos/releitura-dos-identificadores.service';
import { UnidadesResponsaveisDasFases } from '../cronograma/servicos/unidades-responsaveis-das-fases.service';
import { FasePassoComponent } from './fase.component';
import { provideTiposDeDecisaoDaApi } from '../../shared/decisoes-da-fase-ou-etapa/tipos-de-decisao-da-api.testing';
import { proverVocabulariosDaDeliberacao } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { CatalogoDasConsequenciasDeIndeferimento } from '../cronograma/catalogos/catalogo-das-consequencias-de-indeferimento.service';

export const BASE = 'http://localhost:5000';
export const CONSEQUENCIA_ELIMINA = {
  codigo: 'ELIMINA',
  rotulo: 'Elimina do processo',
};
export const CONSEQUENCIA_REENVIO = {
  codigo: 'ABRE_PRAZO_PARA_REENVIO',
  rotulo: 'Abre prazo para reenvio',
};
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
export const ROTA_FASES = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/cronograma-fases`;

/** O interceptor só lê o corpo como ProblemDetails sob este media type. */
export const PROBLEM_JSON = { 'content-type': 'application/problem+json' };

export const ID_AVALIACAO = '01960000-0000-7000-0000-0000000000c2';
export const ID_HOMOLOGACAO = '01960000-0000-7000-0000-0000000000c3';
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
    id: ID_HOMOLOGACAO,
    codigo: 'HOMOLOGACAO_INSCRICOES',
    nome: 'Homologação das inscrições',
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
    codigo: { codigo: 'HETEROIDENTIFICACAO', rotulo: 'Heteroidentificação' },
    nome: 'Heteroidentificação',
    faseTipica: null,
    descricao: null,
    criadoEm: '2026-08-30T12:00:00Z',
  },
];

/** O cadastro de onde a tela tira os documentos. */
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
    classificacaoProtecao: codigoComRotulo(ClassificacaoDeProtecaoCodigo.PESSOAL, 'Pessoal'),
    finalidadeTratamento: 'Conferir a identidade do candidato.',
    hipoteseLegal: codigoComRotulo(
      HipoteseLegalTratamentoCodigo.EXECUCAO_POLITICAS_PUBLICAS,
      'Execução de políticas públicas',
    ),
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
    tipo: 'REGRA_PRAZO_RECURSO',
    declaracaoDaRegra: {},
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
    ...parcial,
  };
}

/** Uma fase do rascunho, com o que este passo não edita já preenchido. */
export function fase(parcial: Partial<FaseDoCronograma>): FaseDoCronograma {
  return umaFaseDoCronograma({
    faseCanonicaId: ID_AVALIACAO,
    inicio: '2026-03-01T08:00:00-03:00',
    fim: '2026-03-10T18:00:00-03:00',
    ...parcial,
  });
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
  readonly elementoDaTela: DebugElement;
  readonly atenderCatalogos: () => void;
  readonly comCronograma: (...fases: readonly FaseDoCronograma[]) => void;
  readonly selecionado: (id: string) => string;
  readonly abrirFase: (faseCanonicaId: string) => void;
}

const PROVEDORES_DA_FASE = [
  fornecerVocabulariosDaRegra(),
  ProcessoSeletivoStore,
  FormularioDoCronograma,
  ReleituraDosIdentificadores,
  UnidadesResponsaveisDasFases,
  RecusasDoServidorNasFases,
  FasesNoServidor,
  SEM_PERMISSAO_PARA_OS_MOTIVOS,
  SEM_RECUSAS_DA_PUBLICACAO,
  CadastroInicial,
  GravacaoDoProcesso,
  ...CATALOGOS_DO_CRONOGRAMA,
  provideHttpClient(withInterceptors([apiResultInterceptor])),
  provideHttpClientTesting(),
  { provide: SELECAO_BASE_PATH, useValue: BASE },
  { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
  provideTiposDeDecisaoDaApi(),
  proverVocabulariosDaDeliberacao(),
  CatalogoDasConsequenciasDeIndeferimento,
  { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
  { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
];

function opcoesParaUrl(url: string): readonly unknown[] | null {
  if (url.includes('consequencias-indeferimento'))
    return [CONSEQUENCIA_ELIMINA, CONSEQUENCIA_REENVIO];
  return opcoesDoRecursoDaUrl(url);
}

/** Responde ao que os catálogos pedem quando um passo abre. */
function atenderOsCatalogos(controller: HttpTestingController): void {
  for (const requisicao of controller.match(() => true)) {
    const { url } = requisicao.request;
    const opcoes = opcoesParaUrl(url);
    if (opcoes !== null) requisicao.flush(opcoes);
    else if (url.includes('fases-canonicas')) requisicao.flush(FASES_CANONICAS);
    else if (url.includes('tipos-banca')) requisicao.flush(BANCAS);
    else if (url.includes('categorias-documento')) requisicao.flush(CATEGORIAS);
    else if (url.includes('tipos-documento')) requisicao.flush(TIPOS_DOCUMENTO);
    else if (url.includes('tipos-ato')) requisicao.flush(ATOS);
    else if (url.includes('regras')) requisicao.flush(REGRAS);
    else requisicao.flush([]);
  }
}

function falharOsCatalogos(controller: HttpTestingController): void {
  for (const requisicao of controller.match(() => true)) {
    requisicao.flush('indisponível', { status: 500, statusText: 'Server Error' });
  }
}

/** O seletor, como o operador o vê — não como o modelo o guarda. */
function valorDoSeletor(nativo: HTMLElement, id: string): string {
  const campo = nativo.querySelector<HTMLSelectElement>(`#${id}`);
  if (campo === null) throw new Error(`Seletor ${id} não está na tela.`);
  return campo.value;
}

/** O que o Cronograma faz ao embutir o passo: fixa a fase e relê o rascunho. */
function fixarAFase(fixture: ComponentFixture<FasePassoComponent>, faseCanonicaId: string): void {
  fixture.componentRef.setInput('faseFixada', faseCanonicaId);
  fixture.detectChanges();
}

function comAsFases(
  fixture: ComponentFixture<FasePassoComponent>,
  store: ProcessoSeletivoStore,
  fases: readonly FaseDoCronograma[],
): void {
  store.patchObjectSection('cronograma', { fases: [...fases] });
  if (fases.length > 0) fixarAFase(fixture, fases[0].faseCanonicaId);
  else fixture.detectChanges();
}

function responderConsequenciasDeIndeferimento(controller: HttpTestingController): void {
  controller
    .match((requisicao) => requisicao.url.includes('consequencias-indeferimento'))
    .forEach((requisicao) => requisicao.flush([CONSEQUENCIA_ELIMINA, CONSEQUENCIA_REENVIO]));
}

function atenderOuFalhar(
  controller: HttpTestingController,
  catalogos: 'atendidos' | 'pendentes' | 'com-erro',
): void {
  TestBed.inject(CatalogoDasConsequenciasDeIndeferimento).carregar();
  if (catalogos === 'atendidos') atenderOsCatalogos(controller);
  if (catalogos === 'com-erro') falharOsCatalogos(controller);
}

type OperacoesDoPasso = Pick<
  FaseMontada,
  'atenderCatalogos' | 'comCronograma' | 'selecionado' | 'abrirFase'
>;

function operacoesDoPasso(
  fixture: ComponentFixture<FasePassoComponent>,
  controller: HttpTestingController,
): OperacoesDoPasso {
  const store = TestBed.inject(ProcessoSeletivoStore);
  return {
    atenderCatalogos: () => atenderOsCatalogos(controller),
    comCronograma: (...fases) => {
      comAsFases(fixture, store, fases);
      responderConsequenciasDeIndeferimento(controller);
    },
    selecionado: (id) => valorDoSeletor(fixture.nativeElement as HTMLElement, id),
    abrirFase: (faseCanonicaId) => fixarAFase(fixture, faseCanonicaId),
  };
}

function passoMontado(
  fixture: ComponentFixture<FasePassoComponent>,
  controller: HttpTestingController,
): FaseMontada {
  return {
    componente: fixture.componentInstance,
    store: TestBed.inject(ProcessoSeletivoStore),
    controller,
    detectar: () => fixture.detectChanges(),
    nativo: fixture.nativeElement as HTMLElement,
    elementoDaTela: fixture.debugElement,
    ...operacoesDoPasso(fixture, controller),
  };
}

/** O passo da fase montado com os catálogos já atendidos, como ele abre para o operador. */
export async function montarFase(
  catalogos: 'atendidos' | 'pendentes' | 'com-erro' = 'atendidos',
): Promise<FaseMontada> {
  await TestBed.configureTestingModule({
    imports: [FasePassoComponent],
    providers: PROVEDORES_DA_FASE,
  }).compileComponents();
  const fixture = TestBed.createComponent(FasePassoComponent);
  fixture.componentRef.setInput('faseFixada', ID_AVALIACAO);
  const controller = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  atenderOuFalhar(controller, catalogos);
  fixture.detectChanges();
  return passoMontado(fixture, controller);
}
