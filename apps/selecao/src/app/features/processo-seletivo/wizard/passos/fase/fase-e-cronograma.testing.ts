import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { CaraterEtapa, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { GravacaoDosCamposPressupostos } from '../../shared/campos-pressupostos.service';
import { CATALOGOS_DO_CRONOGRAMA } from '../cronograma/catalogos/catalogos-do-cronograma';
import { CronogramaPassoComponent } from '../cronograma/cronograma.component';
import { FormularioDoCronograma } from '../cronograma/servicos/formulario-do-cronograma.service';
import { FasePassoComponent } from './fase.component';
import { BancasDaFaseComponent } from './secoes/bancas-da-fase.component';
import { PublicacoesDaFaseComponent } from './secoes/publicacoes-da-fase.component';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
export const ROTA_FASES = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/cronograma-fases`;
export const ROTA_ETAPAS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/etapas`;
export const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
export const ROTA_DOCUMENTOS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-exigidos`;

/** O interceptor só lê o corpo como ProblemDetails sob este media type. */
export const PROBLEM_JSON = { 'content-type': 'application/problem+json' };

/** A recusa do servidor quando a nova ordem fecha ciclo entre fases existentes. */
export const CICLO_DE_ORDEM = {
  type: 'about:blank',
  title: 'A redefinição do cronograma troca a Ordem entre fases já existentes',
  status: 422,
  code: 'uniplus.selecao.fase_cronograma.permutacao_de_ordem_nao_suportada',
  traceId: '00000000000000000000000000000002',
};

export const ID_AVALIACAO = '01960000-0000-7000-0000-0000000000c2';
export const ID_RESULTADO = '01960000-0000-7000-0000-0000000000c3';
export const ID_TIPO_ETAPA = '01960000-0000-7000-0000-0000000000e1';
export const ID_ETAPA_GRAVADA = '01960000-0000-7000-0000-0000000000ee';
export const ID_BANCA_HETERO = '01960000-0000-7000-0000-0000000000b1';
export const ID_CATEGORIA_RACA = '01960000-0000-7000-0000-0000000000d1';

export const FASES_CANONICAS = [
  {
    id: ID_AVALIACAO,
    codigo: 'AVALIACAO',
    nome: 'Avaliação',
    unidadeSugerida: null,
    agrupaEtapas: true,
    permiteComplementacao: false,
    coletaInscricao: false,
    origemData: 'NO_EDITAL',
  },
  {
    id: ID_RESULTADO,
    codigo: 'RESULTADO_FINAL',
    nome: 'Resultado final',
    unidadeSugerida: null,
    agrupaEtapas: false,
    permiteComplementacao: false,
    coletaInscricao: false,
    origemData: 'NO_EDITAL',
  },
];

export const TIPOS_ETAPA = [
  {
    id: ID_TIPO_ETAPA,
    codigo: 'PROVA_OBJETIVA',
    nome: 'Prova objetiva',
    ativo: true,
    admitePontuacao: true,
    admiteEliminacao: true,
  },
];

export const ATOS = [
  {
    id: 'ato-resultado-final',
    codigo: 'RESULTADO_FINAL',
    nome: 'Resultado final',
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado: true,
    vigenciaInicio: '2020-01-01',
    vigenciaFim: null,
    baseLegal: null,
    criadoEm: '2026-08-30T12:00:00Z',
  },
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

export const CATEGORIAS = [
  {
    id: ID_CATEGORIA_RACA,
    codigo: 'RACA_ETNIA',
    nome: 'Raça e etnia',
    descricao: null,
    ordem: 1,
    criadoEm: '2026-08-30T12:00:00Z',
  },
];

/** O detalhe que a releitura de etapas devolve depois da gravação. */
export const PROCESSO_COM_ETAPA_GRAVADA = {
  id: PROCESSO_ID,
  nome: 'Vestibular 2026.1',
  tipoProcesso: {
    origemId: '01960000-0000-7000-0000-0000000000t1',
    codigo: 'VESTIBULAR',
    nome: 'Vestibular',
  },
  status: 'rascunho',
  origemCandidatos: 'inscricaoPropria',
  unidadeAdministradora: {
    origemId: '01960000-0000-7000-0000-0000000000u1',
    sigla: 'IGE',
    slug: 'ige',
    nome: 'Instituto de Geociências e Engenharias',
  },
  localidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  etapas: [
    {
      id: ID_ETAPA_GRAVADA,
      nome: 'Prova objetiva',
      carater: 'classificatoria',
      tipoEtapa: { origemId: ID_TIPO_ETAPA, codigo: 'PROVA_OBJETIVA', nome: 'Prova objetiva' },
      peso: 1,
      notaMinima: null,
      ordem: 1,
    },
  ],
  ofertaAtendimento: null,
  distribuicaoVagas: [],
  bonusRegional: null,
  cascata: null,
  criteriosDesempate: [],
  classificacao: null,
  cronogramaFases: [],
  documentosExigidos: [],
  raizesExigencia: [],
  referenciaTemporalFatos: null,
  configuracaoTaxaInscricao: { cobra: false, valor: null, fundamentos: [] },
};

const FASE_DO_CERTAME = {
  unidadeResponsavelId: null,
  produtos: [],
  faseConcluinteCodigo: null,
  emiteParecerIndividual: false,
  bancasRequeridas: [],
  regraRecurso: null,
  congelados: null,
};

const faseDoCertame = (
  faseCanonicaId: string,
  codigo: string,
  ordem: number,
  [inicio, fim]: readonly [string, string],
) => ({
  ...FASE_DO_CERTAME,
  faseCanonicaId,
  codigo,
  ordem,
  inicio: `${inicio}T08:00:00-03:00`,
  fim: `${fim}T18:00:00-03:00`,
});

const ETAPA_GRAVADA = {
  id: ID_ETAPA_GRAVADA,
  nome: 'Prova objetiva',
  carater: CaraterEtapa.classificatoria,
  tipoEtapaOrigemId: ID_TIPO_ETAPA,
  peso: '1',
  notaMinima: '',
  ordem: 1,
  faseCodigo: '',
  produtos: [],
  inicio: '',
  fim: '',
  emiteParecerIndividual: false,
  bancas: [],
  recursos: [],
};

const PROVEDORES = [
  ProcessoSeletivoStore,
  CadastroInicial,
  GravacaoDoProcesso,
  GravacaoDosCamposPressupostos,
  ...CATALOGOS_DO_CRONOGRAMA,
  provideHttpClient(withInterceptors([apiResultInterceptor])),
  provideHttpClientTesting(),
  { provide: SELECAO_BASE_PATH, useValue: BASE },
  { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
  { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
  { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
];

/** Responde ao que os catálogos pedem quando os dois passos abrem. */
function atenderCatalogos(controller: HttpTestingController): void {
  for (const requisicao of controller.match(() => true)) {
    const { url } = requisicao.request;
    if (url.includes('fatos-candidato')) requisicao.flush([]);
    else if (url.includes('fases-canonicas')) requisicao.flush(FASES_CANONICAS);
    else if (url.includes('tipos-etapa')) requisicao.flush(TIPOS_ETAPA);
    else if (url.includes('tipos-banca')) requisicao.flush(BANCAS);
    else if (url.includes('categorias-documento')) requisicao.flush(CATEGORIAS);
    else if (url.includes('tipos-ato')) requisicao.flush(ATOS);
    else requisicao.flush([]);
  }
}

/**
 * Os dois passos montados sobre o mesmo rascunho, e o que os cenários consultam e conduzem neles.
 * Um provider de cada serviço no injetor do TestBed: as duas telas compartilham o rascunho, os
 * catálogos e a chave de gravação, como compartilham na página que as hospeda.
 */
export class ContextoDoCertame {
  readonly store = TestBed.inject(ProcessoSeletivoStore);
  readonly controller = TestBed.inject(HttpTestingController);
  private readonly fixtureCronograma = TestBed.createComponent(CronogramaPassoComponent);
  private readonly fixtureSuperficie = TestBed.createComponent(FasePassoComponent);
  readonly cronograma = this.fixtureCronograma.componentInstance;
  readonly formularioDoCronograma =
    this.fixtureCronograma.debugElement.injector.get(FormularioDoCronograma);
  readonly superficie = this.fixtureSuperficie.componentInstance;

  readonly bancas = () =>
    this.fixtureSuperficie.debugElement.query(By.directive(BancasDaFaseComponent))
      .componentInstance as BancasDaFaseComponent;
  readonly publicacoes = () =>
    this.fixtureSuperficie.debugElement.query(By.directive(PublicacoesDaFaseComponent))
      .componentInstance as PublicacoesDaFaseComponent;
  readonly detectar = (): void => {
    this.fixtureCronograma.detectChanges();
    this.fixtureSuperficie.detectChanges();
  };

  /** Deixa a cadeia de `await` do comando avançar antes da próxima expectativa. */
  readonly proximoPasso = () => new Promise((resolve) => setTimeout(resolve, 0));

  /** As ordens que o corpo do comando de cronograma declara. */
  readonly ordensDe = (corpo: unknown): number[] =>
    (corpo as { ordem: number }[]).map((fase) => fase.ordem);

  /** As fases do corpo, na ordem em que ele as declara. */
  readonly fasesDe = (corpo: unknown): string[] =>
    (corpo as { faseCanonicaId: string }[]).map((fase) => fase.faseCanonicaId);

  readonly comCertame = (): void => {
    this.store.patchObjectSection('cronograma', {
      fases: [
        faseDoCertame(ID_AVALIACAO, 'AVALIACAO', 1, ['2026-03-01', '2026-03-10']),
        faseDoCertame(ID_RESULTADO, 'RESULTADO_FINAL', 2, ['2026-04-01', '2026-04-05']),
      ],
      etapas: [ETAPA_GRAVADA],
    });
    this.detectar();
  };
}

export async function montarFaseECronograma(): Promise<ContextoDoCertame> {
  await TestBed.configureTestingModule({
    imports: [CronogramaPassoComponent, FasePassoComponent],
    providers: PROVEDORES,
  }).compileComponents();
  const contexto = new ContextoDoCertame();
  contexto.detectar();
  atenderCatalogos(contexto.controller);
  contexto.detectar();
  return contexto;
}

/**
 * Registra, no `describe` que a chama, a montagem dos dois passos antes de cada caso e a conferência
 * de que nenhuma requisição ficou sem resposta depois dele.
 */
export function usarFaseECronograma(aoMontar: (contexto: ContextoDoCertame) => void): void {
  let atual: ContextoDoCertame;
  beforeEach(async () => {
    atual = await montarFaseECronograma();
    aoMontar(atual);
  });
  afterEach(() => atual.controller.verify());
}
