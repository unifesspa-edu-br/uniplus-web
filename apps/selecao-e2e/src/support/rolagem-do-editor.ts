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
 * (stepper ou barra de etapas) e o rodapé com os botões — e confere que a área de
 * trabalho se move em cada uma.
 */
export async function conferirRolagemPorRodaForaDoConteudo(page: Page): Promise<void> {
  const largura = page.viewportSize()?.width ?? 0;
  const regioes = [largura >= LARGURA_STEPPER_LATERAL ? '.wiz-nav' : '.step-bar', '.wiz-footer'];

  for (const regiao of regioes) {
    await voltarAoTopo(page);
    await page.locator(regiao).hover();
    await page.mouse.wheel(0, 200);
    await expect
      .poll(async () => (await medirAreaDeTrabalho(page)).topo, {
        message: `a roda sobre ${regiao} deveria rolar a área de trabalho`,
      })
      .toBeGreaterThan(0);
  }
}

/**
 * Rola só pelo teclado, sem clique prévio: o foco é o que a rota deixou ao abrir o passo.
 * Page Down, espaço e seta descem; End chega ao fim; Home volta ao topo.
 */
export async function conferirRolagemPorTeclado(page: Page): Promise<void> {
  for (const tecla of ['PageDown', 'Space', 'ArrowDown']) {
    await voltarAoTopo(page);
    await page.keyboard.press(tecla);
    await expect
      .poll(async () => (await medirAreaDeTrabalho(page)).topo, {
        message: `${tecla} deveria rolar a área de trabalho`,
      })
      .toBeGreaterThan(0);
  }

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

  await page.keyboard.press('Home');
  await expect
    .poll(async () => (await medirAreaDeTrabalho(page)).topo, {
      message: 'Home deveria voltar ao topo da área de trabalho',
    })
    .toBe(0);
}

type Faixa = 'topo' | 'base';

/**
 * Rola a área de trabalho até o campo ficar sob a faixa fixa: com o topo dele no topo da
 * área (sob a barra de etapas) ou com a base dele na base da área (sob o rodapé).
 */
async function colocarCampoSobAFaixa(
  page: Page,
  campo: ElementHandle,
  faixa: Faixa,
): Promise<void> {
  await campo.evaluate((elemento, lado) => {
    if (!(elemento instanceof Element)) {
      throw new Error('O campo não é um elemento.');
    }
    const area = elemento.closest('main.page');
    if (!area) {
      throw new Error('Campo fora da área de trabalho.');
    }
    const caixa = elemento.getBoundingClientRect();
    const vista = area.getBoundingClientRect();
    const deslocamento = lado === 'topo' ? caixa.top - vista.top : caixa.bottom - vista.bottom;
    area.scrollTo({ top: area.scrollTop + deslocamento, behavior: 'instant' });
  }, faixa);
  await esperarRolagemParar(page);
}

/**
 * Leva o foco por teclado a um campo que está sob a faixa fixa e confere que ele fica
 * inteiro fora dela. O campo é alcançado a partir do vizinho na ordem de tabulação: Tab
 * vindo de cima quando a faixa é o rodapé, Shift+Tab vindo de baixo quando é a barra.
 */
async function conferirFocoEmCampoSobAFaixa(page: Page, faixa: Faixa): Promise<void> {
  const [ida, volta] = faixa === 'topo' ? ['Tab', 'Shift+Tab'] : ['Shift+Tab', 'Tab'];
  const campo = await page.evaluateHandle((lado) => {
    const area = document.querySelector('main.page');
    if (!area) {
      throw new Error('Área de trabalho ausente.');
    }
    const vista = area.getBoundingClientRect();
    const maximo = area.scrollHeight - area.clientHeight;
    const candidatos = Array.from(
      document.querySelectorAll<HTMLElement>('.wiz-content :is(input, select, textarea)'),
    ).filter((elemento) => elemento.getClientRects().length > 0 && !elemento.matches(':disabled'));
    // O campo tem de caber na posição pedida sem passar dos limites da rolagem.
    const escolhido = candidatos.find((elemento) => {
      const caixa = elemento.getBoundingClientRect();
      const alvo =
        area.scrollTop + (lado === 'topo' ? caixa.top - vista.top : caixa.bottom - vista.bottom);
      return alvo > 0 && alvo < maximo;
    });
    if (!escolhido) {
      throw new Error('Nenhum campo do passo alcança a faixa fixa.');
    }
    return escolhido;
  }, faixa);

  await campo.evaluate((elemento) => elemento.focus({ preventScroll: true }));
  await page.keyboard.press(ida);
  await colocarCampoSobAFaixa(page, campo, faixa);
  await page.keyboard.press(volta);
  await esperarRolagemParar(page);

  expect(await campo.evaluate((elemento) => elemento === document.activeElement)).toBe(true);
  const invasao = await campo.evaluate((elemento, lado) => {
    const area = document.querySelector('main.page');
    const barra = document.querySelector('.step-bar');
    const rodape = document.querySelector('.wiz-footer');
    if (!area || !barra || !rodape) {
      throw new Error('Área de trabalho, barra de etapas ou rodapé ausente.');
    }
    const caixa = elemento.getBoundingClientRect();
    if (lado === 'topo') {
      const topoLivre = Math.max(
        area.getBoundingClientRect().top,
        barra.getBoundingClientRect().bottom,
      );
      return topoLivre - caixa.top;
    }
    return caixa.bottom - rodape.getBoundingClientRect().top;
  }, faixa);
  expect(
    invasao,
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

/**
 * Com o stepper lateral à vista (a partir de 768 px), a coluna dele, com fundo e borda
 * próprios, cobre a altura visível da área de trabalho: num passo curto ou numa tela
 * alta, terminar no meio deixaria a borda cortada no ar.
 */
export async function conferirStepperNaAlturaDaArea(page: Page): Promise<void> {
  const largura = page.viewportSize()?.width ?? 0;
  if (largura < LARGURA_STEPPER_LATERAL) {
    return;
  }
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const area = document.querySelector('main.page');
          const stepper = document.querySelector('.wiz-nav');
          if (!(area instanceof HTMLElement) || !(stepper instanceof HTMLElement)) {
            return Number.POSITIVE_INFINITY;
          }
          const topoDaArea = area.getBoundingClientRect().top + area.clientTop;
          const caixa = stepper.getBoundingClientRect();
          return Math.max(
            Math.abs(caixa.height - area.clientHeight),
            Math.abs(caixa.top - topoDaArea),
          );
        }),
      { message: 'o stepper lateral deveria cobrir a altura visível da área de trabalho' },
    )
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
