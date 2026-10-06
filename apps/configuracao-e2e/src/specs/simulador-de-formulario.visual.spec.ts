import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

/**
 * A tela de simulação de formulário (web#1027) nos temas e larguras da matriz: o formulário importado é
 * desenhado seção a seção, o campo condicionado aparece e some com a resposta e é anunciado, o aviso de
 * que nada é gravado fica visível, e nada transborda na horizontal, nem em 320 px. A acessibilidade é
 * conferida pelo axe sobre todas as violações de WCAG 2.1 AA, como pedem os specs novos.
 *
 * O arquivo é aberto no navegador e a simulação não chama a API: nada aqui depende do backend.
 */
const FORMULARIO = {
  finalidade: 'INSCRICAO',
  titulo: 'Inscrição',
  etapas: [
    {
      codigo: 'ENDERECO',
      codigoNasRegras: 'ENDERECO',
      ordem: 0,
      tipo: 'SECAO',
      bloco: null,
      titulo: 'Endereço',
      descricao: 'Onde você mora.',
      aviso: null,
    },
    {
      codigo: 'FAMILIA',
      codigoNasRegras: 'FAMILIA',
      ordem: 1,
      tipo: 'SECAO',
      bloco: null,
      titulo: 'Composição familiar',
      descricao: null,
      aviso: null,
    },
  ],
  termos: [],
  fatosColetados: [
    {
      fatoCodigo: 'TIPO_ENDERECO',
      ordem: 0,
      rotulo: 'Tipo de endereço',
      tipoRenderizacao: 'SELECAO_UNICA',
      valoresSelecionaveis: [
        { codigo: 'URBANO', descricao: 'Urbano', ordem: 0 },
        { codigo: 'ALDEIA', descricao: 'Aldeia indígena', ordem: 1 },
      ],
    },
    {
      fatoCodigo: 'NOME_ALDEIA',
      ordem: 1,
      rotulo: 'Nome da aldeia',
      tipoRenderizacao: 'TEXTO',
      ajuda: 'Como a comunidade é conhecida.',
    },
  ],
  grupos: [
    {
      codigo: 'COMPOSICAO',
      ordem: 0,
      rotulo: 'Integrante',
      minimo: 1,
      maximo: 3,
      incluiCandidato: false,
      subitens: [
        { fatoCodigo: 'RENDA', ordem: 0, rotulo: 'Renda mensal', tipoRenderizacao: 'NUMERO' },
      ],
    },
  ],
  regras: {
    etapas: [
      {
        codigo: 'ENDERECO',
        exibicao: null,
        itens: [
          {
            fatoCodigo: 'TIPO_ENDERECO',
            obrigatoriedade: 'SEMPRE',
            restricoes: [],
            oferta: ['ALDEIA', 'URBANO'],
          },
          {
            fatoCodigo: 'NOME_ALDEIA',
            obrigatoriedade: 'SEMPRE',
            restricoes: [],
            exibicao: [[{ fato: 'TIPO_ENDERECO', operador: 'IGUAL', valor: 'ALDEIA' }]],
          },
        ],
        grupos: [],
      },
      {
        codigo: 'FAMILIA',
        exibicao: null,
        itens: [],
        grupos: [
          {
            codigo: 'COMPOSICAO',
            obrigatoriedade: 'SEMPRE',
            minimo: 1,
            maximo: 3,
            incluiCandidato: false,
            subitens: [
              {
                fatoCodigo: 'RENDA',
                obrigatoriedade: 'SEMPRE',
                restricoes: [{ tipo: 'FAIXA_NUMERICA', minimo: 0 }],
              },
            ],
          },
        ],
      },
    ],
    termos: [],
    derivacoes: [],
    agregados: [],
  },
  pressupostos: [],
};

test.describe('Simulador de formulário — temas, larguras e acessibilidade (web#1027)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const theme = metadataTheme(testInfo);
    await mockConfiguracaoRuntimeConfig(page);
    await page.addInitScript((dsTheme: VisualTheme) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
          contrast: dsTheme === 'contrast',
          fontMode: 'default',
        }),
      );
    }, theme);

    await page.goto('/simulador-de-formulario');
    await expect(
      page.getByRole('heading', { name: 'Simulador de formulário', level: 1 }),
    ).toBeVisible();
    await page.getByLabel('Arquivo JSON do formulário').setInputFiles({
      name: 'formulario.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(FORMULARIO)),
    });
    await expect(page.getByRole('heading', { name: /Endereço/, level: 3 })).toBeVisible();
  });

  test('o campo condicionado aparece com a resposta e é anunciado, e o aviso de simulação fica visível', async ({
    page,
  }) => {
    await expect(page.getByRole('note')).toContainText('nada é gravado');
    await expect(page.getByLabel('Nome da aldeia')).toHaveCount(0);

    await page.locator('label', { hasText: 'Aldeia indígena' }).click();

    await expect(page.getByLabel('Nome da aldeia')).toBeVisible();
    await expect(page.locator('.formulario-candidato > [aria-live="polite"]')).toContainText(
      'Apareceu: Nome da aldeia.',
    );
  });

  test('não há violação de WCAG 2.1 AA na seção e no grupo repetível', async ({ page }) => {
    await page.locator('label', { hasText: 'Aldeia indígena' }).click();
    await semViolacoes(page);

    await page.getByRole('button', { name: 'Próxima seção' }).click();
    await page.getByRole('button', { name: /Acrescentar a integrante/ }).click();
    await expect(page.getByLabel('Renda mensal')).toBeVisible();
    await semViolacoes(page);
  });

  test('nada transborda na horizontal em 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.locator('label', { hasText: 'Aldeia indígena' }).click();
    await page.getByRole('button', { name: 'Próxima seção' }).click();
    await page.getByRole('button', { name: /Acrescentar a integrante/ }).click();

    const largura = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: document.documentElement.clientWidth,
    }));
    expect(largura.pagina).toBeLessThanOrEqual(largura.janela);
  });
});

async function semViolacoes(page: Page): Promise<void> {
  const { violations } = await runAxeWcagAA(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  if (theme === 'light' || theme === 'dark' || theme === 'contrast') return theme;
  throw new Error(`Projeto visual sem tema conhecido: ${String(theme)}`);
}
