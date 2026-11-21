import type { Page, Route } from '@playwright/test';
import type { DefinirItensDoFormularioRequest } from '@uniplus/shared-data/selecao';
import { mockPermissoesEfetivas, type JsonDaApi } from '@uniplus/shared-e2e';
import {
  FUNDAMENTOS_DE_ISENCAO,
  PROCESSO_PUBLICADO_DA_MEDICINA,
  TIPOS_DE_PROCESSO,
} from '../fixtures/consulta-da-medicina';
import { faseDoServidor } from '../fixtures/cronograma-do-servidor';
import { PERMISSOES_DO_LEANDRO } from './permissoes';
import { problema, recusar } from './api-da-unidade-da-fase';
import { responder, responderCom } from './responder';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, accept, content-type, idempotency-key',
};

const ID_DO_PROCESSO = PROCESSO_PUBLICADO_DA_MEDICINA.id;
const ROTA_DO_PROCESSO = new RegExp(`/api/selecao/processos-seletivos/${ID_DO_PROCESSO}`);
const ROTA_DA_REFERENCIA_TEMPORAL = new RegExp(
  `/api/selecao/processos-seletivos/${ID_DO_PROCESSO}/referencia-temporal-fatos$`,
);
const ROTA_DOS_ITENS = new RegExp(
  `/api/selecao/admin/processos-seletivos/${ID_DO_PROCESSO}/formularios/INSCRICAO/itens$`,
);

/** O corpo do `PUT /formularios/INSCRICAO/itens`, na forma que o contrato declara. */
export type CorpoDosItens = JsonDaApi<DefinirItensDoFormularioRequest>;

export interface GravacoesDosItens {
  readonly corpos: CorpoDosItens[];
  /** A recusa 422 com que o servidor responde ao PUT dos itens; nula, ele grava. */
  recusa: { readonly field: string; readonly message: string } | null;
}

async function gravarOsItens(route: Route, gravacoes: GravacoesDosItens): Promise<void> {
  const requisicao = route.request();
  if (requisicao.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  const corpo: CorpoDosItens = requisicao.postDataJSON();
  gravacoes.corpos.push(corpo);
  if (gravacoes.recusa === null) return route.fulfill({ status: 204, headers: CORS });
  const erro = { ...gravacoes.recusa, code: 'uniplus.selecao.formulario.item_invalido' };
  return recusar(route, problema(422, 'uniplus.validacao', 'Validação', [erro]));
}

/** O processo em rascunho, com a fase em que o formulário de inscrição é respondido e já gravado nela. */
function processoComAFaseDaInscricao() {
  const faseDaInscricao = faseDoServidor();
  return {
    ...PROCESSO_PUBLICADO_DA_MEDICINA,
    status: 'rascunho',
    cronogramaFases: [faseDaInscricao],
    formularios: PROCESSO_PUBLICADO_DA_MEDICINA.formularios.map((formulario) => ({
      ...formulario,
      faseId: faseDaInscricao.id,
    })),
  };
}

async function lerOProcesso(route: Route): Promise<void> {
  const requisicao = route.request();
  if (requisicao.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  if (new URL(requisicao.url()).pathname.endsWith(ID_DO_PROCESSO)) {
    return responderCom(route, processoComAFaseDaInscricao(), CORS);
  }
  return route.fulfill({ status: 404, headers: CORS });
}

async function mockarOsCatalogos(page: Page): Promise<void> {
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
  await responder(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_DE_PROCESSO, CORS);
  await responder(
    page,
    /\/api\/selecao\/fundamentos-isencao(\?.*)?$/,
    FUNDAMENTOS_DE_ISENCAO,
    CORS,
  );
}

/**
 * O processo da Medicina 2027 em rascunho, com a fase em que o formulário de inscrição é respondido,
 * os catálogos que o passo Formulários lê e a política da idade, que a gravação do passo sempre
 * envia; toda outra consulta responde vazia. O PUT dos itens do formulário de inscrição é capturado
 * em `gravacoes`. A rota genérica vem primeiro porque o Playwright consulta as rotas da mais
 * recente para a mais antiga.
 */
export async function mockarFormularioDoProcesso(page: Page): Promise<GravacoesDosItens> {
  const gravacoes: GravacoesDosItens = { corpos: [], recusa: null };
  await responder(page, /\/api\//, [], CORS);
  await mockarOsCatalogos(page);
  await page.route(ROTA_DO_PROCESSO, lerOProcesso);
  await page.route(ROTA_DA_REFERENCIA_TEMPORAL, (route) =>
    route.fulfill({ status: 204, headers: CORS }),
  );
  await page.route(ROTA_DOS_ITENS, (route) => gravarOsItens(route, gravacoes));
  return gravacoes;
}
