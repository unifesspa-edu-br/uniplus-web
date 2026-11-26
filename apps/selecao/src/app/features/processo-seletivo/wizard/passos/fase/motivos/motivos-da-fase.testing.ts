import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type EnvironmentProviders, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  SELECAO_BASE_PATH,
  SentidoDoMotivoCodigo,
  SituacaoDoProcessoSeletivoCodigo,
  TipoMotivoDeDecisaoCodigo,
  type MotivoDeDecisaoDoProcessoDto,
  type MotivoDeDecisaoDto,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { faseDoServidor } from '../../../shared/cronograma-do-servidor.testing';
import { dtoComCronograma } from '../../../shared/hidratacao.testing';
import { umMotivoDoCadastro } from '../../../shared/motivos/motivos.testing';
import { FasesNoServidor } from '../../cronograma/servicos/fases-no-servidor.service';
import { FaseEmEdicao } from '../fase-em-edicao';
import { MotivosDaFaseStore } from './motivos-da-fase.store';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
export const FASE_ID = 'fase-canonica-homologacao';
export const OUTRA_FASE_ID = 'fase-canonica-avaliacao';
export const MOTIVO_SEM_RESULTADO = '01960000-0000-7000-0000-0000000000a1';
export const MOTIVO_FORA_DO_PRAZO = '01960000-0000-7000-0000-0000000000a2';
export const PERMISSAO_DE_CONFIGURAR = 'selecao:processos:configurar';

export const ROTA_DA_ESCOLHA_DO_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/motivos-de-decisao`;

export function rotaDoMotivoNaFase(motivoId: string, faseId = FASE_ID): string {
  return `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/fases/${faseId}/motivos-de-decisao/${motivoId}`;
}

export const PROBLEMA_JSON = { 'content-type': 'application/problem+json' };

export function corpoDoProblema(status: number, code: string) {
  return {
    type: `https://erros.example/${code}`,
    title: 'A escolha do motivo foi recusada.',
    status,
    code,
    traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
  };
}

/** O motivo de homologação das inscrições, desfavorável, como o cadastro o traz. */
export const SEM_RESULTADO_NO_CADASTRO: MotivoDeDecisaoDto = umMotivoDoCadastro({
  id: MOTIVO_SEM_RESULTADO,
  codigo: 'SEM_RESULTADO_INEP',
  descricao: 'Sem resultado no retorno do INEP.',
});

export const FORA_DO_PRAZO_NO_CADASTRO: MotivoDeDecisaoDto = umMotivoDoCadastro({
  id: MOTIVO_FORA_DO_PRAZO,
  codigo: 'FORA_DO_PRAZO',
  descricao: 'Inscrição fora do prazo.',
});

const CAMPOS_LIDOS_EM_COMUM = {
  tipo: {
    codigo: TipoMotivoDeDecisaoCodigo.HOMOLOGACAO_DAS_INSCRICOES,
    rotulo: 'Homologação das inscrições',
  },
  subclassificacao: null,
  sentido: { codigo: SentidoDoMotivoCodigo.DESFAVORAVEL, rotulo: 'Desfavorável' },
  vigencia: { versaoDoEditalDeEntrada: 1, versaoDoEditalDeSaida: null },
  justificativaDaInclusao: null,
};

/** Um motivo que o processo escolheu, como a leitura do servidor o devolve. */
export function escolhidoPeloProcesso(
  motivo: MotivoDeDecisaoDto,
  faseId: string | null = FASE_ID,
): MotivoDeDecisaoDoProcessoDto {
  return {
    ...CAMPOS_LIDOS_EM_COMUM,
    motivoDeDecisaoId: motivo.id,
    lugar: { faseCanonicaOrigemId: faseId, etapaId: faseId === null ? 'etapa-1' : null },
    codigo: motivo.codigo,
    descricao: motivo.descricao,
  };
}

export interface OpcoesDaMontagem {
  /** A fase foi gravada no servidor: o processo lido a traz no cronograma. */
  readonly faseGravada?: boolean;
  readonly situacao?: SituacaoDoProcessoSeletivoCodigo;
  readonly permissoes?: readonly string[];
  readonly tiposDeclarados?: readonly string[];
}

function processoLido(opcoes: OpcoesDaMontagem): ProcessoSeletivoDto {
  const fases =
    opcoes.faseGravada === false ? [] : [faseDoServidor({ faseCanonica: { origemId: FASE_ID } })];
  return {
    ...dtoComCronograma({ cronogramaFases: fases, etapas: [] }),
    situacao: {
      codigo: opcoes.situacao ?? SituacaoDoProcessoSeletivoCodigo.RASCUNHO,
      rotulo: 'Situação',
    },
  } as unknown as ProcessoSeletivoDto;
}

function faseEmEdicaoDeTeste(tiposDeclarados: readonly string[]): FaseEmEdicao {
  return {
    faseAberta: signal(FASE_ID),
    nomeDaFaseAberta: signal('Homologação das inscrições'),
    idDaFase: (sufixo: string) => `fase-HOMOLOGACAO_INSCRICOES-${sufixo}`,
    espelho: {
      versao: signal(0),
      formulario: () => ({ controls: { tiposDeDecisao: { value: tiposDeclarados } } }),
    },
  } as unknown as FaseEmEdicao;
}

export interface Montagem {
  readonly store: MotivosDaFaseStore;
  readonly processo: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
}

function permissoesDeTeste(concedidas: readonly string[]): Pick<PermissoesService, 'tem'> {
  return { tem: (codigo: string) => concedidas.includes(codigo) };
}

function provedoresDoStore(opcoes: OpcoesDaMontagem): readonly (Provider | EnvironmentProviders)[] {
  const permissoes = opcoes.permissoes ?? [PERMISSAO_DE_CONFIGURAR];
  return [
    MotivosDaFaseStore,
    FasesNoServidor,
    ProcessoSeletivoStore,
    provideHttpClient(withInterceptors([apiResultInterceptor])),
    provideHttpClientTesting(),
    { provide: SELECAO_BASE_PATH, useValue: BASE },
    { provide: PermissoesService, useValue: permissoesDeTeste(permissoes) },
    { provide: FaseEmEdicao, useValue: faseEmEdicaoDeTeste(opcoes.tiposDeclarados ?? []) },
  ];
}

/** O store dos motivos da fase aberta, com a API simulada pelo controlador de HTTP. */
export function montarOStoreDosMotivos(
  opcoes: OpcoesDaMontagem = {},
  adicionais: readonly Provider[] = [],
): Montagem {
  TestBed.configureTestingModule({ providers: [...provedoresDoStore(opcoes), ...adicionais] });
  const processo = TestBed.inject(ProcessoSeletivoStore);
  processo.processoSeletivoId.set(PROCESSO_ID);
  processo.remoteSnapshot.set(processoLido(opcoes));
  return {
    store: TestBed.inject(MotivosDaFaseStore),
    processo,
    controller: TestBed.inject(HttpTestingController),
  };
}

/** Deixa as promessas pendentes andarem até a próxima requisição. */
export function esperar(): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver));
}

export const ROTA_DO_CADASTRO = `${BASE}/api/selecao/motivos-de-decisao`;

/** Responde às duas leituras que o store faz ao carregar: o cadastro e a escolha do processo. */
export async function carregarComOServidor(
  { store, controller }: Montagem,
  cadastro: readonly MotivoDeDecisaoDto[],
  escolha: readonly MotivoDeDecisaoDoProcessoDto[],
): Promise<void> {
  store.carregar();
  controller.expectOne((req) => req.url === ROTA_DO_CADASTRO).flush(cadastro);
  controller.expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO).flush(escolha);
  await esperar();
}
