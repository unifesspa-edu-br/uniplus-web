import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { apiResultInterceptor, apiOk } from '@uniplus/shared-core/http';
import {
  SELECAO_BASE_PATH,
  type DocumentoDaConfiguracao,
  type ProcessoSeletivoDto,
  type SituacaoDoProcessoSeletivoCodigo,
} from '@uniplus/shared-data/selecao';

import type { VersaoBaseDaRetificacao } from './versao-base-da-retificacao';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000015a1';
export const OUTRO_PROCESSO_ID = '01960000-0000-7000-0000-0000000015a2';
export const ERRO_503 = { status: 503, statusText: 'Service Unavailable' };

export const rotaDoProcesso = (id: string): string =>
  `${BASE}/api/selecao/processos-seletivos/${id}`;
export const rotaDaConfiguracao = (id: string): string => `${rotaDoProcesso(id)}/configuracao`;

export const provedoresDeLeitura: (Provider | EnvironmentProviders)[] = [
  provideHttpClient(withInterceptors([apiResultInterceptor])),
  provideHttpClientTesting(),
  { provide: SELECAO_BASE_PATH, useValue: BASE },
];

export function documentoDaVersao(nome: string, versao = 3): DocumentoDaConfiguracao {
  return {
    formato: 'uniplus.selecao.configuracao',
    versaoFormato: 1,
    versao,
    identificacao: { nome },
  } as DocumentoDaConfiguracao;
}

export function processoNaSituacao(
  id: string,
  situacao: SituacaoDoProcessoSeletivoCodigo,
  nome = 'Medicina 2027',
): ProcessoSeletivoDto {
  return { id, nome, situacao: { codigo: situacao, rotulo: situacao } } as ProcessoSeletivoDto;
}

export function baseDaRetificacao(nome = 'Medicina 2027', versao = 3): VersaoBaseDaRetificacao {
  const documento = documentoDaVersao(nome, versao);
  return { id: PROCESSO_ID, versao, etag: '"v3"', documento };
}

export function respostaComEtag(documento: DocumentoDaConfiguracao, etag: string | null) {
  const headers = etag === null ? new HttpHeaders() : new HttpHeaders({ ETag: etag });
  return apiOk(documento, 200, headers);
}

export function comEtag(etag: string): { headers: HttpHeaders } {
  return { headers: new HttpHeaders({ ETag: etag }) };
}

/** Cede o event loop para a cadeia de `await` avançar até o desfecho. */
export function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
