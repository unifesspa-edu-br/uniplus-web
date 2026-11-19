import type { Page, Route } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import {
  ATO_DTO,
  ATO_ID,
  DOCUMENTO_CONFIRMADO_DO_EDITAL,
  FASE_DE_COLETA,
  PREVISTOS_DO_PROCESSO,
  PROCESSO_ID,
  SNAPSHOT_DA_PUBLICACAO,
  TIPO_ATO_DTO,
  atoDoProcesso,
  processoDto,
} from '../fixtures/processo-da-revisao';
import { isolarDaApi } from './isolar-da-api';
import { PERMISSOES_DO_LEANDRO } from './permissoes';
import { responder, responderCom } from './responder';
import { instalarPreferencia, temaDoProject } from './tema';

export const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

const ROTA_DOS_TIPOS_DE_ATO = /\/api\/publicacoes\/tipos-ato(\?.*)?$/;
const ROTA_DO_ATO_PUBLICADO = new RegExp(`/api/publicacoes/atos/${ATO_ID}$`);
const ROTA_DO_PROCESSO = new RegExp(
  `/api/selecao/processos-seletivos/${PROCESSO_ID}(/.*)?(\\?.*)?$`,
);

export interface MockarProcessoOpcoes {
  readonly classificacao?: unknown;
  readonly status?: 'rascunho' | 'publicado';
  readonly cronogramaFases?: readonly unknown[];
  readonly conformidadeItens?: readonly {
    codigo: string;
    dimensao: string;
    mensagem: string;
    ok: boolean;
  }[];
  readonly conformidadeAvisos?: readonly { codigo: string; dimensao: string; mensagem: string }[];
  readonly conformidadeLegalRegras?: readonly unknown[];
}

function comPadroes(opcoes: MockarProcessoOpcoes) {
  return {
    ...opcoes,
    cronogramaFases: opcoes.cronogramaFases ?? [FASE_DE_COLETA],
    conformidadeItens: opcoes.conformidadeItens ?? [],
    conformidadeAvisos: opcoes.conformidadeAvisos ?? [],
    conformidadeLegalRegras: opcoes.conformidadeLegalRegras ?? [],
    status: opcoes.status ?? 'rascunho',
  };
}

type ProcessoMockado = ReturnType<typeof comPadroes>;

/** O corpo de cada leitura sob o prefixo do processo; `undefined` é a resposta 404. */
const LEITURAS_DO_PROCESSO: readonly (readonly [string, (p: ProcessoMockado) => unknown])[] = [
  ['/documentos-a-publicar', () => [DOCUMENTO_CONFIRMADO_DO_EDITAL]],
  ['/snapshot-vigente', () => SNAPSHOT_DA_PUBLICACAO],
  ['/produtos-previstos', () => PREVISTOS_DO_PROCESSO],
  ['/atos', () => [atoDoProcesso()]],
  [
    '/conformidade-legal',
    (p) => ({
      processoSeletivoId: PROCESSO_ID,
      dataReferencia: '2027-01-01',
      regras: p.conformidadeLegalRegras,
      avisos: [],
    }),
  ],
  [
    '/conformidade',
    (p) => ({
      processoSeletivoId: PROCESSO_ID,
      itens: p.conformidadeItens,
      avisos: p.conformidadeAvisos,
    }),
  ],
];

function corpoDaLeitura(caminho: string, processo: ProcessoMockado): unknown {
  const leitura = LEITURAS_DO_PROCESSO.find(([sufixo]) => caminho.endsWith(sufixo));
  if (leitura !== undefined) return leitura[1](processo);
  // O detalhe é a própria rota `/processos-seletivos/{id}`, sem sufixo.
  return processoDto(processo.cronogramaFases, processo.status, processo.classificacao);
}

async function atenderOProcesso(route: Route, processo: ProcessoMockado): Promise<void> {
  const request = route.request();
  if (request.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  const corpo = corpoDaLeitura(new URL(request.url()).pathname, processo);
  if (corpo === undefined) await route.fulfill({ status: 404, headers: CORS_HEADERS });
  else await responderCom(route, corpo, CORS_HEADERS);
}

/**
 * Um único `page.route` para o agregado Processo Seletivo — despacha pelo
 * final do caminho, porque o detalhe, os documentos e os dois checklists
 * moram todos sob o mesmo prefixo `/processos-seletivos/{id}`.
 */
export async function mockarProcesso(page: Page, opcoes: MockarProcessoOpcoes = {}): Promise<void> {
  const processo = comPadroes(opcoes);
  await page.route(ROTA_DO_PROCESSO, (route: Route) => atenderOProcesso(route, processo));
}

export async function mockarTiposAto(page: Page): Promise<void> {
  await responder(page, ROTA_DOS_TIPOS_DE_ATO, [TIPO_ATO_DTO], CORS_HEADERS);
}

export async function mockarAtoPublicado(page: Page): Promise<void> {
  await responder(page, ROTA_DO_ATO_PUBLICADO, ATO_DTO, CORS_HEADERS);
}

/** As permissões do operador, os tipos de ato e o tema do project, antes de cada cenário. */
export async function prepararARevisao(page: Page, nomeDoProject: string): Promise<void> {
  await isolarDaApi(page);
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
  await mockarTiposAto(page);
  await instalarPreferencia(page, temaDoProject(nomeDoProject));
}
