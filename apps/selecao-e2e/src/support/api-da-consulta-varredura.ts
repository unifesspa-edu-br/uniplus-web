import type { Page, Route } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { FUNDAMENTOS_DE_ISENCAO, TIPOS_DE_PROCESSO } from '../fixtures/consulta-da-medicina';
import {
  ATO_DO_PROCESSO,
  ATO_PUBLICADO,
  DOCUMENTO_DO_EDITAL,
  FASES_CANONICAS,
  ID_DO_PROCESSO_COMPLETO,
  PROCESSO_PUBLICADO_COMPLETO,
  SNAPSHOT_VIGENTE,
} from '../fixtures/processo-publicado-completo';
import { situacaoDoProcesso } from '../fixtures/valor-do-enum';
import { PERMISSOES_DO_LEANDRO } from './permissoes';
import { responder, responderCom } from './responder';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

const CONFORMIDADE_LEGAL = {
  processoSeletivoId: ID_DO_PROCESSO_COMPLETO,
  dataReferencia: '2027-01-01',
  regras: [],
  avisos: [],
};

function respostasDoProcesso(status: string): Record<string, unknown> {
  return {
    [ID_DO_PROCESSO_COMPLETO]: {
      ...PROCESSO_PUBLICADO_COMPLETO,
      situacao: situacaoDoProcesso(status),
    },
    'documentos-a-publicar': [DOCUMENTO_DO_EDITAL],
    atos: [ATO_DO_PROCESSO],
    'motivos-de-decisao': [],
    'snapshot-vigente': SNAPSHOT_VIGENTE,
    'conformidade-legal': CONFORMIDADE_LEGAL,
    conformidade: { processoSeletivoId: ID_DO_PROCESSO_COMPLETO, itens: [], avisos: [] },
  };
}

async function atenderProcesso(route: Route, status: string): Promise<void> {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  const caminho = new URL(route.request().url()).pathname;
  const corpo = respostasDoProcesso(status)[caminho.split('/').pop() ?? ''];
  if (corpo === undefined) return route.fulfill({ status: 404, headers: CORS });
  await responderCom(route, corpo, CORS);
}

async function mockarCatalogosDaConsulta(page: Page): Promise<void> {
  await responder(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_DE_PROCESSO, CORS);
  await responder(page, /\/api\/configuracao\/fases-canonicas(\?.*)?$/, FASES_CANONICAS, CORS);
  await responder(
    page,
    /\/api\/selecao\/fundamentos-isencao(\?.*)?$/,
    FUNDAMENTOS_DE_ISENCAO,
    CORS,
  );
}

export async function mockarApiDaConsulta(page: Page, status: string): Promise<void> {
  await responder(page, /\/api\//, [], CORS);
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
  await mockarCatalogosDaConsulta(page);
  await responder(
    page,
    new RegExp(`/api/publicacoes/atos/${ATO_PUBLICADO.id}$`),
    ATO_PUBLICADO,
    CORS,
  );
  const rota = new RegExp(`/api/selecao/processos-seletivos/${ID_DO_PROCESSO_COMPLETO}`);
  await page.route(rota, (route) => atenderProcesso(route, status));
}
