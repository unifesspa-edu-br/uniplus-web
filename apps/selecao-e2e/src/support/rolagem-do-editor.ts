import { expect, type ElementHandle, type Page } from '@playwright/test';

/**
 * Altura de janela em que o passo aberto pelos testes passa da área de trabalho em qualquer
 * largura da matriz, sem o que a verificação passaria em vão. Não pode ser menor: abaixo
 * dela o stepper lateral deixa de caber, ganha rolagem própria e a roda sobre ele move o
 * stepper, não a área de trabalho.
 */
const ALTURA_COM_ROLAGEM = 640;

/** Abaixo desta largura o stepper lateral dá lugar à barra de etapas. */
const LARGURA_STEPPER_LATERAL = 768;

interface MedidaDaAreaDeTrabalho {
  readonly topo: number;
  readonly maximo: number;
}

/**
 * Pelo contrato do shell do DS, quem rola é a área de trabalho (`main.page`), nunca o
 * documento: a roda e o teclado têm de movê-la estando o cursor ou o foco em qualquer
 * ponto do editor.
 */
async function medirAreaDeTrabalho(page: Page): Promise<MedidaDaAreaDeTrabalho> {
  return page.locator('main.page').evaluate((area) => ({
    topo: area.scrollTop,
    maximo: area.scrollHeight - area.clientHeight,
  }));
}

/**
 * A rolagem do teclado e da roda é animada, e um salto no meio da animação pode ser
 * desfeito por ela. Duas leituras iguais seguidas indicam que a área parou.
 */
async function esperarRolagemParar(page: Page): Promise<void> {
  let anterior = Number.NaN;
  await expect
    .poll(
      async () => {
        const atual = (await medirAreaDeTrabalho(page)).topo;
        const parada = atual === anterior;
        anterior = atual;
        return parada;
      },
      { intervals: [100] },
    )
    .toBe(true);
}

async function voltarAoTopo(page: Page): Promise<void> {
  await esperarRolagemParar(page);
  await page
    .locator('main.page')
    .evaluate((area) => area.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(async () => (await medirAreaDeTrabalho(page)).topo).toBe(0);
}

/**
 * Encurta a janela mantendo a largura do project e espera o layout assentar: logo depois
 * do redimensionamento a área de trabalho ainda tem a altura antiga.
 */
export async function encurtarJanela(page: Page): Promise<void> {
  const largura = page.viewportSize()?.width;
  if (largura === undefined) {
    throw new Error('O project não declara viewport.');
  }
  await page.setViewportSize({ width: largura, height: ALTURA_COM_ROLAGEM });
  await expect
    .poll(async () => (await medirAreaDeTrabalho(page)).maximo, {
      message: 'o passo precisa passar da área de trabalho para haver o que rolar',
    })
    .toBeGreaterThan(0);
}

/**
 * Rola com a roda sobre as regiões fora do conteúdo do passo — a navegação entre passos
 * (stepper ou barra de etapas) e o rodapé com os botões — e confere o que se move em cada
 * uma. Quando o stepper não cabe na janela ele rola por conta própria: a roda então move o
 * stepper, e o que se confere é que o último passo se torna alcançável.
 */
export async function conferirRolagemPorRodaForaDoConteudo(page: Page): Promise<void> {
  const largura = page.viewportSize()?.width ?? 0;
  const regioes = [
    largura >= LARGURA_STEPPER_LATERAL ? 'nav[aria-label="Etapas do cadastro"]' : '.step-bar',
    '.wiz-footer',
  ];

  for (const regiao of regioes) {
    await conferirRodaSobre(page, regiao);
  }
}

async function conferirRodaSobre(page: Page, regiao: string): Promise<void> {
  await voltarAoTopo(page);
  const regiaoRola = await rolaPorConta(page, regiao);
  await page.locator(regiao).hover();
  await page.mouse.wheel(0, 200);
  if (regiaoRola) {
    await conferirUltimoPassoAlcancavel(page, regiao);
    return;
  }
  await expect
    .poll(async () => (await medirAreaDeTrabalho(page)).topo, {
      message: `a roda sobre ${regiao} deveria rolar a área de trabalho`,
    })
    .toBeGreaterThan(0);
}

async function rolaPorConta(page: Page, seletor: string): Promise<boolean> {
  return page
    .locator(seletor)
    .evaluate(
      (regiao) =>
        regiao.scrollHeight > regiao.clientHeight &&
        getComputedStyle(regiao).overflowY !== 'visible',
    );
}

/**
 * A roda sobre um stepper que rola por conta própria o leva até o fim, e o foco no último
 * passo o deixa visível dentro da região e da janela.
 */
async function conferirUltimoPassoAlcancavel(page: Page, seletor: string): Promise<void> {
  const regiao = page.locator(seletor);
  await expect
    .poll(async () => regiao.evaluate((r) => r.scrollTop), {
      message: `a roda sobre ${seletor} deveria rolar o próprio stepper`,
    })
    .toBeGreaterThan(0);
  const ultimo = regiao.getByRole('button').last();
  await ultimo.focus();
  await expect(ultimo).toBeInViewport({ ratio: 1 });
}

/**
 * Rola só pelo teclado, sem clique prévio: o foco é o que a rota deixou ao abrir o passo.
 * Page Down, espaço e seta descem; End chega ao fim; Home volta ao topo.
 */
export async function conferirRolagemPorTeclado(page: Page): Promise<void> {
  for (const tecla of ['PageDown', 'Space', 'ArrowDown']) {
    await conferirDescidaPelaTecla(page, tecla);
  }
  await conferirChegadaAoFimPelaTeclaEnd(page);
  await conferirVoltaAoTopoPelaTeclaHome(page);
}

async function conferirDescidaPelaTecla(page: Page, tecla: string): Promise<void> {
  await voltarAoTopo(page);
  await page.keyboard.press(tecla);
  await expect
    .poll(async () => (await medirAreaDeTrabalho(page)).topo, {
      message: `${tecla} deveria rolar a área de trabalho`,
    })
    .toBeGreaterThan(0);
}

async function conferirChegadaAoFimPelaTeclaEnd(page: Page): Promise<void> {
  await voltarAoTopo(page);
  await page.keyboard.press('End');
  await expect
    .poll(
      async () => {
        const { topo, maximo } = await medirAreaDeTrabalho(page);
        return maximo - topo;
      },
      { message: 'End deveria levar ao fim da área de trabalho' },
    )
    .toBeLessThanOrEqual(1);
}

async function conferirVoltaAoTopoPelaTeclaHome(page: Page): Promise<void> {
  // Chegar a um pixel do fim não encerra a animação do End; o Home dado no meio dela é desfeito.
  await esperarRolagemParar(page);
  await page.keyboard.press('Home');
  await expect
    .poll(async () => (await medirAreaDeTrabalho(page)).topo, {
      message: 'Home deveria voltar ao topo da área de trabalho',
    })
    .toBe(0);
}

type Faixa = 'topo' | 'base';

type CampoDoPasso = ElementHandle<HTMLElement | SVGElement>;

/**
 * Quanto a área de trabalho precisa rolar para o campo ficar sob a faixa fixa: com o topo dele
 * no topo da área (sob a barra de etapas) ou com a base dele na base da área (sob o rodapé).
 */
async function deslocamentoAteAFaixa(campo: CampoDoPasso, faixa: Faixa): Promise<number> {
  return campo.evaluate((elemento, lado) => {
    const area = elemento.closest('main.page');
    if (!area) {
      throw new Error('Campo fora da área de trabalho.');
    }
    const caixa = elemento.getBoundingClientRect();
    const vista = area.getBoundingClientRect();
    return lado === 'topo' ? caixa.top - vista.top : caixa.bottom - vista.bottom;
  }, faixa);
}

async function colocarCampoSobAFaixa(page: Page, campo: CampoDoPasso, faixa: Faixa): Promise<void> {
  const deslocamento = await deslocamentoAteAFaixa(campo, faixa);
  await page
    .locator('main.page')
    .evaluate(
      (area, quanto) => area.scrollTo({ top: area.scrollTop + quanto, behavior: 'instant' }),
      deslocamento,
    );
  await esperarRolagemParar(page);
}

async function temCaixaNaTela(campo: CampoDoPasso): Promise<boolean> {
  return campo.evaluate((elemento) => elemento.getClientRects().length > 0);
}

/**
 * O primeiro campo habilitado do passo que cabe na posição pedida sem passar dos limites da
 * rolagem: só assim a faixa fixa chega a ficar sobre ele.
 */
async function escolherCampoQueAlcancaAFaixa(page: Page, faixa: Faixa): Promise<CampoDoPasso> {
  const { topo, maximo } = await medirAreaDeTrabalho(page);
  const campos = await page.$$('.wiz-content :is(input, select, textarea):not(:disabled)');
  for (const campo of campos) {
    if (!(await temCaixaNaTela(campo))) continue;
    const alvo = topo + (await deslocamentoAteAFaixa(campo, faixa));
    if (alvo > 0 && alvo < maximo) return campo;
  }
  throw new Error('Nenhum campo do passo alcança a faixa fixa.');
}

/**
 * Quanto o campo invade o rodapé: positivo quando a base dele passa do topo do rodapé.
 */
async function invasaoDoRodape(campo: CampoDoPasso): Promise<number> {
  return campo.evaluate((elemento) => {
    const rodape = document.querySelector('.wiz-footer');
    if (!rodape) {
      throw new Error('Rodapé ausente.');
    }
    return elemento.getBoundingClientRect().bottom - rodape.getBoundingClientRect().top;
  });
}

/**
 * Quanto o campo invade a barra de etapas. A barra visível fica presa ao topo da área rolada:
 * fora dele, ela deixou de ser fixa.
 */
async function invasaoDaBarraDeEtapas(campo: CampoDoPasso): Promise<number> {
  return campo.evaluate((elemento) => {
    const area = document.querySelector('main.page');
    const barra = document.querySelector('.step-bar');
    if (!area || !barra) {
      throw new Error('Área de trabalho ou barra de etapas ausente.');
    }
    const topoDaArea = area.getBoundingClientRect().top;
    const caixaDaBarra = barra.getBoundingClientRect();
    if (caixaDaBarra.height > 0 && Math.abs(caixaDaBarra.top - topoDaArea) > 1) {
      throw new Error('A barra de etapas saiu do topo da área de trabalho.');
    }
    return Math.max(topoDaArea, caixaDaBarra.bottom) - elemento.getBoundingClientRect().top;
  });
}

/**
 * Leva o foco por teclado ao campo que está sob a faixa fixa. O campo é alcançado a partir do
 * vizinho na ordem de tabulação: Tab vindo de cima quando a faixa é o rodapé, Shift+Tab vindo
 * de baixo quando é a barra.
 */
async function focarCampoSobAFaixa(page: Page, campo: CampoDoPasso, faixa: Faixa): Promise<void> {
  const [ida, volta] = faixa === 'topo' ? ['Tab', 'Shift+Tab'] : ['Shift+Tab', 'Tab'];
  await campo.evaluate((elemento) => elemento.focus({ preventScroll: true }));
  await page.keyboard.press(ida);
  await colocarCampoSobAFaixa(page, campo, faixa);
  await page.keyboard.press(volta);
  await esperarRolagemParar(page);
}

async function invasaoDaFaixa(campo: CampoDoPasso, faixa: Faixa): Promise<number> {
  return faixa === 'topo' ? invasaoDaBarraDeEtapas(campo) : invasaoDoRodape(campo);
}

/** Confere que o campo focado por teclado fica inteiro fora da faixa fixa. */
async function conferirFocoEmCampoSobAFaixa(page: Page, faixa: Faixa): Promise<void> {
  const campo = await escolherCampoQueAlcancaAFaixa(page, faixa);
  await focarCampoSobAFaixa(page, campo, faixa);

  expect(await campo.evaluate((elemento) => elemento === document.activeElement)).toBe(true);
  expect(
    await invasaoDaFaixa(campo, faixa),
    faixa === 'topo' ? 'campo focado sob a barra de etapas' : 'campo focado sob o rodapé',
  ).toBeLessThanOrEqual(0.5);
}

/**
 * O campo que recebe foco por teclado fica inteiro fora das faixas fixas por cima do
 * passo: o rodapé e, no celular, a barra de etapas (WCAG 2.4.11, foco não encoberto).
 */
export async function conferirFocoForaDasFaixasFixas(page: Page): Promise<void> {
  await conferirFocoEmCampoSobAFaixa(page, 'base');
  await conferirFocoEmCampoSobAFaixa(page, 'topo');
}

/** Deixa a área de trabalho no meio, onde o rodapé e a navegação fixos se sobrepõem ao passo. */
export async function rolarAteOMeio(page: Page): Promise<void> {
  await page
    .locator('main.page')
    .evaluate((area) => area.scrollTo({ top: (area.scrollHeight - area.clientHeight) / 2 }));
}

/** Abaixo de 768 px não há stepper lateral: a barra de etapas abre a lista das etapas. */
async function conferirBarraDeEtapasNoLugarDoStepper(page: Page): Promise<void> {
  await expect(page.locator('nav[aria-label="Etapas do cadastro"]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Abrir lista de etapas' })).toBeVisible();
}

/**
 * Maior diferença, em px, entre a coluna do stepper lateral e a altura visível da área de
 * trabalho, no topo ou na altura; infinita quando um dos dois não está na tela.
 */
async function diferencaDoStepperParaAArea(page: Page): Promise<number> {
  return page.evaluate(() => {
    const area = document.querySelector('main.page');
    const stepper = document.querySelector('nav[aria-label="Etapas do cadastro"]');
    if (!(area instanceof HTMLElement) || !(stepper instanceof HTMLElement)) {
      return Number.POSITIVE_INFINITY;
    }
    const topoDaArea = area.getBoundingClientRect().top + area.clientTop;
    const caixa = stepper.getBoundingClientRect();
    return Math.max(Math.abs(caixa.height - area.clientHeight), Math.abs(caixa.top - topoDaArea));
  });
}

/**
 * Com o stepper lateral à vista (a partir de 768 px), a coluna dele, com fundo e borda
 * próprios, cobre a altura visível da área de trabalho: num passo curto ou numa tela
 * alta, terminar no meio deixaria a borda cortada no ar.
 */
export async function conferirStepperNaAlturaDaArea(page: Page): Promise<void> {
  const largura = page.viewportSize()?.width ?? 0;
  if (largura < LARGURA_STEPPER_LATERAL) {
    await conferirBarraDeEtapasNoLugarDoStepper(page);
    return;
  }
  await expect
    .poll(() => diferencaDoStepperParaAArea(page), {
      message: 'o stepper lateral deveria cobrir a altura visível da área de trabalho',
    })
    .toBeLessThanOrEqual(1);
}

/** Transbordo horizontal do documento e da área de trabalho, em px. */
export async function medirTransbordoHorizontal(
  page: Page,
): Promise<{ documento: number; areaDeTrabalho: number }> {
  return page.evaluate(() => {
    const documento = document.documentElement;
    const area = document.querySelector('main.page');
    return {
      documento: documento.scrollWidth - documento.clientWidth,
      areaDeTrabalho: area instanceof HTMLElement ? area.scrollWidth - area.clientWidth : 0,
    };
  });
}
