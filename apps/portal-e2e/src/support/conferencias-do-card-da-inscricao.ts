import { expect, type Locator, type Page } from '@playwright/test';

/** As partes de texto do card, na ordem em que a pessoa deve lê-las. */
const PARTES_DO_CARD = 'h2, ui-tag, p, ul.inscricao-cursos';

interface AreaVisivel {
  readonly esquerda: number;
  readonly direita: number;
}

/**
 * A largura que o contêiner de rolagem do portal mostra, sem a barra de rolagem. O contêiner
 * esconde o excesso horizontal: o que passa dela não aumenta a largura do documento, só some.
 */
async function areaVisivelDoPortal(page: Page): Promise<AreaVisivel> {
  return page.locator('.portal-scroll').evaluate((conteiner) => {
    const esquerda = conteiner.getBoundingClientRect().left + conteiner.clientLeft;
    return { esquerda, direita: esquerda + conteiner.clientWidth };
  });
}

interface MedidaDoAncestral {
  readonly nome: string;
  readonly recorta: boolean;
  readonly extravasa: boolean;
  readonly esquerda: number;
  readonly direita: number;
  readonly eRolagemDoPortal: boolean;
}

interface CaixaDoElemento {
  readonly x: number;
  readonly width: number;
}

const FOLGA = 1;

function nomeDe(elemento: Locator): Promise<string> {
  return elemento.evaluate((no) => `${no.tagName.toLowerCase()}.${no.className}`);
}

function cabeNaArea(caixa: CaixaDoElemento, area: AreaVisivel): boolean {
  return caixa.x >= area.esquerda - FOLGA && caixa.x + caixa.width <= area.direita + FOLGA;
}

async function medirAncestral(ancestral: Locator): Promise<MedidaDoAncestral> {
  return ancestral.evaluate((no) => {
    const esquerda = no.getBoundingClientRect().left + no.clientLeft;
    return {
      nome: `${no.tagName.toLowerCase()}.${no.className}`,
      recorta: getComputedStyle(no).overflowX !== 'visible',
      extravasa: no.scrollWidth > no.clientWidth + 1,
      esquerda,
      direita: esquerda + no.clientWidth,
      eRolagemDoPortal: no.classList.contains('portal-scroll'),
    };
  });
}

/**
 * Os ancestrais, até o contêiner de rolagem do portal, que recortam o excesso horizontal: o trecho
 * precisa caber na caixa de cada um, e nenhum deles pode ter conteúdo além da própria largura.
 */
async function cortesPorAncestrais(elemento: Locator, caixa: CaixaDoElemento): Promise<string[]> {
  const ancestrais = await elemento.locator('xpath=ancestor::*').all();
  const medidas = await Promise.all(ancestrais.map(medirAncestral));
  const inicio = Math.max(
    medidas.findIndex((medida) => medida.eRolagemDoPortal),
    0,
  );
  return medidas
    .slice(inicio)
    .filter((medida) => medida.recorta && (medida.extravasa || !cabeNaArea(caixa, medida)))
    .map((medida) => medida.nome);
}

async function cortesDe(elemento: Locator, area: AreaVisivel): Promise<string[]> {
  const caixa = await elemento.boundingBox();
  if (!caixa) return [];
  const nome = await nomeDe(elemento);
  const porAncestrais = await cortesPorAncestrais(elemento, caixa);
  const proprios = await elemento.evaluate((no) => no.scrollWidth > no.clientWidth + 1);
  const forasDaArea = cabeNaArea(caixa, area) ? [] : ['fora da área visível do portal'];
  return [...(proprios ? ['rolagem interna'] : []), ...forasDaArea, ...porAncestrais].map(
    (motivo) => `${nome}: ${motivo}`,
  );
}

/**
 * Nenhum texto do card fica cortado: nem por rolagem interna do próprio elemento, nem por sair da
 * largura que o contêiner de rolagem do portal mostra, nem por um ancestral que recorta o excesso.
 */
export async function conferirCardSemCorteHorizontal(page: Page, card: Locator): Promise<void> {
  const area = await areaVisivelDoPortal(page);
  const elementos = await card.locator(PARTES_DO_CARD).locator('xpath=descendant-or-self::*').all();
  const cortes = await Promise.all(elementos.map((elemento) => cortesDe(elemento, area)));
  expect(cortes.flat()).toEqual([]);
}

function normalizarEspacos(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

/**
 * As partes do card chegam ao leitor de tela, e na ordem pedida: são visíveis, nenhuma está sob
 * `aria-hidden`, e os trechos aparecem na árvore de acessibilidade na mesma ordem. A árvore não
 * traz o que o `aria-hidden` esconde, então um trecho ausente dela derruba a conferência.
 */
export async function conferirOrdemNaArvoreDeAcessibilidade(
  card: Locator,
  trechosEmOrdem: readonly string[],
): Promise<void> {
  const partes = card.locator(PARTES_DO_CARD);
  for (const parte of await partes.all()) {
    await expect(parte).toBeVisible();
  }
  await expect(partes.locator('xpath=ancestor-or-self::*[@aria-hidden="true"]')).toHaveCount(0);
  const arvore = normalizarEspacos(await card.ariaSnapshot());
  const posicoes = trechosEmOrdem.map((trecho) => arvore.indexOf(normalizarEspacos(trecho)));
  expect(posicoes).not.toContain(-1);
  expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
}
