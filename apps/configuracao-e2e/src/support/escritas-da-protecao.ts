import { expect, type Locator, type Page, type Route } from '@playwright/test';
import { mockManifestacoesDaFila } from './listas-de-tipos-e-fatos';

/** Os dados, a API simulada e os passos das decisões da proteção de dados dos tipos e fatos. */

export const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

export const ITEM = {
  tipo: 'TIPO_DOCUMENTO',
  id: '01960000-0000-7000-0000-0000000000d2',
  codigo: 'LAUDO_MEDICO_COMPLEMENTAR',
  nome: 'Laudo médico complementar',
  classificacaoProtecao: 'INTERNO',
  finalidadeTratamento: 'Conferir o laudo do candidato com deficiência.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  aprovacao: {
    situacao: 'SOLICITADA',
    solicitadaEm: '2026-11-01T12:00:00Z',
    decididaEm: null,
    classificacaoRecomendada: null,
    justificativa: null,
    aceitaEm: null,
    ciclo: 1,
    manifestadaEm: null,
    manifestacaoDesfavoravel: false,
    manifestacoesNoCiclo: 0,
  },
};

export const DETALHE = {
  ...ITEM,
  descricao: 'Laudo que complementa o pedido de atendimento especializado.',
  fato: null,
  tipoDocumento: { categoria: 'SAUDE', formatosAceitos: 'pdf,jpg', tamanhoMaximoMb: 10 },
  atos: [],
  manifestacoesVigentes: [],
};

export const DECISAO = {
  cadastro: 'TIPO_DOCUMENTO',
  itemId: ITEM.id,
  itemCodigo: ITEM.codigo,
  itemNome: ITEM.nome,
  ato: 'REPROVACAO',
  instante: '2026-10-31T13:00:00Z',
  atorNome: 'Caroline Ribeiro',
  classificacaoProtecao: 'INTERNO',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Conferir o laudo.',
  classificacaoRecomendada: null,
  justificativa: 'Falta a base legal.',
};

/** Atraso da recarga da fila após a decisão: o drawer já fechou quando ela termina. */
export const ATRASO_DA_RECARGA_EM_MS = 1500;

export const problema = (status: number, code: string, title: string) => ({
  type: 'about:blank',
  title,
  status,
  code,
});
export const ERRO_INTERNO = problema(500, 'uniplus.internal.unexpected', 'Erro interno');
export const CONCORRENCIA = problema(
  409,
  'uniplus.configuracao.protecao_do_catalogo.protecao_mudou',
  'A proteção do item mudou desde a leitura',
);
export const EM_PROCESSAMENTO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A decisão ainda está em processamento',
);
export const SEM_QUEM_APROVE = problema(
  422,
  'uniplus.configuracao.protecao_do_catalogo.sem_quem_aprove',
  'Ninguém tem a permissão de aprovar',
);

export type Recarga = 'sem-o-item' | 'com-o-item' | 'com-falha';
export type Resposta = { status: number; corpo?: unknown };
export type Leitura = 'ok' | 'falha-na-primeira';

export interface Opcoes {
  readonly decisoes: readonly Resposta[];
  readonly recarga?: Recarga;
  readonly fila?: Leitura;
  readonly detalhe?: Leitura;
}

export function retida(): { espera: Promise<void>; liberar: () => void } {
  let liberar: () => void = () => undefined;
  const espera = new Promise<void>((resolve) => (liberar = resolve));
  return { espera, liberar };
}

export async function responder(route: Route, status: number, corpo?: unknown): Promise<void> {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    ...(corpo === undefined
      ? {}
      : {
          contentType: status >= 400 ? 'application/problem+json' : 'application/json',
          body: JSON.stringify(corpo),
        }),
  });
}

const ESPERAR_A_RECARGA = () =>
  new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));

/**
 * A API simulada das decisões. Cada POST consome a próxima resposta e fica retido até `liberar`; as
 * leituras da fila que o seguem demoram `ATRASO_DA_RECARGA_EM_MS` e respondem conforme `recarga`.
 */
class ApiDasDecisoes {
  private readonly portoes: { espera: Promise<void>; liberar: () => void }[];
  readonly chaves: (string | undefined)[] = [];
  private leiturasDaFila = 0;
  private leiturasDoDetalhe = 0;

  constructor(private readonly opcoes: Opcoes) {
    this.portoes = opcoes.decisoes.map(() => retida());
  }

  async instalar(page: Page): Promise<void> {
    await mockManifestacoesDaFila(page);
    await page.route(/\/api\/configuracao\/categorias-documento(\?.*)?$/, (r) =>
      responder(r, 200, []),
    );
    await page.route(
      /\/api\/configuracao\/admin\/protecao-do-catalogo\/tipos-documento\/[^/?]+$/,
      (r) => this.lerDetalhe(r),
    );
    await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo(\?.*)?$/, (r) =>
      this.atenderFila(r),
    );
  }

  liberar(indice: number): void {
    this.portoes[indice].liberar();
  }

  private async lerDetalhe(route: Route): Promise<void> {
    this.leiturasDoDetalhe += 1;
    if (this.opcoes.detalhe === 'falha-na-primeira' && this.leiturasDoDetalhe === 1) {
      await responder(route, 500, ERRO_INTERNO);
      return;
    }
    if (this.leiturasDoDetalhe > 1) await ESPERAR_A_RECARGA();
    await responder(route, 200, DETALHE);
  }

  private async atenderFila(route: Route): Promise<void> {
    const metodo = route.request().method();
    if (metodo === 'OPTIONS') await route.fulfill({ status: 204, headers: CORS_HEADERS });
    else if (metodo === 'POST') await this.gravarDecisao(route);
    else await this.lerFila(route);
  }

  private async gravarDecisao(route: Route): Promise<void> {
    const indice = this.chaves.length;
    this.chaves.push(route.request().headers()['idempotency-key']);
    await this.portoes[indice].espera;
    const { status, corpo } = this.opcoes.decisoes[indice];
    await responder(route, status, corpo);
  }

  private async lerFila(route: Route): Promise<void> {
    this.leiturasDaFila += 1;
    const relida = this.leiturasDaFila > 1;
    const { fila = 'ok', recarga = 'sem-o-item' } = this.opcoes;
    if (fila === 'falha-na-primeira' && !relida) return responder(route, 500, ERRO_INTERNO);
    if (relida) await ESPERAR_A_RECARGA();
    if (relida && recarga === 'com-falha') return responder(route, 500, ERRO_INTERNO);
    await responder(route, 200, relida && recarga === 'sem-o-item' ? [] : [ITEM]);
  }
}

/** Instala a API simulada das decisões e devolve as chaves recebidas e o controle das respostas. */
export async function mockApi(page: Page, opcoes: Opcoes) {
  const api = new ApiDasDecisoes(opcoes);
  await api.instalar(page);
  return { chaves: () => api.chaves, liberar: (indice = 0) => api.liberar(indice) };
}

export const titulo = (page: Page) =>
  page.getByRole('heading', { name: 'Itens aguardando a sua decisão', level: 2 });
export const linha = (page: Page) =>
  page.getByRole('button', { name: `Ver o detalhe de ${ITEM.nome}` });
export const painel = (page: Page) =>
  page.getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' });
export const dialogoDeReprovacao = (page: Page) =>
  page.getByRole('dialog', { name: 'Reprovar a proteção de dados do item' });

export async function abrirItem(page: Page): Promise<{ drawer: Locator; aprovar: Locator }> {
  await page.goto('/protecao-do-catalogo');
  await linha(page).click();
  const drawer = painel(page);
  const aprovar = drawer.getByRole('button', { name: /Aprovar/ });
  await expect(aprovar).toBeVisible();
  return { drawer, aprovar };
}

/** A aprovação passa pelo diálogo, que aceita a justificativa opcional (UNI-REQ-0374). */
export async function abrirAprovacao(
  page: Page,
): Promise<{ drawer: Locator; dialogo: Locator; aprovar: Locator }> {
  const { drawer, aprovar: noDrawer } = await abrirItem(page);
  await noDrawer.click();
  const dialogo = page.getByRole('dialog', { name: 'Aprovar a proteção de dados do item' });
  const aprovar = dialogo.getByRole('button', { name: 'Aprovar item' });
  await expect(aprovar).toBeVisible();
  return { drawer, dialogo, aprovar };
}

export async function abrirReprovacao(page: Page, justificativa: string | null) {
  const { drawer } = await abrirItem(page);
  await drawer.getByRole('button', { name: 'Reprovar' }).click();
  const dialogo = dialogoDeReprovacao(page);
  const campo = dialogo.getByRole('textbox', { name: /Justificativa/ });
  if (justificativa !== null) await campo.fill(justificativa);
  const confirmar = dialogo.locator('.uni-dialog__footer .btn--danger');
  return { drawer, dialogo, campo, confirmar };
}
