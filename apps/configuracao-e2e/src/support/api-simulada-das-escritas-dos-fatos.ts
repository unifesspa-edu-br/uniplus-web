import type { Page, Route } from '@playwright/test';
import { FATO, emManutencao } from './fato-do-candidato';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const FASES = [{ id: 'f1', codigo: 'INSCRICAO', nome: 'Inscrição', descricao: null }];

/** Atraso da recarga da lista após a escrita: o foco só pode mudar quando ela termina. */
export const ATRASO_DA_RECARGA_EM_MS = 1500;

export const ERRO_INTERNO = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};

export const CONFLITO = {
  type: 'about:blank',
  title: 'Conflito de concorrência',
  status: 409,
  code: 'uniplus.concorrencia.conflito',
};

export const RECUSA_DE_NOME = {
  type: 'about:blank',
  title: 'Requisição inválida',
  status: 422,
  code: 'uniplus.validation_failed',
  traceId: 'e2e',
  errors: [
    {
      field: 'nome',
      code: 'uniplus.configuracao.fato_candidato.nome_tamanho',
      message: 'Nome fora do padrão.',
    },
  ],
};

async function responder(route: Route, status: number, corpo?: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    headers: CORS_HEADERS,
    body: status === 204 || corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

async function instalarTiposDoDado(page: Page): Promise<void> {
  await page.route(/\/api\/configuracao\/vocabularios\/tipos-do-dado$/, (r) =>
    responder(r, 200, [
      { codigo: 'SIM_OU_NAO', rotulo: 'Sim ou não' },
      { codigo: 'OPCAO', rotulo: 'Opção' },
      { codigo: 'TEXTO', rotulo: 'Texto' },
    ]),
  );
}

async function instalarHipotesesLegais(page: Page): Promise<void> {
  await page.route(/\/api\/configuracao\/vocabularios\/hipoteses-legais-tratamento$/, (r) =>
    responder(r, 200, [
      { codigo: 'EXECUCAO_POLITICAS_PUBLICAS', rotulo: 'Execução de políticas públicas' },
      { codigo: 'OBRIGACAO_LEGAL', rotulo: 'Cumprimento de obrigação legal' },
    ]),
  );
}

type Recarga = 'com-o-fato' | 'sem-o-fato' | 'com-falha';

interface RespostaDaEscrita {
  readonly status: number;
  readonly corpo?: unknown;
}

const ROTA_DA_LISTA = /\/api\/configuracao\/admin\/fatos-candidato(\?.*)?$/;
const ROTA_DO_FATO = /\/api\/configuracao\/admin\/fatos-candidato\/[^/?]+(\/[^?]*)?(\?.*)?$/;

/** Responde ao preflight do navegador; diz se a requisição era essa. */
async function respondeuAoPreflight(route: Route): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') return false;
  await route.fulfill({ status: 204, headers: CORS_HEADERS });
  return true;
}

/** A escrita fica retida até `liberar()`, para observar a tela enquanto ela está em curso. */
class ApiDosFatos {
  readonly envios: string[] = [];
  liberar: () => void = () => undefined;
  private readonly retida = new Promise<void>((resolve) => (this.liberar = resolve));
  private consultas = 0;
  private escrito = false;

  constructor(
    private readonly resposta: RespostaDaEscrita,
    private readonly recarga: Recarga,
  ) {}

  async instalar(page: Page): Promise<void> {
    await page.route(/\/api\/configuracao\/fases-canonicas(\?.*)?$/, (r) =>
      responder(r, 200, FASES),
    );
    await page.route(/\/api\/configuracao\/fatos-candidato(\?.*)?$/, (r) => responder(r, 200, []));
    await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo(\?.*)?$/, (r) =>
      responder(r, 200, []),
    );
    await instalarTiposDoDado(page);
    await instalarHipotesesLegais(page);
    await page.route(ROTA_DA_LISTA, (route) => this.naLista(route));
    await page.route(ROTA_DO_FATO, (route) => this.noFato(route));
  }

  private async naLista(route: Route): Promise<void> {
    if (await respondeuAoPreflight(route)) return;
    if (route.request().method() === 'GET') await this.lerLista(route);
    else await this.escrever(route);
  }

  private async noFato(route: Route): Promise<void> {
    if (await respondeuAoPreflight(route)) return;
    if (route.request().method() === 'GET') await responder(route, 200, emManutencao(FATO));
    else await this.escrever(route);
  }

  private async escrever(route: Route): Promise<void> {
    this.envios.push(route.request().method());
    await this.retida;
    this.escrito = this.resposta.status < 400 || this.recarga === 'sem-o-fato';
    await responder(route, this.resposta.status, this.resposta.corpo);
  }

  private async lerLista(route: Route): Promise<void> {
    this.consultas += 1;
    const recarregando = this.consultas > 1;
    if (recarregando) await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
    if (recarregando && this.recarga === 'com-falha') await responder(route, 500, ERRO_INTERNO);
    else await responder(route, 200, this.listaDaRecarga());
  }

  private listaDaRecarga(): unknown[] {
    return this.escrito && this.recarga === 'sem-o-fato' ? [] : [emManutencao(FATO)];
  }
}

export async function mockApi(
  page: Page,
  resposta: RespostaDaEscrita,
  recarga: Recarga = 'com-o-fato',
) {
  const api = new ApiDosFatos(resposta, recarga);
  await api.instalar(page);
  return { liberar: api.liberar, envios: api.envios };
}
