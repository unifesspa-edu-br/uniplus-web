import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  acimaDoRodape,
  andarPorTabAteAAcao,
  conferirQueSoOCorpoRola,
  rolarOCorpoAoTopo,
  rolarOCorpoAteOFim,
} from '../support/gaveta-de-formulario';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { COM_AMBAS, PROBLEMA_500, abrirCadastro, mockApi } from '../support/unidades-escritas';

interface Tela {
  readonly nome: string;
  readonly largura: number;
  readonly altura: number;
}

const TELAS_BAIXAS: readonly Tela[] = [
  { nome: '640x360', largura: 640, altura: 360 },
  { nome: '320x568', largura: 320, altura: 568 },
  { nome: '683x384, o que o zoom de 200% deixa de 1366x768', largura: 683, altura: 384 },
];
const TELA_MUITO_BAIXA: Tela = { nome: '320x256', largura: 320, altura: 256 };

/** Abre o cadastro de unidade na tela dada, com o aviso de falha ao gravar visível fora do formulário. */
async function abrirComOAviso(page: Page, tela: Tela): Promise<Locator> {
  await page.setViewportSize({ width: tela.largura, height: tela.altura });
  const { liberar } = await mockApi(page, [{ status: 500, corpo: PROBLEMA_500 }], COM_AMBAS);
  const painel = await abrirCadastro(page);
  await painel.getByRole('button', { name: 'Criar unidade' }).click();
  liberar();
  await expect(painel.getByText('Erro interno')).toBeVisible();
  return painel;
}

for (const tela of TELAS_BAIXAS) {
  test.describe(`Gaveta de formulário em ${tela.nome}`, () => {
    test.beforeEach(async ({ page }) => {
      await mockConfiguracaoRuntimeConfig(page);
    });

    test('título, aviso e ações são alcançáveis, e a rolagem é só do corpo', async ({ page }) => {
      const painel = await abrirComOAviso(page, tela);
      await conferirQueSoOCorpoRola(painel);
      await rolarOCorpoAoTopo(painel);
      await expect(painel.getByRole('heading', { name: 'Nova unidade' })).toBeInViewport();
      await expect(painel.getByText('Erro interno')).toBeInViewport();
      await expect(painel.getByRole('button', { name: 'Cancelar' })).toBeInViewport();
      await expect(painel.getByRole('button', { name: 'Criar unidade' })).toBeInViewport();
    });

    test('no fim da rolagem o último campo termina acima do rodapé, que segue utilizável', async ({
      page,
    }) => {
      const painel = await abrirComOAviso(page, tela);
      await rolarOCorpoAteOFim(painel);
      const ultimo = painel.locator('.form-drawer__form').locator('input, select, textarea').last();
      expect(await acimaDoRodape(painel, ultimo)).toBe(true);
      await expect(painel.getByRole('button', { name: 'Criar unidade' })).toBeInViewport();
    });

    test('andando por Tab, nenhum campo focado fica escondido sob o rodapé', async ({ page }) => {
      const painel = await abrirComOAviso(page, tela);
      await painel.locator('input').first().focus();
      await andarPorTabAteAAcao(page, painel, 'Criar unidade');
      await expect(painel.getByRole('button', { name: 'Criar unidade' })).toBeFocused();
    });
  });
}

test.describe('Gaveta de formulário em altura muito baixa', () => {
  test('o rodapé deixa de ficar preso e é alcançado no fim da rolagem', async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    const painel = await abrirComOAviso(page, TELA_MUITO_BAIXA);
    const rodape = painel.locator('.form-drawer__footer');
    await expect(rodape).toHaveCSS('position', 'static');
    await rolarOCorpoAteOFim(painel);
    await expect(rodape.getByRole('button', { name: 'Criar unidade' })).toBeInViewport();
  });
});
