import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { of } from 'rxjs';
import { expect } from 'vitest';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiOk, apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  SELECAO_BASE_PATH,
  SituacaoDoRegistroDoAto,
  StatusProcesso,
  type AtoDoProcessoDto,
} from '@uniplus/shared-data/selecao';
import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { AtoNormativoDto, AtosApi, TiposAtoApi } from '@uniplus/shared-data/publicacoes';
import { FaseUpload, UploadItem, WizardDraft } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { EnvioDoEdital } from '../../shared/envio-do-edital.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { CatalogoDeFases } from '../cronograma/catalogos/catalogo-de-fases.service';
import { RevisaoPassoComponent } from './revisao.component';
import { PublicacaoDoProcesso } from './servicos/publicacao-do-processo.service';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000009aa';
export const DOCUMENTO_ID = '01960000-0000-7000-0000-0000000009bb';

export const ROTA_CONFORMIDADE = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/conformidade`;
export const ROTA_CONFORMIDADE_LEGAL = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/conformidade-legal`;
export const ROTA_PUBLICACAO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/publicacao`;
export const ROTA_DETALHE = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
export const ROTA_SNAPSHOT = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/snapshot-vigente`;
export const ROTA_ATOS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/atos`;

export function edital(fase: FaseUpload): UploadItem {
  return {
    id: 'u1',
    name: 'edital.pdf',
    extension: 'pdf',
    progress: 100,
    fase,
    documentoAPublicarId: fase === 'confirmado' ? DOCUMENTO_ID : undefined,
  };
}

export function atoCompleto(): WizardDraft['publicacao']['ato'] {
  return {
    orgao: 'Reitoria',
    serie: '1',
    ano: '2027',
    dataPublicacao: '2027-01-15',
    assinante: 'Reitor',
    tipoAtoCodigo: 'PORTARIA',
  };
}

export const TIPO_ATO_DTO = {
  id: 't1',
  codigo: 'PORTARIA',
  nome: 'Portaria',
  congelaConfiguracao: true,
  unicoPorObjeto: false,
  efeitoIrreversivel: true,
  ehResultado: false,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
  baseLegal: null,
  criadoEm: '2020-01-01T00:00:00Z',
};

export const CONFORMIDADE_VERDE = { processoSeletivoId: PROCESSO_ID, itens: [], avisos: [] };
export const CONFORMIDADE_LEGAL_VERDE = {
  processoSeletivoId: PROCESSO_ID,
  dataReferencia: '2027-01-01',
  regras: [],
  avisos: [],
};

export const PROCESSO_DTO_MINIMO = {
  id: PROCESSO_ID,
  nome: 'x',
  tipoProcesso: { origemId: 't1', codigo: 'T', nome: 'x' },
  status: StatusProcesso.publicado,
  origemCandidatos: 'InscricaoPropria',
  unidadeAdministradora: {
    origemId: 'u1',
    sigla: 'x',
    slug: 'x',
    nome: 'x',
    tipo: 'x',
    cidadeCodigoIbge: null,
    cidadeNome: null,
    cidadeUf: null,
  },
  localidade: { codigoIbge: '1500107', nome: 'x', uf: 'PA' },
  etapas: [],
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
  fatosColetados: [],
  regrasDerivacao: [],
  formularioTitulo: null,
  formularioTermoAceiteTexto: null,
  configuracaoDivulgacao: null,
  configuracaoTaxaInscricao: null,
  algoritmoContagemPrazo: null,
  criadoEm: '2027-01-01T00:00:00Z',
};

export const SNAPSHOT_DTO = {
  snapshotPublicacaoId: '01960000-0000-7000-0000-0000000009cc',
  atoId: '01960000-0000-7000-0000-0000000009dd',
  schemaVersion: '1',
  algoritmoHash: 'hash-a',
  hashConfiguracao: 'hash-configuracao-123456',
  hashEdital: 'hash-edital-123456',
  configuracao: {},
};

export const ATO_DO_PROCESSO: AtoDoProcessoDto = {
  id: SNAPSHOT_DTO.atoId,
  tipoCodigo: 'PORTARIA',
  tipoNome: 'Portaria',
  numero: '001/2026',
  dataDoAto: '2026-09-25',
  publicadoEm: '2026-09-25T12:00:00Z',
  assinante: 'Reitor da Unifesspa',
  situacao: SituacaoDoRegistroDoAto.registrado,
  registradoEm: '2026-09-25T12:00:00Z',
  pendenciaAcimaDoLimiar: false,
  atoCorrigidoId: null,
  motivoDaCorrecao: null,
  politicaDeDivulgacaoConfirmada: false,
  documentoPrincipal: {
    documentoAPublicarId: '01960000-0000-7000-0000-0000000009ee',
    nomeArquivo: 'edital.pdf',
    nomeDeExibicao: null,
    tipoDeMidia: 'application/pdf',
    hashSha256: 'b'.repeat(64),
  },
  anexos: [],
};

export const ATO_PUBLICADO: AtoNormativoDto = {
  id: SNAPSHOT_DTO.atoId,
  orgao: 'CEPS/Unifesspa',
  serie: 'Edital de Abertura',
  ano: 2026,
  numero: '001/2026',
  tipoCodigo: 'PORTARIA',
  tipoNome: null,
  congelaConfiguracao: true,
  efeitoIrreversivel: true,
  unicoPorObjeto: false,
  dataPublicacao: '2026-09-25',
  anexos: [],
  documentoHash: 'hash-do-documento',
  assinante: 'Reitor da Unifesspa',
  registradoEm: '2026-09-25T12:00:00Z',
  versaoInvocadaId: null,
  versaoInvocadaHash: null,
  atoRetificadoId: null,
  motivoRetificacao: null,
  avisos: null,
  _links: null,
};
/** Os dobles que os testes trocam por caso, e o que o componente montado expõe. */
export interface CenarioDaRevisao {
  readonly fixture: ComponentFixture<RevisaoPassoComponent>;
  readonly componente: RevisaoPassoComponent;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
  /** Mutável por teste: a fase de coleta pode não ter `congelados` ainda, e é o catálogo quem resolve. */
  readonly fasePorId: WritableSignal<ReadonlyMap<string, FaseCanonicaDto>>;
  readonly negadas: WritableSignal<readonly string[]>;
  /** As chamadas a `GET …/atos/{id}`, para provar quando a leitura acontece. */
  readonly atosLidos: string[];
  /** Resposta do `GET …/atos/{id}`, trocada por teste. */
  respostaDoAto: ReturnType<AtosApi['obter']>;
}

export async function montarOCenario(): Promise<CenarioDaRevisao> {
  const negadas = signal<readonly string[]>([]);
  const fasePorId = signal<ReadonlyMap<string, FaseCanonicaDto>>(new Map());
  const atosLidos: string[] = [];
  const cenario: { respostaDoAto: ReturnType<AtosApi['obter']> } = {
    respostaDoAto: of(apiOk(ATO_PUBLICADO, 200, new HttpHeaders())),
  };
  const atosApi = {
    obter: (id: string) => {
      atosLidos.push(id);
      return cenario.respostaDoAto;
    },
  };

  await TestBed.configureTestingModule({
    imports: [RevisaoPassoComponent],
    providers: [
      ProcessoSeletivoStore,
      CadastroInicial,
      GravacaoDoProcesso,
      EnvioDoEdital,
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      { provide: SELECAO_BASE_PATH, useValue: BASE },
      {
        provide: PermissoesService,
        useValue: { tem: (codigo: string) => !negadas().includes(codigo) },
      },
      {
        provide: TiposAtoApi,
        useValue: { listar: () => of(apiOk([TIPO_ATO_DTO], 200, new HttpHeaders())) },
      },
      { provide: AtosApi, useValue: atosApi },
      // Só o que a Revisão lê do catálogo de fases, sem puxar as sete APIs do serviço real.
      {
        provide: CatalogoDeFases,
        useValue: { fasePorId, nomeDaFase: signal((codigo: string) => `Fase ${codigo}`) },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(RevisaoPassoComponent);
  const montada = Object.assign(cenario, {
    fixture,
    componente: fixture.componentInstance,
    store: TestBed.inject(ProcessoSeletivoStore),
    controller: TestBed.inject(HttpTestingController),
    fasePorId,
    negadas,
    atosLidos,
  });
  fixture.detectChanges();
  return montada;
}

/**
 * `setTimeout(0)` espera a fila de microtarefas inteira drenar: não importa quantos saltos
 * (scheduler de `effect()`, cadeia de `firstValueFrom`/`Promise.all`) aconteçam por dentro, o que
 * uma única `await Promise.resolve()` não garante.
 */
export function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * O `effect()` que dispara a prontidão roda no scheduler do Angular. Ele recarrega ao entrar no
 * passo, e a Revisão é sempre o último, então o cenário também precisa estar lá.
 */
export async function criarProcesso(cenario: CenarioDaRevisao): Promise<void> {
  cenario.store.passoAtual.set(cenario.store.totalDePassos - 1);
  cenario.store.processoSeletivoId.set(PROCESSO_ID);
  await flushMicrotasks();
  cenario.fixture.detectChanges();
}

/** Prepara o rascunho com tudo que a conferência local cobra, exceto a prontidão do servidor. */
export function prepararCamposLocais(cenario: CenarioDaRevisao): void {
  cenario.store.patchObjectSection('identificacao', { uploads: [edital('confirmado')] });
  cenario.store.patchObjectSection('publicacao', {
    numero: '001/2027',
    periodoInscricaoInicio: '2027-05-01T08:00',
    periodoInscricaoFim: '2027-05-10T18:00',
    ato: atoCompleto(),
  });
}

export function publicacaoDe(cenario: CenarioDaRevisao): PublicacaoDoProcesso {
  return cenario.fixture.debugElement.injector.get(PublicacaoDoProcesso);
}

export function textoDaTela(cenario: CenarioDaRevisao): string {
  return (cenario.fixture.nativeElement as HTMLElement).textContent ?? '';
}

export function clicarEm(cenario: CenarioDaRevisao, texto: string): void {
  const botao = Array.from(
    (cenario.fixture.nativeElement as HTMLElement).querySelectorAll('button'),
  ).find((candidato) => candidato.textContent?.trim() === texto);
  expect(botao, `botão "${texto}"`).toBeDefined();
  botao?.click();
}

export async function flushProntidaoVerde(cenario: CenarioDaRevisao): Promise<void> {
  cenario.controller.expectOne(ROTA_CONFORMIDADE).flush(CONFORMIDADE_VERDE);
  cenario.controller
    .expectOne((req) => req.url === ROTA_CONFORMIDADE_LEGAL)
    .flush(CONFORMIDADE_LEGAL_VERDE);
  await flushMicrotasks();
}
