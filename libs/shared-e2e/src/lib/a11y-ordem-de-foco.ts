import { expect, type Locator, type Page } from '@playwright/test';

const ATRIBUTO_DA_ORDEM = 'data-ordem-de-foco';
const SELETOR_DOS_ALVOS = 'a[href], button, input, select, textarea, summary, [tabindex]';
const TOLERANCIA_EM_PX = 2;

interface ParametrosDaNumeracao {
  readonly seletor: string;
  readonly atributo: string;
}

/**
 * Numera, na ordem do documento, os controles da seção que o Tab alcança e devolve a altura de cada
 * um na tela. Roda no navegador: não pode usar nada de fora dela.
 */
function numerarOsAlvos(raiz: Element, { seletor, atributo }: ParametrosDaNumeracao): number[] {
  const alvos = Array.from(raiz.querySelectorAll<HTMLElement>(seletor)).filter(
    (alvo) =>
      alvo.tabIndex >= 0 &&
      !alvo.matches(':disabled') &&
      alvo.getClientRects().length > 0 &&
      getComputedStyle(alvo).visibility !== 'hidden',
  );
  alvos.forEach((alvo, ordem) => alvo.setAttribute(atributo, String(ordem)));
  return alvos.map((alvo) => alvo.getBoundingClientRect().top);
}

async function ordemDoFocoAtual(page: Page): Promise<number> {
  const ordem = await page.evaluate(
    (atributo) => document.activeElement?.getAttribute(atributo) ?? null,
    ATRIBUTO_DA_ORDEM,
  );
  return ordem === null ? -1 : Number(ordem);
}

async function tabularPelosAlvos(page: Page, quantidade: number): Promise<number[]> {
  const percorridos: number[] = [];
  for (let passo = 1; passo < quantidade; passo++) {
    await page.keyboard.press('Tab');
    percorridos.push(await ordemDoFocoAtual(page));
  }
  return percorridos;
}

function posicoesQueSobem(topos: readonly number[]): number[] {
  return topos.flatMap((topo, posicao) =>
    posicao > 0 && topo < topos[posicao - 1] - TOLERANCIA_EM_PX ? [posicao] : [],
  );
}

/**
 * A ordem do foco é a ordem em que a seção é lida (WCAG 2.4.3): o Tab percorre cada controle
 * dela na ordem do documento, e nenhum controle aparece na tela acima do anterior. A seção não
 * pode ter grupo de botões de opção, que o Tab visita uma vez só.
 */
export async function assertOrdemDeFocoSegueOLeiaute(secao: Locator, page: Page): Promise<void> {
  const topos = await secao.evaluate(numerarOsAlvos, {
    seletor: SELETOR_DOS_ALVOS,
    atributo: ATRIBUTO_DA_ORDEM,
  });
  expect(topos.length, 'a seção tem controles que o Tab alcança').toBeGreaterThan(1);
  expect(posicoesQueSobem(topos), 'controles acima do anterior na tela').toEqual([]);

  await secao.locator(`[${ATRIBUTO_DA_ORDEM}="0"]`).focus();
  const esperados = topos.slice(1).map((_topo, indice) => indice + 1);
  expect(await tabularPelosAlvos(page, topos.length)).toEqual(esperados);
}
