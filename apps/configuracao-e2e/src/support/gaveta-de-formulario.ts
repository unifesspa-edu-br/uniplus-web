import { expect, type Locator, type Page } from '@playwright/test';

const PASSOS_DE_TAB_NO_MAXIMO = 40;

export async function rolarOCorpoAteOFim(painel: Locator): Promise<void> {
  await painel
    .locator('.uni-drawer__body')
    .evaluate((corpo) => corpo.scrollTo({ top: corpo.scrollHeight }));
}

export async function rolarOCorpoAoTopo(painel: Locator): Promise<void> {
  await painel.locator('.uni-drawer__body').evaluate((corpo) => corpo.scrollTo({ top: 0 }));
}

/** O corpo rola, o formulário não e a página não rola na horizontal. */
async function medidasDeRolagem(painel: Locator) {
  return painel.evaluate((dialogo) => {
    const corpo = dialogo.querySelector('.uni-drawer__body') as HTMLElement;
    const formulario = dialogo.querySelector('.form-drawer__form') as HTMLElement;
    return {
      corpoRola: corpo.scrollHeight > corpo.clientHeight,
      formularioRola: getComputedStyle(formulario).overflowY !== 'visible',
      paginaRolaNaHorizontal: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
}

export async function conferirQueSoOCorpoRola(painel: Locator): Promise<void> {
  expect(await medidasDeRolagem(painel)).toEqual({
    corpoRola: true,
    formularioRola: false,
    paginaRolaNaHorizontal: false,
  });
}

/** O elemento está inteiro entre o topo do corpo e o topo do rodapé: nada passa por baixo dele. */
export async function acimaDoRodape(painel: Locator, alvo: Locator): Promise<boolean> {
  const rodape = await painel.locator('.form-drawer__footer').boundingBox();
  const corpo = await painel.locator('.uni-drawer__body').boundingBox();
  const caixa = await alvo.boundingBox();
  if (rodape === null || corpo === null || caixa === null) return false;
  return caixa.y >= corpo.y - 1 && caixa.y + caixa.height <= rodape.y + 1;
}

interface MedidasDoFoco {
  readonly topo: number;
  readonly base: number;
  readonly topoDoCorpo: number;
  readonly topoDoRodape: number;
  readonly noRodape: boolean;
  readonly naAcao: boolean;
}

/** Roda dentro da página: onde está o foco em relação ao corpo e ao rodapé do painel. */
function lerOFoco(dialogo: Element, nomeDaAcao: string): MedidasDoFoco | null {
  const foco = document.activeElement;
  const corpo = dialogo.querySelector('.uni-drawer__body');
  const rodape = dialogo.querySelector('.form-drawer__footer');
  if (!foco || !corpo || !rodape || !corpo.contains(foco)) return null;
  const caixa = foco.getBoundingClientRect();
  return {
    topo: caixa.top,
    base: caixa.bottom,
    topoDoCorpo: corpo.getBoundingClientRect().top,
    topoDoRodape: rodape.getBoundingClientRect().top,
    noRodape: rodape.contains(foco),
    naAcao: foco.textContent?.trim() === nomeDaAcao,
  };
}

/** O campo focado no corpo fica entre o topo do corpo e o topo do rodapé. */
const estaEscondido = (foco: MedidasDoFoco): boolean =>
  !foco.noRodape && (foco.topo < foco.topoDoCorpo - 1 || foco.base > foco.topoDoRodape + 1);

/** Anda por Tab até a ação: nenhum campo focado no corpo fica sob o rodapé nem acima do corpo. */
export async function andarPorTabAteAAcao(
  page: Page,
  painel: Locator,
  acao: string,
): Promise<void> {
  for (let passo = 0; passo < PASSOS_DE_TAB_NO_MAXIMO; passo++) {
    await page.keyboard.press('Tab');
    const foco = await painel.evaluate(lerOFoco, acao);
    if (foco === null) continue;
    expect(estaEscondido(foco), 'o campo focado está à vista').toBe(false);
    if (foco.naAcao) return;
  }
}
