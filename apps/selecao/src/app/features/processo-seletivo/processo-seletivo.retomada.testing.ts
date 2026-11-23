import { fornecerVocabulariosDaRegra } from './wizard/shared/deliberacao/vocabularios-da-regra.testing';
import { Provider } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiOk } from '@uniplus/shared-core/http';
import {
  ModalidadeDto,
  BaseLegalBonusRegionalApi,
  CondicoesAtendimentoApi,
  TiposInstrumentoNormativoApi,
  PesosEnemApi,
  CursosApi,
  ModalidadesApi,
  OfertasCursoApi,
  RecursoAcessibilidadeApi,
  ReservaDemograficaApi,
  FatosCandidatoApi,
  ModelosFormularioApi,
  TermosConsentimentoApi,
  TipoDeficienciaApi,
  TipoProcessoDto,
  TiposProcessoApi,
  FasesCanonicasApi,
  PrecedenciasFaseApi,
  TiposBancaApi,
  TiposDocumentoApi,
  TiposEtapaApi,
  CategoriasDocumentoApi,
} from '@uniplus/shared-data/configuracao';
import { GeoApi } from '@uniplus/shared-data/geo';
import { AtosApi, TiposAtoApi } from '@uniplus/shared-data/publicacoes';
import { UnidadeDto, UnidadesApi } from '@uniplus/shared-data/organizacao';
import {
  DocumentoAPublicarDto,
  ClassificacaoDoProcessoApi,
  CronogramaDoProcessoApi,
  DocumentosEAtosDoProcessoApi,
  FinalidadeDoDocumento,
  FormulariosDoProcessoApi,
  FundamentoIsencaoDto,
  ItemConformidadeDto,
  OrigemCandidatos,
  MotivosDeDecisaoApi,
  OpcoesDoRecursoApi,
  RegrasCatalogoApi,
  ProcessoSeletivoDto,
  ProcessosSeletivosApi,
  PublicacaoDoProcessoApi,
  StatusProcesso,
  VagasDoProcessoApi,
  VocabulariosDaComprovacaoApi,
  VocabulariosDoPrazoEDaValidadeApi,
} from '@uniplus/shared-data/selecao';
import { errorResult, mockProblemDetails, okResult } from '@uniplus/shared-testing';
import { BehaviorSubject, NEVER, of } from 'rxjs';
import { vi } from 'vitest';

import { provideApiDosTiposDeDecisao } from './wizard/shared/decisoes-da-fase-ou-etapa/tipos-de-decisao-da-api.testing';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { opcoesDoRecursoApiStub } from './processo-seletivo.page.testing';
import { PASSOS } from './wizard/processo-seletivo.data';

export const PROCESSO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';
export const OUTRO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b099';
export const TIPO_ORIGEM_ID = '019f41cf-69fd-759a-ac6d-09acabc1b028';
export const UNIDADE_ORIGEM_ID = '019f41cf-69fd-759a-ac6d-09acabc1b029';

/**
 * A primeira montagem da página compila o assistente inteiro, com todos os passos: no runner do
 * CI isso passa dos 5 s padrão, embora o teste em si leve milissegundos.
 */
export const MONTAGEM_LENTA = { timeout: 30_000 };

export type ParamMapDaRota = BehaviorSubject<{ get: (k: string) => string | null }>;

const concedeSoPublicar = (codigo: string): boolean => codigo === 'selecao:processos:publicar';

const respostaVazia = <T>() => of(apiOk<readonly T[]>([], 200, new HttpHeaders()));

const falhaDeCatalogo = { listar: () => of(errorResult(mockProblemDetails({ status: 503 }))) };

/**
 * O passo de vagas consome os catálogos de oferta, reserva demográfica e
 * regras. Aqui eles vêm vazios: estas suítes cobrem a retomada do processo, e o
 * conteúdo dos catálogos é exercitado no teste do próprio passo.
 */
const catalogoVazioStub = { listar: () => respostaVazia<never>() };

const vocabulariosDoPrazoEDaValidadeStub = {
  listarEscolhasDoPrazoDeEmissao: catalogoVazioStub.listar,
  listarEscolhasDaValidade: catalogoVazioStub.listar,
  listarUnidadesDoPrazoDeEmissao: catalogoVazioStub.listar,
  listarTiposDaDataDeReferencia: catalogoVazioStub.listar,
  listarEfeitosNaAnaliseDoDocumento: catalogoVazioStub.listar,
};

const vocabulariosDaComprovacaoStub = {
  listarFormasDeComprovacao: catalogoVazioStub.listar,
  listarFormatosPermitidos: catalogoVazioStub.listar,
  listarCriteriosDeDistincaoDeApresentacoes: catalogoVazioStub.listar,
  listarConsequenciasDeIndeferimento: catalogoVazioStub.listar,
};

/** Os catálogos que cada passo do assistente carrega ao montar; vazios, o grafo de injeção fecha sem HTTP. */
const PROVEDORES_DE_CATALOGO_VAZIO: readonly Provider[] = [
  provideApiDosTiposDeDecisao(),
  { provide: ModalidadesApi, useValue: { listar: () => respostaVazia<ModalidadeDto>() } },
  { provide: CursosApi, useValue: catalogoVazioStub },
  { provide: OfertasCursoApi, useValue: catalogoVazioStub },
  { provide: ReservaDemograficaApi, useValue: catalogoVazioStub },
  { provide: RegrasCatalogoApi, useValue: catalogoVazioStub },
  // O passo de bônus carrega o catálogo de base legal ao montar, e o vocabulário que traduz o
  // tipo de instrumento da norma.
  { provide: BaseLegalBonusRegionalApi, useValue: catalogoVazioStub },
  { provide: TiposInstrumentoNormativoApi, useValue: catalogoVazioStub },
  // O passo da fórmula carrega o cadastro de Peso por Área, de onde sai a resolução do ENEM.
  {
    provide: PesosEnemApi,
    useValue: { ...catalogoVazioStub, listarAreas: catalogoVazioStub.listar },
  },
  // O passo do cronograma carrega os sete catálogos ao montar; estas suítes não
  // exercitam a linha do tempo.
  { provide: FasesCanonicasApi, useValue: catalogoVazioStub },
  { provide: PrecedenciasFaseApi, useValue: catalogoVazioStub },
  { provide: TiposBancaApi, useValue: catalogoVazioStub },
  { provide: CategoriasDocumentoApi, useValue: catalogoVazioStub },
  { provide: TiposEtapaApi, useValue: catalogoVazioStub },
  { provide: TiposDocumentoApi, useValue: catalogoVazioStub },
  { provide: VocabulariosDaComprovacaoApi, useValue: vocabulariosDaComprovacaoStub },
  { provide: VocabulariosDoPrazoEDaValidadeApi, useValue: vocabulariosDoPrazoEDaValidadeStub },
  { provide: TiposAtoApi, useValue: catalogoVazioStub },
  { provide: MotivosDeDecisaoApi, useValue: catalogoVazioStub },
  { provide: OpcoesDoRecursoApi, useValue: opcoesDoRecursoApiStub },
  { provide: AtosApi, useValue: { obter: () => NEVER } },
  // O passo de atendimento carrega os três cadastros de Configuração ao
  // montar; estas suítes cobrem a retomada do processo, não as escolhas.
  { provide: CondicoesAtendimentoApi, useValue: catalogoVazioStub },
  { provide: RecursoAcessibilidadeApi, useValue: catalogoVazioStub },
  { provide: TipoDeficienciaApi, useValue: catalogoVazioStub },
  // O passo do formulário carrega o catálogo de fatos do candidato ao montar.
  { provide: FatosCandidatoApi, useValue: catalogoVazioStub },
  // E os termos de consentimento que ele pode exigir.
  { provide: TermosConsentimentoApi, useValue: { listarComVersoes: () => NEVER } },
  // E os modelos de que cada formulário pode partir.
  { provide: ModelosFormularioApi, useValue: catalogoVazioStub },
];

/** Os clientes que a retomada não usa mas que o grafo de injeção da página exige. */
const PROVEDORES_SEM_LEITURA: readonly Provider[] = [
  { provide: FormulariosDoProcessoApi, useValue: {} },
  { provide: ClassificacaoDoProcessoApi, useValue: {} },
  { provide: VagasDoProcessoApi, useValue: {} },
  { provide: CronogramaDoProcessoApi, useValue: {} },
];

const UNIDADE_ADMINISTRADORA = {
  origemId: UNIDADE_ORIGEM_ID,
  sigla: 'IGE',
  slug: 'ige',
  nome: 'Instituto de Geociências e Engenharias',
};

const INSTANTES_DO_DOCUMENTO_CONFIRMADO = {
  criadoEm: '2026-08-20T12:00:00Z',
  expiraEm: '2026-08-20T12:15:00Z',
  confirmadoEm: '2026-08-20T12:05:00Z',
};

const TAXA_DE_INSCRICAO = {
  cobra: true,
  valor: 230,
  fundamentos: ['CADASTRO_UNICO', 'DOACAO_MEDULA_OSSEA'],
};

function identificacaoDoDetalhe() {
  return {
    id: PROCESSO_ID,
    nome: 'Vestibular 2026.1',
    tipoProcesso: { origemId: TIPO_ORIGEM_ID, codigo: 'VESTIBULAR', nome: 'Vestibular' },
    status: StatusProcesso.rascunho,
    // Os dois campos saem do enum gerado, não de literal escrito à mão: o
    // contrato os declara, e derivá-los dali é o que garante
    // que a fixture use o vocabulário que a API realmente emite.
    origemCandidatos: OrigemCandidatos.inscricaoPropria,
    unidadeAdministradora: UNIDADE_ADMINISTRADORA,
    localidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  };
}

function dimensoesVaziasDoDetalhe() {
  return {
    etapas: [],
    atendimentoEspecializado: null,
    distribuicaoVagas: [],
    bonusRegional: null,
    cascata: null,
    criteriosDesempate: [],
    classificacao: null,
    cronogramaFases: [],
    documentosExigidos: [],
    regrasDeComprovacao: [],
    referenciaTemporalFatos: null,
  };
}

/**
 * Detalhe canônico mínimo. As dimensões que o wizard ainda não edita entram
 * vazias de propósito — o teste do snapshot remoto confere que elas sobrevivem
 * à projeção, e é isso que o teste protege.
 */
export function detalhe(overrides: Partial<ProcessoSeletivoDto> = {}): ProcessoSeletivoDto {
  return {
    ...identificacaoDoDetalhe(),
    ...dimensoesVaziasDoDetalhe(),
    configuracaoTaxaInscricao: TAXA_DE_INSCRICAO,
    ...overrides,
  } as ProcessoSeletivoDto;
}

export function documento(overrides: Partial<DocumentoAPublicarDto> = {}): DocumentoAPublicarDto {
  return {
    id: '019f41cf-69fd-759a-ac6d-09acabc1b030',
    processoSeletivoId: PROCESSO_ID,
    finalidade: FinalidadeDoDocumento.documentoDoEdital,
    nomeArquivo: 'edital-de-abertura.pdf',
    tipoDeMidia: 'application/pdf',
    status: 'Confirmado',
    tamanhoBytes: 2048,
    hashSha256: 'a'.repeat(64),
    ...INSTANTES_DO_DOCUMENTO_CONFIRMADO,
    ...overrides,
  };
}

export interface CenarioOpts {
  readonly id?: string | null;
  readonly obter?: ReturnType<typeof vi.fn>;
  /** O checklist estrutural que o servidor devolve — sem item nenhum por padrão. */
  readonly obterConformidade?: ReturnType<typeof vi.fn>;
  readonly listarDocumentos?: ReturnType<typeof vi.fn>;
  /** Simula catálogo de tipos indisponível. */
  readonly tiposFalham?: boolean;
  /** Simula catálogo de unidades indisponível. */
  readonly unidadesFalham?: boolean;
  /** Permite emitir mudanças de rota durante o teste. */
  readonly paramMap?: ParamMapDaRota;
}

function leiturasDoServidor(opts: CenarioOpts) {
  return {
    obter: opts.obter ?? vi.fn(() => of(okResult(detalhe()))),
    obterConformidade:
      opts.obterConformidade ?? vi.fn(() => of(okResult({ itens: [] as ItemConformidadeDto[] }))),
    definirTaxaInscricao: vi.fn(() => of(okResult(undefined))),
    listarDocumentos: opts.listarDocumentos ?? vi.fn(() => of(okResult([]))),
  };
}

type LeiturasDoServidor = ReturnType<typeof leiturasDoServidor>;

function provedoresDaIdentificacao(opts: CenarioOpts): Provider[] {
  const tipos = { listar: () => respostaVazia<TipoProcessoDto>() };
  const unidades = { listar: () => respostaVazia<UnidadeDto>() };
  return [
    { provide: TiposProcessoApi, useValue: opts.tiposFalham ? falhaDeCatalogo : tipos },
    { provide: UnidadesApi, useValue: opts.unidadesFalham ? falhaDeCatalogo : unidades },
    { provide: GeoApi, useValue: { listarCidades: () => respostaVazia<never>() } },
  ];
}

function provedorDeProcessos(leituras: LeiturasDoServidor): Provider {
  return {
    provide: ProcessosSeletivosApi,
    useValue: {
      obter: leituras.obter,
      listarFundamentosIsencao: () => of(okResult<readonly FundamentoIsencaoDto[]>([])),
      definirTaxaInscricao: leituras.definirTaxaInscricao,
    },
  };
}

function provedorDeDocumentos(leituras: LeiturasDoServidor): Provider {
  return {
    provide: DocumentosEAtosDoProcessoApi,
    useValue: { listarDocumentosAPublicar: leituras.listarDocumentos },
  };
}

function provedorDaPublicacao(leituras: LeiturasDoServidor): Provider {
  return {
    provide: PublicacaoDoProcessoApi,
    useValue: {
      obterConformidade: leituras.obterConformidade,
      // A Revisão de processo publicado lê o ato vigente; estas suítes não exercitam o ato.
      obterSnapshotVigente: () => NEVER,
    },
  };
}

function provedoresDoProcesso(leituras: LeiturasDoServidor): Provider[] {
  return [
    provedorDeProcessos(leituras),
    provedorDeDocumentos(leituras),
    provedorDaPublicacao(leituras),
  ];
}

function provedorDaRota(opts: CenarioOpts): Provider {
  const id = opts.id === undefined ? PROCESSO_ID : opts.id;
  return {
    provide: ActivatedRoute,
    useValue: {
      snapshot: { paramMap: { get: () => id } },
      paramMap: opts.paramMap ?? of({ get: () => id }),
    },
  };
}

function configurarModulo(opts: CenarioOpts, leituras: LeiturasDoServidor): void {
  TestBed.configureTestingModule({
    imports: [ProcessoSeletivoPage],
    providers: [
      fornecerVocabulariosDaRegra(),
      { provide: PermissoesService, useValue: { tem: concedeSoPublicar } },
      provideRouter([]),
      ...provedoresDaIdentificacao(opts),
      ...PROVEDORES_DE_CATALOGO_VAZIO,
      ...provedoresDoProcesso(leituras),
      ...PROVEDORES_SEM_LEITURA,
      provedorDaRota(opts),
    ],
  });
}

// O roteador do TestBed não conhece as rotas reais; navegar de verdade rejeitaria com NG04002.
// Os testes que verificam a troca de endereço leem este espião.
function espiarNavegacao() {
  return vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
}

function abrirPagina(leituras: LeiturasDoServidor) {
  const navigate = espiarNavegacao();
  const fixture = TestBed.createComponent(ProcessoSeletivoPage);
  fixture.detectChanges();
  return {
    fixture,
    ...leituras,
    navigate,
    componente: fixture.componentInstance,
    // O store é provido pela própria página, não pelo injector do TestBed.
    store: fixture.componentInstance.store,
    host: fixture.nativeElement as HTMLElement,
  };
}

export function montar(opts: CenarioOpts = {}) {
  const leituras = leiturasDoServidor(opts);
  configurarModulo(opts, leituras);
  return abrirPagina(leituras);
}

export const propagar = async (): Promise<void> => {
  // Uma volta por await encadeado de `retomar`: o detalhe, os documentos do edital, o rascunho
  // da publicação e o checklist que dá o estado do stepper. Sobra de volta não atrapalha quem
  // precisa de menos.
  for (let volta = 0; volta < 8; volta += 1) await Promise.resolve();
};

export function item(codigo: string, dimensao: string, ok: boolean): ItemConformidadeDto {
  return { codigo, dimensao, mensagem: codigo, ok };
}

export function indiceDoPasso(rotulo: string): number {
  return PASSOS.findIndex((passo) => passo.rotulo === rotulo);
}
