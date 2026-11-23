import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

/** Larguras em que a grade dos eixos da exigência tem de três a cinco colunas. */
const LARGURAS_DA_GRADE_DOS_EIXOS = [1440, 1680, 1920, 2200] as const;

interface AlinhamentoMedido {
  readonly vizinhos: number;
  readonly diferencas: readonly number[];
}

/** O campo da observação da primeira norma e os campos da grade dos eixos, os das normas inclusive. */
const SELETORES_DA_MEDICAO = {
  observacao: '[id*="-doc-normas-"][id$="-obs"]',
  vizinhos:
    '.doc-item__eixos > .form-field, .doc-item__eixos sel-consequencia-e-normas .form-field',
};

/** Quantos campos dividem a linha com a observação e quanto o input de cada um desvia do dela. */
async function medirAlinhamentoDaObservacao(card: Locator): Promise<AlinhamentoMedido> {
  return card.evaluate((elemento, seletores) => {
    const topoDoInput = (campo: Element) =>
      campo.querySelector('input, select, textarea')?.getBoundingClientRect().top ?? null;
    const campo = elemento.querySelector(seletores.observacao)?.closest('.form-field') as Element;
    const linha = campo.getBoundingClientRect().top;
    const referencia = topoDoInput(campo) ?? 0;
    const vizinhos = Array.from(elemento.querySelectorAll(seletores.vizinhos))
      .filter((outro) => outro !== campo)
      .filter((outro) => Math.abs(outro.getBoundingClientRect().top - linha) <= 1)
      .map(topoDoInput)
      .filter((topo): topo is number => topo !== null);
    return { vizinhos: vizinhos.length, diferencas: vizinhos.map((topo) => topo - referencia) };
  }, SELETORES_DA_MEDICAO);
}

/** Mede em cada largura e devolve a primeira em que a observação tem vizinhos na linha. */
async function conferirAsLarguras(page: Page, card: Locator): Promise<number | null> {
  let larguraComVizinhos: number | null = null;
  for (const largura of LARGURAS_DA_GRADE_DOS_EIXOS) {
    await page.setViewportSize({ width: largura, height: 900 });
    const alinhamento = await medirAlinhamentoDaObservacao(card);
    if (alinhamento.vizinhos === 0) continue;
    larguraComVizinhos ??= largura;
    verificarAlinhamento(alinhamento, largura);
  }
  return larguraComVizinhos;
}

/** Verifica cada diferença na largura em que foi medida. */
function verificarAlinhamento(alinhamento: AlinhamentoMedido, largura: number): void {
  for (const diferenca of alinhamento.diferencas) {
    expect(
      Math.abs(diferenca),
      `o input da observação alinha com os vizinhos em ${largura} px`,
    ).toBeLessThanOrEqual(1);
  }
}

/**
 * Na grade dos eixos, a observação divide a linha com a norma, o alcance e a identificação quando
 * há colunas para os quatro: um rótulo que quebra em duas linhas desce o input em relação aos
 * vizinhos. Só o project desktop confere, e numa largura em que ela tenha vizinhos.
 */
export async function conferirAlinhamentoDaObservacao(
  page: Page,
  card: Locator,
  testInfo: TestInfo,
): Promise<void> {
  if (testInfo.project.metadata['viewport'] !== 'desktop') return;
  const original = page.viewportSize();
  const larguraComVizinhos = await conferirAsLarguras(page, card);
  if (original) await page.setViewportSize(original);

  expect(
    larguraComVizinhos,
    `a observação divide a linha com outros campos em alguma de ${LARGURAS_DA_GRADE_DOS_EIXOS.join(', ')} px`,
  ).not.toBeNull();
}
