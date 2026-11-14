import {
  HttpClient,
  HttpContext,
  HttpInterceptorFn,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { ApiFailure, ApiResult, isApiFailure } from './api-result';
import { apiResultInterceptor } from './api-result.interceptor';
import { ProblemDetails } from './problem-details';

export interface Edital {
  readonly id: string;
  readonly numero: number;
}

export const PROBLEM_HEADERS = { 'Content-Type': 'application/problem+json' };

const URL_DOS_ERROS = 'https://unifesspa-edu-br.github.io/uniplus-developers/erros';

export const baseProblem: ProblemDetails = {
  type: `${URL_DOS_ERROS}/uniplus.selecao.edital.nao_encontrado`,
  title: 'Edital não encontrado',
  status: 404,
  code: 'uniplus.selecao.edital.nao_encontrado',
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
};

export type CorpoDaResposta = Parameters<TestRequest['flush']>[0];

export type InitDaResposta = NonNullable<Parameters<TestRequest['flush']>[1]>;

export interface RespostaSimulada {
  readonly corpo: CorpoDaResposta;
  readonly init: InitDaResposta;
}

export interface Chamada {
  readonly metodo: 'GET' | 'POST';
  readonly url: string;
  readonly contexto?: HttpContext;
}

export interface AmbienteHttp {
  readonly http: HttpClient;
  readonly controller: HttpTestingController;
}

export function provedoresDeHttpComEnvelope(
  ...interceptadoresAdicionais: readonly HttpInterceptorFn[]
): (EnvironmentProviders | Provider)[] {
  return [
    provideHttpClient(withInterceptors([apiResultInterceptor, ...interceptadoresAdicionais])),
    provideHttpClientTesting(),
  ];
}

export function prepararAmbienteHttp(): AmbienteHttp {
  TestBed.configureTestingModule({ providers: provedoresDeHttpComEnvelope() });
  return {
    http: TestBed.inject(HttpClient),
    controller: TestBed.inject(HttpTestingController),
  };
}

export function problemaDe(status: number, code: string, title: string): ProblemDetails {
  return { ...baseProblem, type: `${URL_DOS_ERROS}/${code}`, title, status, code };
}

export function chamadaGet(url: string, contexto?: HttpContext): Chamada {
  return { metodo: 'GET', url, contexto };
}

export function chamadaPost(url: string): Chamada {
  return { metodo: 'POST', url };
}

export function resposta(
  status: number,
  statusText: string,
  corpo: CorpoDaResposta,
  headers: Record<string, string> = {},
): RespostaSimulada {
  return { corpo, init: { status, statusText, headers } };
}

export function problemJson(
  status: number,
  statusText: string,
  corpo: CorpoDaResposta,
  headersExtras: Record<string, string> = {},
): RespostaSimulada {
  return resposta(status, statusText, corpo, { ...PROBLEM_HEADERS, ...headersExtras });
}

function emitir(ambiente: AmbienteHttp, chamada: Chamada): Observable<ApiResult<unknown>> {
  const opcoes = { context: chamada.contexto };
  return chamada.metodo === 'GET'
    ? ambiente.http.get<ApiResult<unknown>>(chamada.url, opcoes)
    : ambiente.http.post<ApiResult<unknown>>(chamada.url, {}, opcoes);
}

export function receber(
  ambiente: AmbienteHttp,
  chamada: Chamada,
  simulada: RespostaSimulada,
): ApiResult<unknown> | undefined {
  let recebido: ApiResult<unknown> | undefined;
  emitir(ambiente, chamada).subscribe((resultado) => (recebido = resultado));
  ambiente.controller.expectOne(chamada.url).flush(simulada.corpo, simulada.init);
  return recebido;
}

export function falhaDe(
  ambiente: AmbienteHttp,
  chamada: Chamada,
  simulada: RespostaSimulada,
): ApiFailure {
  const recebido = receber(ambiente, chamada, simulada);
  if (recebido === undefined || !isApiFailure(recebido)) {
    throw new Error('A chamada devia terminar em ApiResult.fail.');
  }
  return recebido;
}
