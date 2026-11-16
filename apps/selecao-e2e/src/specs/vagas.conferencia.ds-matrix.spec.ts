import { expect, test, type Page } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { ConfiguracaoDistribuicaoVagasDto } from '@uniplus/shared-data/selecao';
import { DISTRIBUICAO_DA_MEDICINA } from '../fixtures/medicina/distribuicao-da-medicina';
import { abrirVagas } from '../support/api-das-vagas';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';

/**
 * Conferência da simulação do quadro: o servidor aplica a Lei e devolve, além das quantidades, a
 * reserva legal acima do percentual, as vagas cortadas por escassez e o que o ajuste retirou do
 * quadro fixado. A tela só mostra o que o servidor informou; duas configurações de simulação
 * (com e sem conferência) provam que o aviso segue o dado e não o código da regra.
 */

const OFERTA_DA_MEDICINA = DISTRIBUICAO_DA_MEDICINA[0];

type Parcial = Partial<ConfiguracaoDistribuicaoVagasDto>;

function simulada(parcial: Parcial = {}): readonly unknown[] {
  return [
    {
      ...OFERTA_DA_MEDICINA,
      conferenciaDaReservaLegal: null,
      ajusteDoQuadroFixado: null,
      ...parcial,
    },
  ];
}

type Conferencia = NonNullable<Parcial['conferenciaDaReservaLegal']>;
type Ajuste = NonNullable<Parcial['ajusteDoQuadroFixado']>;

const RESERVA: Conferencia = {
  reservaLegalNominal: 15,
  reservaLegalEfetiva: 17,
  excedenteSobreAReservaLegal: 2,
  vagasCortadasPorEscassez: 0,
};
const ESCASSEZ: Conferencia = {
  ...RESERVA,
  reservaLegalEfetiva: 15,
  excedenteSobreAReservaLegal: 0,
  vagasCortadasPorEscassez: 2,
};
const AJUSTE: Ajuste = {
  totalDeVagasRetiradas: 3,
  vagasRetiradas: [
    { modalidadeCodigo: 'AC', quantidade: 2 },
    { modalidadeCodigo: 'LB_PPI', quantidade: 1 },
  ],
};

const RESERVA_ACIMA_DO_PERCENTUAL = simulada({ conferenciaDaReservaLegal: RESERVA });
const CORTE_POR_ESCASSEZ = simulada({ conferenciaDaReservaLegal: ESCASSEZ });
const RETIRADAS_PELO_AJUSTE = simulada({ ajusteDoQuadroFixado: AJUSTE });

const conferencia = (page: Page) => page.locator('sel-conferencia-da-simulacao');
const simular = (page: Page) => page.getByRole('button', { name: 'Simular o quadro' });

async function simularCom(
  page: Page,
  testInfo: Parameters<typeof abrirVagas>[1],
  simulacao: readonly unknown[],
): Promise<void> {
  await abrirVagas(page, testInfo, { status: 'rascunho', simulacao });
  await simular(page).click();
}

async function abrirOsAvisos(page: Page): Promise<void> {
  await conferencia(page)
    .locator('details')
    .evaluateAll((avisos) => {
      for (const aviso of avisos) (aviso as HTMLDetailsElement).open = true;
    });
}

test.describe('Vagas — conferência da simulação @ds', () => {
  test('a simulação sem conferência não abre aviso e mostra o total publicado', async ({
    page,
  }, testInfo) => {
    await simularCom(page, testInfo, simulada({ totalDeVagasDoEdital: 37 }));

    await expect(page.locator('td[data-label="Publicado"]').first()).toHaveText('37');
    await expect(conferencia(page)).toHaveCount(0);
  });

  test('avisa a reserva legal acima do percentual, com o nominal e o efetivo', async ({
    page,
  }, testInfo) => {
    await simularCom(page, testInfo, RESERVA_ACIMA_DO_PERCENTUAL);
    await abrirOsAvisos(page);

    await expect(conferencia(page)).toContainText(
      '1 oferta ficou com a reserva legal acima do percentual declarado',
    );
    await expect(conferencia(page)).toContainText('reserva legal de 15 passou a 17');
  });

  test('avisa as vagas cortadas por escassez', async ({ page }, testInfo) => {
    await simularCom(page, testInfo, CORTE_POR_ESCASSEZ);
    await abrirOsAvisos(page);

    await expect(conferencia(page)).toContainText('1 oferta ficou com vagas cortadas por escassez');
    await expect(conferencia(page)).toContainText('2 vagas cortadas por escassez');
  });

  test('avisa o que o ajuste retirou do quadro, por modalidade', async ({ page }, testInfo) => {
    await simularCom(page, testInfo, RETIRADAS_PELO_AJUSTE);
    await abrirOsAvisos(page);

    await expect(conferencia(page)).toContainText('1 oferta ficou com vagas retiradas pelo ajuste');
    await expect(conferencia(page)).toContainText('3 vagas retiradas (AC: 2; LB_PPI: 1)');
  });

  test('a região de aviso é de status para o leitor de tela', async ({ page }, testInfo) => {
    await simularCom(page, testInfo, CORTE_POR_ESCASSEZ);

    await expect(conferencia(page)).toHaveAttribute('role', 'status');
  });

  test('com todos os avisos abertos, não viola WCAG 2.1 AA nem transborda', async ({
    page,
  }, testInfo) => {
    const todos = simulada({ conferenciaDaReservaLegal: RESERVA, ajusteDoQuadroFixado: AJUSTE });
    await simularCom(page, testInfo, todos);
    await abrirOsAvisos(page);

    const violacoes = (await runAxeWcagAA(page)).violations.map((violacao) => violacao.id);
    expect(violacoes).toEqual([]);
    expect((await medirTransbordoHorizontal(page)).documento).toBeLessThanOrEqual(1);
  });
});
