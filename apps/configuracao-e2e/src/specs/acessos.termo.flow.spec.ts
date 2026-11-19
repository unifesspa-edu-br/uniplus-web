import { expect, test, type Page } from '@playwright/test';
import { assertReflowContract, mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { problema } from '../support/api-de-perfis-filas';
import {
  PEDIDO_ID,
  PERFIL_SENSIVEL_ID,
  SEM_TERMO,
  UNIDADE_ID,
  mockApiDoTermo,
  pedidoComTermo,
  versaoDoTermo,
  type CenarioDoTermo,
  type ChamadaDoTermo,
} from '../support/api-do-termo';
import {
  PERMISSOES_DO_DIOGO_PUBLICA_O_TERMO,
  PERMISSOES_DO_DIOGO_SO_APROVA,
} from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const PUBLICACAO = '/acessos/termo-de-responsabilidade';
const PEDIR = '/acessos/pedidos/novo';
const DETALHE = `/acessos/pedidos/${PEDIDO_ID}`;

async function abrir(
  page: Page,
  rota: string,
  cenario: CenarioDoTermo = {},
  permissoes: readonly string[] = [],
) {
  await mockConfiguracaoRuntimeConfig(page);
  await mockPermissoesEfetivas(page, permissoes);
  const chamadas = await mockApiDoTermo(page, cenario);
  await page.goto(rota);
  return chamadas;
}

/** Preenche o pedido próprio do perfil sensível, sem documento: o envio é o aceite. */
async function preencherOPedido(page: Page): Promise<void> {
  await page.getByLabel('Perfil de acesso').selectOption(PERFIL_SENSIVEL_ID);
  await page.getByLabel('Unidade').selectOption(UNIDADE_ID);
  await page
    .getByLabel('Justificativa')
    .fill('Analiso os documentos pessoais do processo seletivo.');
}

const aceite = (page: Page, numero: number) =>
  page.getByLabel(`Li e aceito o termo de responsabilidade, versão ${numero}.`);
/** A caixa do DS esconde o input sob o desenho dela: marca-se pelo rótulo, como a pessoa faz. */
const marcarAceite = (page: Page, numero: number) =>
  page
    .locator('label.checkbox', {
      hasText: `Li e aceito o termo de responsabilidade, versão ${numero}.`,
    })
    .click();
const criacoes = (chamadas: readonly ChamadaDoTermo[]) =>
  chamadas.filter((c) => c.metodo === 'POST' && c.caminho.endsWith('/pedidos-de-concessao'));
const leiturasDaVigente = (chamadas: readonly ChamadaDoTermo[]) =>
  chamadas.filter((c) => c.caminho.endsWith('/vigente')).length;

async function semViolacoes(page: Page): Promise<void> {
  const { violations } = await runAxeWcagAA(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

test.describe('Acessos — publicação do termo de responsabilidade', () => {
  test('mostra a vigente e o histórico da versão 1 à mais recente, e publica sobre a vigente lida', async ({
    page,
  }) => {
    const chamadas = await abrir(page, PUBLICACAO, {}, PERMISSOES_DO_DIOGO_PUBLICA_O_TERMO);

    await expect(
      page.getByRole('heading', { name: 'Termo de responsabilidade', level: 1 }),
    ).toBeVisible();
    await expect(page.locator('tr[data-versao]')).toHaveText([/Substituída/u, /Vigente/u]);
    await page.getByLabel('Texto da versão nova').fill(versaoDoTermo(3).texto);
    await page.getByLabel('Ato que aprova a versão').fill('Portaria 3/2026');
    await page.getByRole('button', { name: 'Publicar versão' }).click();

    await expect(page.getByText('Versão 3 do termo publicada')).toBeVisible();
    const publicacao = chamadas.find((c) => c.metodo === 'POST');
    expect(publicacao?.corpo).toMatchObject({
      ato: 'Portaria 3/2026',
      versaoVigenteEsperadaId: 'termo-v2',
    });
    expect(publicacao?.chave?.length).toBeGreaterThan(0);
  });

  test('com outra versão publicada antes (409), avisa e relê a vigente', async ({ page }) => {
    const chamadas = await abrir(
      page,
      PUBLICACAO,
      {
        publicacao: [
          {
            status: 409,
            corpo: problema(
              409,
              'uniplus.autorizacao.termo.vigente_alterado',
              'Outra versão foi publicada antes',
            ),
          },
        ],
      },
      PERMISSOES_DO_DIOGO_PUBLICA_O_TERMO,
    );
    await expect(page.locator('tr[data-versao]')).toHaveCount(2);
    const antes = leiturasDaVigente(chamadas);

    await page.getByLabel('Texto da versão nova').fill(versaoDoTermo(3).texto);
    await page.getByLabel('Ato que aprova a versão').fill('Portaria 3/2026');
    await page.getByRole('button', { name: 'Publicar versão' }).click();

    await expect(page.getByText('Outra versão foi publicada antes').first()).toBeVisible();
    await expect.poll(() => leiturasDaVigente(chamadas)).toBeGreaterThan(antes);
  });

  test('sem a permissão de publicar, o menu não oferece a tela e a guarda bloqueia a URL', async ({
    page,
  }) => {
    const chamadas = await abrir(page, PUBLICACAO, {}, PERMISSOES_DO_DIOGO_SO_APROVA);

    await expect(page).toHaveURL(/\/acesso-negado/u);
    await expect(page.getByRole('link', { name: 'Termo de responsabilidade' })).toHaveCount(0);
    expect(chamadas.filter((c) => c.caminho.includes('termos-de-responsabilidade'))).toEqual([]);
  });
});

test.describe('Acessos — aceite do termo de responsabilidade', () => {
  test('no pedido próprio sem documento, o envio só segue com o aceite e apresenta a vigente', async ({
    page,
  }) => {
    const chamadas = await abrir(page, PEDIR);
    await preencherOPedido(page);

    await expect(
      page.getByRole('region', { name: 'Texto do termo de responsabilidade, versão 2' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Enviar pedido' }).click();
    await expect(page.getByText('Marque o aceite do termo para continuar.')).toBeVisible();
    expect(criacoes(chamadas)).toHaveLength(0);

    await marcarAceite(page, 2);
    await page.getByRole('button', { name: 'Enviar pedido' }).click();

    await expect(page).toHaveURL(DETALHE);
    expect(criacoes(chamadas)[0]?.corpo).toMatchObject({
      anexaraDocumento: false,
      termoVersaoApresentadaId: 'termo-v2',
    });
  });

  test('no pedido para outra pessoa, informa a vigente sem a caixa de aceite e envia a versão', async ({
    page,
  }) => {
    const chamadas = await abrir(page, PEDIR);
    // O ponto do rádio do DS fica sobre o input: escolhe-se pelo rótulo, como a pessoa faz.
    await page.locator('label.radio', { hasText: 'Para outra pessoa' }).click();
    await page
      .getByLabel('E-mail institucional do beneficiário')
      .fill('betina.teste@unifesspa.edu.br');
    await preencherOPedido(page);

    await expect(page.getByText(/aceitará o termo no próprio pedido/u)).toBeVisible();
    await expect(aceite(page, 2)).toHaveCount(0);
    await page.getByRole('button', { name: 'Enviar pedido' }).click();

    await expect(page).toHaveURL(DETALHE);
    expect(criacoes(chamadas)[0]?.corpo).toMatchObject({ termoVersaoApresentadaId: 'termo-v2' });
  });

  for (const [quem, solicitadoPorMim] of [
    ['no pedido próprio com documento', true],
    ['no pedido feito por outra pessoa', false],
  ] as const) {
    test(`${quem}, o beneficiário aceita no detalhe a versão fixada, e não a vigente`, async ({
      page,
    }) => {
      const chamadas = await abrir(page, DETALHE, {
        pedido: pedidoComTermo({ solicitadoPorMim, anexaraDocumento: solicitadoPorMim }),
      });

      await expect(
        page.getByRole('region', { name: 'Texto do termo de responsabilidade, versão 1' }),
      ).toBeVisible();
      await marcarAceite(page, 1);
      await page.getByRole('button', { name: 'Aceitar o pedido' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Aceitar', exact: true }).click();

      await expect
        .poll(() => chamadas.find((c) => c.caminho.endsWith('/aceite'))?.corpo)
        .toEqual({
          termoVersaoApresentadaId: 'termo-v1',
        });
      expect(leiturasDaVigente(chamadas)).toBe(0);
    });
  }

  test('o pedido que espera a verificação do documento não oferece o aceite', async ({ page }) => {
    await abrir(page, DETALHE, {
      pedido: pedidoComTermo({
        solicitadoPorMim: true,
        anexaraDocumento: true,
        situacao: 'aguardando_documento',
      }),
    });

    await expect(page.getByRole('heading', { name: 'Pedido de acesso', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aceitar o pedido' })).toHaveCount(0);
    await expect(aceite(page, 1)).toHaveCount(0);
  });

  test('sem termo publicado, diz isso no lugar do texto e não envia', async ({ page }) => {
    const chamadas = await abrir(page, PEDIR, { vigente: [SEM_TERMO] });
    await preencherOPedido(page);

    await expect(
      page.getByText('Não há termo de responsabilidade publicado').first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Enviar pedido' }).click();

    expect(criacoes(chamadas)).toHaveLength(0);
  });

  test('com a vigente trocada durante o envio (409), apresenta a nova e reenvia sob chave nova', async ({
    page,
  }) => {
    const chamadas = await abrir(page, PEDIR, {
      vigente: [
        { status: 200, corpo: versaoDoTermo(2) },
        { status: 200, corpo: versaoDoTermo(3) },
      ],
      criacao: [
        {
          status: 409,
          corpo: problema(
            409,
            'uniplus.autorizacao.pedido.termo_divergente',
            'O termo apresentado não é o vigente',
          ),
        },
        { status: 201, corpo: { id: PEDIDO_ID } },
      ],
    });
    await preencherOPedido(page);
    await marcarAceite(page, 2);
    await page.getByRole('button', { name: 'Enviar pedido' }).click();

    await expect(
      page.locator('[aria-live="polite"]', { hasText: /atualizado para a versão 3/u }).first(),
    ).toBeVisible();
    await expect(page.getByText('Compromisso próprio da versão 2 do termo.')).toHaveCount(0);
    await expect(page.getByText('Compromisso próprio da versão 3 do termo.')).toBeVisible();
    await expect(aceite(page, 3)).not.toBeChecked();
    await page.getByRole('button', { name: 'Enviar pedido' }).click();
    await expect(page.getByText('Marque o aceite do termo para continuar.')).toBeVisible();
    expect(criacoes(chamadas)).toHaveLength(1);
    await marcarAceite(page, 3);
    await page.getByRole('button', { name: 'Enviar pedido' }).click();

    await expect(page).toHaveURL(DETALHE);
    const [primeira, segunda] = criacoes(chamadas);
    expect(segunda?.corpo).toMatchObject({ termoVersaoApresentadaId: 'termo-v3' });
    expect(primeira?.chave?.length).toBeGreaterThan(0);
    expect(segunda?.chave?.length).toBeGreaterThan(0);
    expect(segunda?.chave).not.toBe(primeira?.chave);
  });
});

test.describe('Acessos — termo de responsabilidade: acessibilidade', () => {
  test('publicação, pedido e aceite sem violação WCAG 2.1 AA', async ({ page }) => {
    await abrir(
      page,
      PUBLICACAO,
      { pedido: pedidoComTermo({ solicitadoPorMim: false, anexaraDocumento: false }) },
      PERMISSOES_DO_DIOGO_PUBLICA_O_TERMO,
    );
    await expect(page.locator('tr[data-versao]')).toHaveCount(2);
    await semViolacoes(page);

    await page.goto(PEDIR);
    await preencherOPedido(page);
    await expect(aceite(page, 2)).toBeVisible();
    await semViolacoes(page);

    await page.goto(DETALHE);
    await expect(aceite(page, 1)).toBeVisible();
    await semViolacoes(page);
  });

  for (const [nome, largura, altura] of [
    ['320 px', 320, 640],
    ['zoom de 200% (1366 px a 200%)', 683, 384],
  ] as const) {
    test(`o pedido com o termo e a publicação se reorganizam sem rolagem horizontal em ${nome}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await abrir(page, PEDIR, {}, PERMISSOES_DO_DIOGO_PUBLICA_O_TERMO);
      await preencherOPedido(page);
      await expect(aceite(page, 2)).toBeVisible();
      await assertReflowContract(page);

      await page.goto(PUBLICACAO);
      await expect(page.locator('tr[data-versao]')).toHaveCount(2);
      await assertReflowContract(page);
    });
  }
});
