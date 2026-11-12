import { expect, test, type Page } from '@playwright/test';
import { assertReflowContract, mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { problema } from '../support/api-de-perfis-filas';
import {
  ITEM_DECIDIDO,
  REVISAO_ID,
  RESUMO_ABERTO,
  RESUMO_ENCERRADO,
  itemDaRevisao,
  mockRevisoes,
  revisaoAberta,
  FERNANDA,
  type CenarioDaRevisao,
} from '../support/api-de-revisoes';
import {
  PERMISSOES_DA_BETINA_CONDUZ_REVISOES,
  PERMISSOES_DA_ISABELLA_CONSULTA_REVISOES,
  PERMISSOES_DO_DIOGO_REVE_REVISOES,
  PERMISSOES_DO_DIOGO_SO_APROVA,
} from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const DETALHE = `/acessos/revisoes/${REVISAO_ID}`;

async function abrir(
  page: Page,
  permissoes: readonly string[],
  rota: string,
  cenario: CenarioDaRevisao,
) {
  await mockConfiguracaoRuntimeConfig(page);
  await mockPermissoesEfetivas(page, permissoes);
  const chamadas = await mockRevisoes(page, cenario);
  await page.goto(rota);
  return chamadas;
}

const linha = (page: Page, id: string) => page.locator(`tr[data-item-id="${id}"]`);
const acoes = (page: Page, id: string) => linha(page, id).getByRole('button');

async function semViolacoes(page: Page): Promise<void> {
  const { violations } = await runAxeWcagAA(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test.describe('Acessos — revisão periódica', () => {
  test('a lista mostra abertas e encerradas, filtra por situação e abre o resultado da encerrada', async ({
    page,
  }) => {
    await abrir(page, PERMISSOES_DA_ISABELLA_CONSULTA_REVISOES, '/acessos/revisoes', {
      lista: [RESUMO_ABERTO, RESUMO_ENCERRADO],
      detalhe: [
        () => ({ ...RESUMO_ENCERRADO, itens: [itemDaRevisao('i9', FERNANDA, ITEM_DECIDIDO)] }),
      ],
    });

    await expect(page.getByRole('heading', { name: 'Revisões de acesso', level: 1 })).toBeVisible();
    await expect(page.locator('tr[data-revisao-id]')).toHaveCount(2);
    await page.getByLabel('Situação').selectOption('concluida');
    await expect(page.locator('tr[data-revisao-id]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Abrir revisão' })).toHaveCount(0);

    await page.locator(`tr[data-revisao-id="${RESUMO_ENCERRADO.id}"] a`).click();
    await expect(page.getByText('Revisão encerrada')).toBeVisible();
    await expect(linha(page, 'i9')).toContainText('Acesso mantido');
    await expect(page.getByRole('button', { name: /^(Confirmar|Revogar)/ })).toHaveCount(0);
  });

  test('o Representante do controlador decide o item comum, e não o de quem é Representante nem o próprio', async ({
    page,
  }) => {
    await abrir(page, PERMISSOES_DA_BETINA_CONDUZ_REVISOES, DETALHE, { detalhe: [revisaoAberta] });

    await expect(acoes(page, 'i1')).toHaveText(['Confirmar', 'Revogar']);
    await expect(linha(page, 'i3')).toContainText('Gestão de acessos');
    await expect(acoes(page, 'i3')).toHaveCount(0);
    await expect(acoes(page, 'i4')).toHaveCount(0);
    await expect(linha(page, 'i2')).toContainText('Governança gravada na decisão.');
  });

  test('a gestão de acessos decide só o item de quem é Representante', async ({ page }) => {
    await abrir(page, PERMISSOES_DO_DIOGO_REVE_REVISOES, DETALHE, { detalhe: [revisaoAberta] });

    await expect(acoes(page, 'i3')).toHaveText(['Confirmar', 'Revogar']);
    await expect(acoes(page, 'i1')).toHaveCount(0);
  });

  test('o Encarregado de dados vê revisão, itens e resultados sem nenhuma ação', async ({
    page,
  }) => {
    await abrir(page, PERMISSOES_DA_ISABELLA_CONSULTA_REVISOES, DETALHE, {
      detalhe: [revisaoAberta],
    });

    await expect(page.locator('tr[data-item-id]')).toHaveCount(4);
    await expect(page.getByRole('button', { name: /^(Confirmar|Revogar)/ })).toHaveCount(0);
  });

  test('o decisor muda entre a leitura e a decisão: mostra o título e recarrega o item', async ({
    page,
  }) => {
    const chamadas = await abrir(page, PERMISSOES_DA_BETINA_CONDUZ_REVISOES, DETALHE, {
      detalhe: [
        revisaoAberta,
        (sub) => ({
          ...revisaoAberta(sub),
          itens: [itemDaRevisao('i1', FERNANDA, { decide: 'gestor-de-acessos' })],
        }),
      ],
      decisao: {
        status: 422,
        corpo: problema(
          422,
          'uniplus.autorizacao.revisao.decisor_nao_decide_o_item',
          'O item cabe à outra governança',
        ),
      },
    });

    await acoes(page, 'i1').filter({ hasText: 'Confirmar' }).click();

    await expect(page.getByText('O item cabe à outra governança')).toBeVisible();
    await expect(linha(page, 'i1')).toContainText('Gestão de acessos');
    await expect(acoes(page, 'i1')).toHaveCount(0);
    expect(chamadas.filter((c) => c.metodo === 'POST').map((c) => c.caminho)).toEqual([
      `/api/autorizacao/revisoes/${REVISAO_ID}/itens/i1/confirmacao`,
    ]);
  });

  test('decisão concorrente: avisa e mostra a decisão já gravada', async ({ page }) => {
    await abrir(page, PERMISSOES_DA_BETINA_CONDUZ_REVISOES, DETALHE, {
      detalhe: [
        revisaoAberta,
        (sub) => ({
          ...revisaoAberta(sub),
          itens: [itemDaRevisao('i1', FERNANDA, { ...ITEM_DECIDIDO, situacao: 'revogada' })],
        }),
      ],
      decisao: {
        status: 409,
        corpo: problema(409, 'uniplus.autorizacao.revisao.item_ja_decidido', 'x'),
      },
    });

    await acoes(page, 'i1').filter({ hasText: 'Revogar' }).click();
    await page.getByRole('dialog').getByLabel('Motivo').fill('Mudou de setor.');
    await page.getByRole('dialog').getByRole('button', { name: 'Revogar acesso' }).click();

    await expect(page.getByText('Decisão concorrente')).toBeVisible();
    await expect(linha(page, 'i1')).toContainText('Acesso revogado');
  });

  test('quem conduz abre uma revisão e segue para o detalhe dela', async ({ page }) => {
    const chamadas = await abrir(page, PERMISSOES_DA_BETINA_CONDUZ_REVISOES, '/acessos/revisoes', {
      lista: [RESUMO_ENCERRADO],
      detalhe: [revisaoAberta],
    });

    await page.getByRole('button', { name: 'Abrir revisão' }).click();

    await expect(page).toHaveURL(DETALHE);
    await expect(linha(page, 'i1')).toBeVisible();
    expect(
      chamadas.some((c) => c.metodo === 'POST' && c.caminho === '/api/autorizacao/revisoes'),
    ).toBe(true);
  });

  test('sem permissão de revisões, o menu não oferece a tela e a guarda bloqueia a URL', async ({
    page,
  }) => {
    const chamadas = await abrir(page, PERMISSOES_DO_DIOGO_SO_APROVA, '/acessos/revisoes', {
      detalhe: [revisaoAberta],
    });

    await expect(page).toHaveURL(/\/acesso-negado/);
    await expect(page.getByRole('link', { name: 'Revisões de acesso' })).toHaveCount(0);
    expect(chamadas).toEqual([]);
  });
});

test.describe('Acessos — revisão periódica: acessibilidade', () => {
  test('lista e detalhe sem violação WCAG 2.1 AA', async ({ page }) => {
    await abrir(page, PERMISSOES_DA_BETINA_CONDUZ_REVISOES, '/acessos/revisoes', {
      lista: [RESUMO_ABERTO, RESUMO_ENCERRADO],
      detalhe: [revisaoAberta],
    });
    await expect(page.locator('tr[data-revisao-id]')).toHaveCount(2);
    await semViolacoes(page);

    await page.goto(DETALHE);
    await expect(linha(page, 'i1')).toBeVisible();
    await semViolacoes(page);
  });

  for (const [nome, largura, altura] of [
    ['320 px', 320, 640],
    ['zoom de 200% (1366 px a 200%)', 683, 384],
  ] as const) {
    test(`o detalhe se reorganiza sem rolagem horizontal em ${nome}`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await abrir(page, PERMISSOES_DA_BETINA_CONDUZ_REVISOES, DETALHE, {
        detalhe: [revisaoAberta],
      });
      await expect(linha(page, 'i1')).toBeVisible();

      await assertReflowContract(page);
      await expect(acoes(page, 'i1').first()).toBeVisible();
    });
  }

  test('o diálogo de revogação prende o foco e é operável pelo teclado', async ({ page }) => {
    await abrir(page, PERMISSOES_DA_BETINA_CONDUZ_REVISOES, DETALHE, { detalhe: [revisaoAberta] });

    await acoes(page, 'i1').filter({ hasText: 'Revogar' }).focus();
    await page.keyboard.press('Enter');
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Revogar acesso' }).click();
    await expect(dialogo.getByText('Informe o motivo')).toBeVisible();
    await semViolacoes(page);
  });
});

test('quem decide é nomeado pela função, sem atribuir decisão ao Encarregado de dados', async ({
  page,
}) => {
  await abrir(page, PERMISSOES_DA_ISABELLA_CONSULTA_REVISOES, DETALHE, {
    detalhe: [revisaoAberta],
  });

  await expect(linha(page, 'i3')).toContainText('Gestão de acessos');
  await expect(linha(page, 'i1')).toContainText('Representante do controlador');
  await expect(page.locator('main')).not.toContainText('Encarregado');
});
