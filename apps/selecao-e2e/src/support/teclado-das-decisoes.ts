import { type Locator, type Page } from '@playwright/test';
import { GRUPO_DA_ETAPA, GRUPO_DA_FASE, grupoDaEtapa, grupoDaFase } from './passo-das-decisoes';

/** Onde as caixas dos tipos de decisão aparecem: o grupo e o botão de onde o Tab parte até ele. */
export interface EscopoDasDecisoes {
  readonly nome: string;
  readonly titulo: string;
  readonly grupo: (page: Page) => Locator;
  readonly partida: (page: Page) => Locator;
}

export const ESCOPOS_DAS_DECISOES: readonly EscopoDasDecisoes[] = [
  {
    nome: 'fase',
    titulo: GRUPO_DA_FASE,
    grupo: grupoDaFase,
    partida: (page) => page.locator('.fase-alternar').first(),
  },
  {
    nome: 'etapa',
    titulo: GRUPO_DA_ETAPA,
    grupo: grupoDaEtapa,
    partida: (page) => page.locator('.etapa-resumo').first(),
  },
];

const LIMITE_DE_TABS_ATE_A_PRIMEIRA_CAIXA = 150;

export async function idDoFoco(page: Page): Promise<string> {
  return page.evaluate(() => document.activeElement?.id ?? '');
}

export async function idsDasCaixas(grupo: Locator): Promise<string[]> {
  return grupo.getByRole('checkbox').evaluateAll((caixas) => caixas.map((caixa) => caixa.id));
}

/** Tab a partir de um elemento fixo, até o foco chegar à primeira caixa do grupo. */
export async function tabularAteAPrimeiraCaixa(
  page: Page,
  escopo: EscopoDasDecisoes,
): Promise<string[]> {
  const ids = await idsDasCaixas(escopo.grupo(page));
  await escopo.partida(page).focus();
  for (let tabs = 0; tabs < LIMITE_DE_TABS_ATE_A_PRIMEIRA_CAIXA; tabs++) {
    await page.keyboard.press('Tab');
    if ((await idDoFoco(page)) === ids[0]) return ids;
  }
  throw new Error(`O Tab não chegou à primeira caixa do grupo da ${escopo.nome}.`);
}

/** A marca de foco é desenhada na caixa visível, irmã do controle nativo. */
export async function sombraDaCaixa(page: Page, idDoControle: string): Promise<string> {
  return page.evaluate((id) => {
    const caixa = document.getElementById(id)?.parentElement?.querySelector('.checkbox__box');
    return caixa ? getComputedStyle(caixa).boxShadow : '';
  }, idDoControle);
}

export async function textosCortados(grupo: Locator): Promise<string[]> {
  return grupo
    .locator('legend, label.checkbox')
    .evaluateAll((elementos) =>
      elementos
        .filter((elemento) => elemento.scrollWidth > elemento.clientWidth + 1)
        .map((elemento) => elemento.textContent?.trim() ?? ''),
    );
}
