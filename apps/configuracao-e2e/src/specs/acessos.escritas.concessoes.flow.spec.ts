import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { PERMISSOES_DO_DIOGO } from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { mockConcessoes } from '../support/api-de-concessoes-escritas';
import { PERFIL } from '../support/api-de-perfis-escritas';
import { ERRO_INTERNO, OK, problema } from '../support/escritas-retidas';

const JA_REVOGADA = problema(
  409,
  'uniplus.autorizacao.concessao.ja_revogada',
  'Concessão já revogada',
);

test.describe('Acessos — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO);
  });

  test.describe('revogação de concessões', () => {
    const revogar = (page: Page): Locator =>
      page.getByRole('button', { name: `Revogar a concessão de ${PERFIL.nome}` });
    const dialogo = (page: Page): Locator =>
      page.getByRole('dialog', { name: 'Revogar a concessão' });
    const tituloDeConcessoes = (page: Page): Locator =>
      page.getByRole('heading', { name: 'Concessões', level: 2, exact: true });

    async function abrirRevogacao(page: Page): Promise<Locator> {
      await page.goto('/acessos/concessoes');
      await revogar(page).click();
      const caixa = dialogo(page);
      await expect(caixa).toBeVisible();
      await caixa.getByLabel('E-mail do beneficiário').fill('betina.teste@unifesspa.edu.br');
      await caixa.getByLabel('Motivo').fill('Deixou a função na unidade.');
      return caixa;
    }

    test('revogação pendente mantém o diálogo somente leitura e não envia de novo', async ({
      page,
    }) => {
      const { liberar, envios } = await mockConcessoes(page, [OK]);
      const caixa = await abrirRevogacao(page);
      const confirmar = caixa.getByRole('button', { name: 'Revogar concessão' });
      await confirmar.click();

      await expect(caixa.getByLabel('Motivo')).toBeDisabled();
      await expect(caixa.getByLabel('Motivo')).toHaveValue('Deixou a função na unidade.');
      await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
      await expect(confirmar).toHaveAttribute('aria-busy', 'true');
      await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
      await expect(
        caixa.getByRole('status').filter({ hasText: 'Revogando concessão' }),
      ).toContainText('Revogando concessão');
      await expect(caixa.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      await expect(caixa.getByRole('button', { name: 'Fechar' })).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(caixa).toBeVisible();
      await confirmar.dispatchEvent('click');
      expect(envios).toHaveLength(1);

      liberar();
      await expect(caixa).toBeHidden();
      expect(envios).toHaveLength(1);
    });

    test('e-mail divergente fica no campo, com o foco nele', async ({ page }) => {
      const { liberar } = await mockConcessoes(page, [
        {
          status: 422,
          corpo: problema(422, 'uniplus.validacao', 'Dados inválidos', [
            {
              field: 'confirmacaoEmail',
              code: 'uniplus.autorizacao.concessao.confirmacao_divergente',
              message: 'O e-mail informado não é o do beneficiário da concessão.',
            },
          ]),
        },
      ]);
      const caixa = await abrirRevogacao(page);
      await caixa.getByRole('button', { name: 'Revogar concessão' }).click();
      liberar();

      const email = caixa.getByLabel('E-mail do beneficiário');
      await expect(email).toHaveAttribute('aria-invalid', 'true');
      await expect(email).toBeFocused();
      await expect(email).toHaveAttribute('aria-required', 'true');
      await expect(caixa.getByText('O e-mail informado não é o do beneficiário')).toBeVisible();
    });

    test('revogação concluída, com a linha ausente da recarga atrasada, leva o foco ao título', async ({
      page,
    }) => {
      const { liberar } = await mockConcessoes(page, [OK], 'sem-o-item');
      const caixa = await abrirRevogacao(page);
      await caixa.getByRole('button', { name: 'Revogar concessão' }).click();
      liberar();

      await expect(caixa).toBeHidden();
      await expect(tituloDeConcessoes(page)).toBeFocused();
    });

    test('revogação concluída, com a linha ainda na recarga, devolve o foco ao botão dela', async ({
      page,
    }) => {
      const { liberar } = await mockConcessoes(page, [OK], 'com-o-item');
      const caixa = await abrirRevogacao(page);
      await caixa.getByRole('button', { name: 'Revogar concessão' }).click();
      liberar();

      await expect(caixa).toBeHidden();
      await expect(revogar(page)).toBeFocused();
    });

    test('revogação concluída, com falha na recarga, leva o foco ao título', async ({ page }) => {
      const { liberar } = await mockConcessoes(page, [OK], 'com-falha');
      const caixa = await abrirRevogacao(page);
      await caixa.getByRole('button', { name: 'Revogar concessão' }).click();
      liberar();

      await expect(caixa).toBeHidden();
      await expect(tituloDeConcessoes(page)).toBeFocused();
    });

    test('concessão já revogada: a recarga tira a linha, e o foco só vai ao título quando o diálogo fecha', async ({
      page,
    }) => {
      const { liberar } = await mockConcessoes(
        page,
        [{ status: 409, corpo: JA_REVOGADA, listaMudou: true }],
        'sem-o-item',
      );
      const caixa = await abrirRevogacao(page);
      await caixa.getByRole('button', { name: 'Revogar concessão' }).click();
      liberar();

      await expect(caixa.getByText('A concessão já foi revogada.')).toBeVisible();
      await expect(revogar(page)).toHaveCount(0);
      await expect(caixa).toBeVisible();
      await expect(tituloDeConcessoes(page)).not.toBeFocused();

      await caixa.getByRole('button', { name: 'Cancelar' }).click();

      await expect(caixa).toBeHidden();
      await expect(tituloDeConcessoes(page)).toBeFocused();
    });

    test('revogação recusada mantém o diálogo aberto e o foco dentro dele', async ({ page }) => {
      const { liberar } = await mockConcessoes(page, [{ status: 500, corpo: ERRO_INTERNO }]);
      const caixa = await abrirRevogacao(page);
      await caixa.getByRole('button', { name: 'Revogar concessão' }).click();
      liberar();

      await expect(caixa.getByText('Erro interno')).toBeVisible();
      await expect(caixa.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
      await expect(caixa).toBeVisible();
      await expect(tituloDeConcessoes(page)).not.toBeFocused();
      await expect(caixa.locator(':focus')).toHaveCount(1);
    });
  });
});
