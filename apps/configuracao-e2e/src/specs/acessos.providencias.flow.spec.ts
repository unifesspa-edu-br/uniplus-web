import { expect, test, type Page } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import {
  CONCESSAO_ID,
  CONFLITO_RETENTAVEL,
  PROVIDENCIA_ID,
  mockProvidencias,
  providencia,
  type CenarioDasProvidencias,
} from '../support/api-de-providencias';
import {
  PERMISSOES_DO_DIOGO_ADMINISTRA_CONCESSOES,
  PERMISSOES_DO_KEVIN_SOLICITA_PROVIDENCIA,
} from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const DETALHE = `/acessos/providencias/${PROVIDENCIA_ID}`;

async function abrir(
  page: Page,
  permissoes: readonly string[],
  rota: string,
  cenario: CenarioDasProvidencias = {},
) {
  await mockConfiguracaoRuntimeConfig(page);
  await mockPermissoesEfetivas(page, permissoes);
  const escritas = await mockProvidencias(page, cenario);
  await page.goto(rota);
  return escritas;
}

async function semViolacoes(page: Page): Promise<void> {
  const { violations } = await runAxeWcagAA(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test.describe('Acessos — providências sobre concessões', () => {
  test('o Encarregado de dados solicita a retirada na concessão e vai ao detalhe da providência', async ({
    page,
  }) => {
    await abrir(
      page,
      PERMISSOES_DO_KEVIN_SOLICITA_PROVIDENCIA,
      `/acessos/concessoes/${CONCESSAO_ID}`,
      {
        escritas: [{ status: 201, corpo: providencia() }],
      },
    );
    await page.getByRole('button', { name: 'Solicitar providência' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Solicitar providência sobre a concessão' });

    await dialogo
      .locator('label.radio')
      .filter({ has: page.getByRole('radio', { name: 'Retirada do acesso', exact: true }) })
      .click();
    await dialogo.getByRole('textbox', { name: 'Fundamento' }).fill('curto');
    await dialogo.getByRole('button', { name: 'Solicitar providência' }).click();
    await expect(dialogo.getByRole('textbox', { name: 'Fundamento' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await semViolacoes(page);

    await dialogo
      .getByRole('textbox', { name: 'Fundamento' })
      .fill('Deixou a banca e mantém acesso a documentos sensíveis.');
    await dialogo.getByRole('button', { name: 'Solicitar providência' }).click();
    await expect(page).toHaveURL(new RegExp(`${DETALHE}$`));
    await expect(
      page.getByRole('heading', { name: 'Providência sobre concessão', level: 1 }),
    ).toBeVisible();
  });

  test('a fila mostra as abertas, a mais antiga primeiro, e leva ao detalhe', async ({ page }) => {
    await abrir(page, PERMISSOES_DO_DIOGO_ADMINISTRA_CONCESSOES, '/acessos/providencias');

    await expect(
      page.getByRole('heading', { name: 'Providências sobre concessões', level: 1 }),
    ).toBeVisible();
    await expect(page.getByLabel('Situação')).toHaveValue('aberta');
    await expect(page.locator('tr[data-providencia-id]')).toHaveCount(1);
    await semViolacoes(page);
  });

  test('o gestor de acessos responde com motivo; o conflito retentável se repete com a mesma chave', async ({
    page,
  }) => {
    const escritas = await abrir(page, PERMISSOES_DO_DIOGO_ADMINISTRA_CONCESSOES, DETALHE, {
      detalhe: [providencia(), providencia({ situacao: 'respondida' })],
      escritas: [
        { status: 409, corpo: CONFLITO_RETENTAVEL },
        { status: 200, corpo: providencia() },
      ],
    });
    await page.getByRole('button', { name: 'Responder' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Responder a providência' });
    await dialogo
      .getByRole('textbox', { name: 'Motivo' })
      .fill('Segue na banca até o fim do certame.');
    await dialogo.getByRole('button', { name: 'Registrar resposta' }).click();

    await expect.poll(() => escritas.length).toBe(2);
    expect(escritas[1]?.chave).toBe(escritas[0]?.chave);
    expect(escritas[0]?.corpo).toEqual({ motivo: 'Segue na banca até o fim do certame.' });
  });

  test('o atendimento pede o e-mail do beneficiário e revoga a concessão', async ({ page }) => {
    const escritas = await abrir(page, PERMISSOES_DO_DIOGO_ADMINISTRA_CONCESSOES, DETALHE, {
      detalhe: [providencia(), providencia({ situacao: 'atendida' })],
    });
    await page.getByRole('button', { name: 'Atender e revogar a concessão' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Revogar a concessão' });
    await dialogo.getByRole('textbox', { name: 'Motivo' }).fill('Deixou a banca.');
    await dialogo
      .getByRole('textbox', { name: 'E-mail do beneficiário' })
      .fill('leandro-viana84@agenciadbd.com');
    await dialogo.getByRole('button', { name: 'Revogar concessão' }).click();

    await expect.poll(() => escritas.length).toBe(1);
    expect(escritas[0]?.caminho).toMatch(/\/atendimento$/);
    expect(escritas[0]?.corpo).toEqual({
      motivo: 'Deixou a banca.',
      confirmacaoEmail: 'leandro-viana84@agenciadbd.com',
    });
  });

  test('a prejudicada mostra o que encerrou a concessão, sem ações', async ({ page }) => {
    await abrir(page, PERMISSOES_DO_DIOGO_ADMINISTRA_CONCESSOES, DETALHE, {
      detalhe: [
        providencia({
          situacao: 'prejudicada',
          encerramentoDaConcessao: { causa: 'revogada', em: '2026-11-11T14:00:00Z' },
        }),
      ],
    });

    await expect(page.getByText('Concessão revogada em')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Responder' })).toHaveCount(0);
  });

  test('quem solicitou acompanha, sem os botões de responder', async ({ page }) => {
    await abrir(page, PERMISSOES_DO_DIOGO_ADMINISTRA_CONCESSOES, DETALHE, {
      detalhe: [providencia({ impedidoDeResponder: true })],
    });

    await expect(page.getByText('não a respondem')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Responder' })).toHaveCount(0);
  });

  for (const [nome, largura, altura] of [
    ['320 px', 320, 700],
    ['zoom de 200% (1366 px a 200%)', 683, 384],
  ] as const) {
    test(`o detalhe da providência cabe sem rolagem horizontal em ${nome}`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await abrir(page, PERMISSOES_DO_DIOGO_ADMINISTRA_CONCESSOES, DETALHE);
      await expect(
        page.getByRole('heading', { name: 'Providência sobre concessão', level: 1 }),
      ).toBeVisible();
      const rola = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(rola, 'a página não rola na horizontal').toBe(false);
    });
  }
});
