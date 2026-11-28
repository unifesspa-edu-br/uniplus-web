import { expect, type Page, type TestInfo } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { mockarVocabularioDeTiposDeDecisao } from './api-do-vocabulario-de-tipos-de-decisao';
import { responder, responderPreflight } from './escritas-retidas';
import { TODAS_AS_PERMISSOES_DA_CONFIGURACAO } from './permissoes';
import { mockConfiguracaoRuntimeConfig } from './runtime-config';
import { prepararTema } from './avisos-no-painel-de-motivos';

/**
 * Apoio do spec de geometria da pilha de avisos de erro que não somem sozinhos. A lista de motivos
 * de decisão responde erro de servidor a cada leitura: cada "Tentar novamente" gera um aviso fixo.
 */

const PERMISSAO_DE_MANTER_MOTIVOS = 'selecao:motivos-de-decisao:manter';

/** Quatro códigos de erro distintos: avisos de códigos diferentes não se agrupam. */
const CODIGOS_DE_ERRO = [
  'uniplus.selecao.motivo_de_decisao.indisponivel',
  'uniplus.selecao.motivo_de_decisao.sobrecarregado',
  'uniplus.selecao.motivo_de_decisao.em_manutencao',
  'uniplus.selecao.motivo_de_decisao.sem_resposta',
] as const;

export const TOTAL_DE_DISPAROS = 20;
export const TOTAL_DE_AVISOS_DISTINTOS = CODIGOS_DE_ERRO.length;
export const DISPAROS_POR_CODIGO = TOTAL_DE_DISPAROS / CODIGOS_DE_ERRO.length;

export interface Janela {
  readonly nome: string;
  readonly width: number;
  readonly height: number;
}

export interface ListaQueFalha {
  /** Quantas leituras da lista a tela já fez. */
  readonly pedidos: () => number;
}

/** Identificador do pedido no formato da API (32 hexadecimais), diferente a cada leitura. */
function identificadorDoPedido(numero: number): string {
  return (0xabc000 + numero * 7919).toString(16).padStart(32, 'e');
}

function erroDaLeitura(numero: number): unknown {
  return {
    type: 'about:blank',
    title: 'Erro interno',
    detail: 'O serviço de motivos não respondeu a esta leitura. Tente de novo em alguns instantes.',
    status: 503,
    code: CODIGOS_DE_ERRO[numero % CODIGOS_DE_ERRO.length],
    traceId: identificadorDoPedido(numero),
  };
}

async function simularALista(page: Page): Promise<ListaQueFalha> {
  let pedidos = 0;
  await mockPermissoesEfetivas(page, [
    ...TODAS_AS_PERMISSOES_DA_CONFIGURACAO,
    PERMISSAO_DE_MANTER_MOTIVOS,
  ]);
  await mockarVocabularioDeTiposDeDecisao(page);
  await page.route(/\/api\/selecao\/motivos-de-decisao(\?.*)?$/, (route) => {
    if (route.request().method() === 'OPTIONS') return responderPreflight(route);
    pedidos += 1;
    return responder(route, { status: 503, corpo: erroDaLeitura(pedidos) });
  });
  return { pedidos: () => pedidos };
}

/** Abre a tela na janela dada; a primeira leitura já falha e gera o primeiro aviso. */
export async function abrirListaQueFalha(
  page: Page,
  testInfo: TestInfo,
  janela: Janela,
): Promise<ListaQueFalha> {
  await page.setViewportSize({ width: janela.width, height: janela.height });
  await mockConfiguracaoRuntimeConfig(page);
  await prepararTema(page, testInfo);
  const lista = await simularALista(page);
  await page.goto('/motivos-de-decisao');
  await expect.poll(lista.pedidos).toBe(1);
  return lista;
}

async function pedirOutraVez(page: Page, lista: ListaQueFalha, esperado: number): Promise<void> {
  const tentar = page.getByRole('button', { name: 'Tentar novamente' });
  await expect(tentar).toBeEnabled();
  await tentar.focus();
  await page.keyboard.press('Enter');
  await expect.poll(lista.pedidos).toBe(esperado);
}

/**
 * Leva a lista a `total` leituras com erro, cada uma pelo teclado no "Tentar novamente".
 * `depoisDeCada` roda após cada aviso novo (inclusive o primeiro), com o número da leitura.
 */
export async function dispararAvisos(
  page: Page,
  lista: ListaQueFalha,
  total: number,
  depoisDeCada: (leitura: number) => Promise<void> = () => Promise.resolve(),
): Promise<void> {
  await depoisDeCada(1);
  for (let leitura = 2; leitura <= total; leitura += 1) {
    await pedirOutraVez(page, lista, leitura);
    await depoisDeCada(leitura);
  }
}
