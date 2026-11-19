import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { PERMISSOES_DO_DIOGO } from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { PDF_DO_TESTE, PERFIL, mockPerfis } from '../support/api-de-perfis-escritas';
import { ERRO_INTERNO, OK, problema } from '../support/escritas-retidas';

const RECUSA_DE_NOME = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Nome',
    code: 'uniplus.autorizacao.perfil.nome_invalido',
    message: 'Nome fora do padrão.',
  },
]);
const NOME_DUPLICADO = problema(
  409,
  'uniplus.autorizacao.perfil.nome_duplicado',
  'Já existe perfil com este nome',
);
const EM_PROCESSAMENTO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'Escrita em processamento',
);

const tituloDePerfis = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Perfis', level: 2, exact: true });
const linkDoPerfil = (page: Page): Locator => page.getByRole('link', { name: PERFIL.nome });
const acaoDoPerfil = (page: Page, verbo: 'Reativar' | 'Desativar'): Locator =>
  page.getByRole('button', { name: verbo, exact: true });
const tituloDoPerfil = (page: Page): Locator =>
  page.getByRole('heading', { name: PERFIL.nome, level: 1 });
const dialogoDeContencao = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Desativar o perfil' });
const novo = (page: Page): Locator => page.getByRole('button', { name: 'Novo perfil' });
const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de perfil de acesso' });

async function abrirCriacao(page: Page, completo = true): Promise<Locator> {
  await page.goto('/acessos/perfis');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await formulario.locator('input[formcontrolname="nome"]').fill('Consulta');
  await formulario.locator('textarea[formcontrolname="descricao"]').fill('Só consulta.');
  if (completo) {
    await formulario.locator('input[formcontrolname="protocolo"]').fill('P-1/2026');
    await formulario.locator('label.checkbox', { hasText: 'selecao:processos:configurar' }).click();
    await formulario.locator('input[type="file"]').setInputFiles(PDF_DO_TESTE);
  }
  return formulario;
}

test.describe('Acessos — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO);
  });

  test.describe('perfis', () => {
    test('criação pendente preserva foco e valores, ignora o clique repetido e a recusa foca o campo', async ({
      page,
    }) => {
      const { liberar, envios } = await mockPerfis(page, [{ status: 422, corpo: RECUSA_DE_NOME }]);
      const formulario = await abrirCriacao(page);
      const nome = formulario.locator('input[formcontrolname="nome"]');
      await nome.fill('Consulta revisada');
      await formulario.getByRole('button', { name: 'Salvar perfil' }).click();
      const salvar = formulario.getByRole('button', { name: 'Salvando…' });

      await expect(nome).toBeDisabled();
      await expect(nome).toHaveValue('Consulta revisada');
      await expect(salvar).toBeFocused();
      await expect(salvar).toHaveAttribute('aria-disabled', 'true');
      await expect(salvar).toHaveAttribute('aria-busy', 'true');
      await expect(salvar).toHaveCSS('cursor', 'not-allowed');
      await expect(formulario.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(formulario).toBeVisible();
      await expect(formulario.getByRole('button', { name: 'Fechar' })).toBeDisabled();
      await salvar.dispatchEvent('click');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Space');
      expect(envios.map((envio) => envio.metodo)).toEqual(['POST']);

      liberar();
      await expect(nome).toBeEnabled();
      await expect(nome).toBeFocused();
      await expect(nome).toHaveAttribute('aria-invalid', 'true');
      await expect(formulario.getByText('Nome fora do padrão.')).toBeVisible();
      expect(envios.map((envio) => envio.metodo)).toEqual(['POST']);
    });

    test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
      page,
    }) => {
      const { liberar, envios } = await mockPerfis(page, [{ status: 500, corpo: ERRO_INTERNO }]);
      const formulario = await abrirCriacao(page);
      const nome = formulario.locator('input[formcontrolname="nome"]');
      await nome.focus();
      await page.keyboard.press('Enter');

      await expect(nome).toBeDisabled();
      await expect(formulario.getByRole('button', { name: 'Salvando…' })).toBeFocused();
      liberar();
      await expect(formulario.getByText('Erro interno')).toBeVisible();
      await expect(nome).toBeEnabled();
      await expect(formulario.getByRole('button', { name: 'Salvar perfil' })).toBeFocused();
      expect(envios).toHaveLength(1);
    });

    test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
      const { envios } = await mockPerfis(page, []);
      const formulario = await abrirCriacao(page, false);
      const nome = formulario.locator('input[formcontrolname="nome"]');
      await nome.fill('');
      await formulario.getByRole('button', { name: 'Salvar perfil' }).focus();
      await page.keyboard.press('Enter');

      await expect(nome).toBeFocused();
      await expect(nome).toHaveAttribute('aria-invalid', 'true');
      await expect(nome).toHaveAttribute('aria-required', 'true');
      await expect(formulario.getByText('Anexe o PDF do documento instituidor.')).toBeVisible();
      expect(envios).toEqual([]);
    });

    test('nome já existente marca o campo e o reenvio usa chave nova; conflito de processamento mantém a chave', async ({
      page,
    }) => {
      const { liberar, envios } = await mockPerfis(page, [
        { status: 409, corpo: NOME_DUPLICADO },
        { status: 409, corpo: EM_PROCESSAMENTO },
        { status: 409, corpo: EM_PROCESSAMENTO },
      ]);
      liberar();
      const formulario = await abrirCriacao(page);
      const nome = formulario.locator('input[formcontrolname="nome"]');
      await formulario.getByRole('button', { name: 'Salvar perfil' }).click();

      await expect(nome).toHaveAttribute('aria-invalid', 'true');
      await expect(nome).toBeFocused();
      await expect(formulario.getByText('Já existe um perfil com esse nome.')).toBeVisible();
      await expect(formulario.getByText('Não foi possível salvar')).toHaveCount(0);

      await nome.fill('Consulta 2');
      await formulario.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect(
        formulario.getByText('Não foi possível saber se o perfil foi criado'),
      ).toBeVisible();
      await formulario.getByRole('button', { name: 'Salvar perfil' }).click();
      await expect.poll(() => envios.length).toBe(3);

      expect(envios[1]?.chave).not.toBe(envios[0]?.chave);
      expect(envios[2]?.chave).toBe(envios[1]?.chave);
    });

    test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
      page,
    }) => {
      await mockPerfis(page, [], 'com-o-item', 'falha');
      await page.goto('/acessos/perfis');
      const tentar = page.getByRole('button', { name: 'Tentar novamente' });
      await tentar.click();

      await expect(tentar).toBeFocused();
      await expect(tentar).toHaveAttribute('aria-disabled', 'true');
      await expect(linkDoPerfil(page)).toBeVisible();
      await expect(tituloDePerfis(page)).toBeFocused();
    });

    test('criação concluída envia o PDF, confirma o envio e devolve o foco ao botão Novo perfil', async ({
      page,
    }) => {
      const { liberar } = await mockPerfis(page, [{ status: 201 }]);
      const confirmacao = page.waitForRequest(/\/documento\/confirmacao$/);
      const formulario = await abrirCriacao(page);
      await formulario.getByRole('button', { name: 'Salvar perfil' }).click();
      liberar();

      expect((await confirmacao).postDataJSON()).toEqual({ etag: '"etag-do-teste"' });
      await expect(formulario).toBeHidden();
      await expect(novo(page)).toBeFocused();
    });

    test('criação concluída, com falha na recarga, devolve o foco ao botão Novo perfil', async ({
      page,
    }) => {
      const { liberar } = await mockPerfis(page, [{ status: 201 }], 'com-falha');
      const formulario = await abrirCriacao(page);
      await formulario.getByRole('button', { name: 'Salvar perfil' }).click();
      liberar();

      await expect(formulario).toBeHidden();
      await expect(novo(page)).toBeFocused();
    });

    async function abrirDesativacao(page: Page): Promise<Locator> {
      await page.goto(`/acessos/perfis/${PERFIL.id}`);
      await acaoDoPerfil(page, 'Desativar').click();
      const caixa = dialogoDeContencao(page);
      await expect(caixa).toBeVisible();
      return caixa;
    }

    test('desativação pendente deixa o diálogo somente leitura e envia o comando uma só vez, com chave', async ({
      page,
    }) => {
      const { liberar, envios } = await mockPerfis(page, [OK]);
      const caixa = await abrirDesativacao(page);
      await caixa.getByLabel('Motivo').fill('Perfil sem uso.');
      const confirmar = caixa.getByRole('button', { name: 'Desativar perfil' });
      await confirmar.click();

      await expect(caixa.getByLabel('Motivo')).toBeDisabled();
      await expect(caixa.getByLabel('Motivo')).toHaveValue('Perfil sem uso.');
      await expect(confirmar).toHaveAttribute('aria-busy', 'true');
      await expect(caixa.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      await expect(acaoDoPerfil(page, 'Desativar')).toBeDisabled();
      await confirmar.dispatchEvent('click');
      expect(envios).toHaveLength(1);
      expect(envios[0]).toMatchObject({
        metodo: 'POST',
        caminho: `/api/autorizacao/perfis/${PERFIL.id}/desativacao`,
        corpo: { motivo: 'Perfil sem uso.' },
      });
      expect(envios[0]?.chave).toBeTruthy();

      liberar();
      await expect(caixa).toBeHidden();
      expect(envios).toHaveLength(1);
    });

    test('desativação concluída relê o perfil, oferece reativar e leva o foco ao título', async ({
      page,
    }) => {
      const { liberar } = await mockPerfis(page, [OK]);
      const caixa = await abrirDesativacao(page);
      await caixa.getByLabel('Motivo').fill('Perfil sem uso.');
      await caixa.getByRole('button', { name: 'Desativar perfil' }).click();
      liberar();

      await expect(caixa).toBeHidden();
      await expect(acaoDoPerfil(page, 'Reativar')).toBeVisible();
      await expect(acaoDoPerfil(page, 'Desativar')).toHaveCount(0);
      await expect(tituloDoPerfil(page)).toBeFocused();
    });

    test('reativação pede o motivo, envia por POST em reativacao e volta a oferecer desativar', async ({
      page,
    }) => {
      const { liberar, envios } = await mockPerfis(page, [OK, OK]);
      liberar();
      const desativacao = await abrirDesativacao(page);
      await desativacao.getByLabel('Motivo').fill('Perfil sem uso.');
      await desativacao.getByRole('button', { name: 'Desativar perfil' }).click();
      await expect(acaoDoPerfil(page, 'Reativar')).toBeVisible();

      await acaoDoPerfil(page, 'Reativar').click();
      const reativacao = page.getByRole('dialog', { name: 'Reativar o perfil' });
      await reativacao.getByLabel('Motivo').fill('Voltou a ser usado.');
      await reativacao.getByRole('button', { name: 'Reativar perfil' }).click();

      await expect(reativacao).toBeHidden();
      await expect(acaoDoPerfil(page, 'Desativar')).toBeVisible();
      expect(envios).toHaveLength(2);
      expect(envios[0]).toMatchObject({
        metodo: 'POST',
        caminho: `/api/autorizacao/perfis/${PERFIL.id}/desativacao`,
        corpo: { motivo: 'Perfil sem uso.' },
      });
      expect(envios[1]).toMatchObject({
        metodo: 'POST',
        caminho: `/api/autorizacao/perfis/${PERFIL.id}/reativacao`,
        corpo: { motivo: 'Voltou a ser usado.' },
      });
      expect(envios[1]?.chave).not.toBe(envios[0]?.chave);
    });

    test('desativação recusada pelo servidor anuncia o erro, preserva o motivo e libera nova tentativa', async ({
      page,
    }) => {
      const { liberar, envios } = await mockPerfis(page, [
        { status: 500, corpo: ERRO_INTERNO },
        OK,
      ]);
      liberar();
      const caixa = await abrirDesativacao(page);
      await caixa.getByLabel('Motivo').fill('Perfil sem uso.');
      const confirmar = caixa.getByRole('button', { name: 'Desativar perfil' });
      await confirmar.click();

      await expect(caixa.getByRole('alert')).toContainText('Erro interno');
      await expect(caixa.getByLabel('Motivo')).toHaveValue('Perfil sem uso.');
      await expect(caixa.getByLabel('Motivo')).toBeEnabled();
      await expect(confirmar).toBeEnabled();
      await expect(confirmar).not.toHaveAttribute('aria-busy', 'true');
      await expect(caixa.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
      await expect(caixa).toBeVisible();
      await expect(caixa.locator(':focus')).toHaveCount(1);
      await expect(acaoDoPerfil(page, 'Desativar')).toBeEnabled();

      await confirmar.click();
      await expect(caixa).toBeHidden();
      await expect(acaoDoPerfil(page, 'Reativar')).toBeVisible();
      expect(envios).toHaveLength(2);
      for (const envio of envios) {
        expect(envio).toMatchObject({
          metodo: 'POST',
          caminho: `/api/autorizacao/perfis/${PERFIL.id}/desativacao`,
          corpo: { motivo: 'Perfil sem uso.' },
        });
      }
    });

    test('desativação sem motivo marca o campo, leva o foco a ele e não chama a API', async ({
      page,
    }) => {
      const { envios } = await mockPerfis(page, []);
      const caixa = await abrirDesativacao(page);
      await caixa.getByRole('button', { name: 'Desativar perfil' }).click();

      const motivo = caixa.getByLabel('Motivo');
      await expect(motivo).toHaveAttribute('aria-invalid', 'true');
      await expect(motivo).toBeFocused();
      await expect(caixa.getByRole('alert')).toContainText('Informe o motivo');
      expect(envios).toEqual([]);
    });
  });
});
