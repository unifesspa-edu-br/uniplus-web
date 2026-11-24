import { expect, test } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import {
  INSTITUICAO,
  RECUSA_DO_CNPJ,
  RECUSA_DO_ENDERECO,
  JA_EXISTE,
  PROCESSAMENTO_EM_CURSO,
  ERRO_INTERNO,
  mockApi,
  titulo,
  principal,
  abrirFormulario,
  preencherObrigatorios,
} from '../support/instituicao-escritas';

test.describe('Instituição — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('edição pendente preserva foco e valores, recusa reenvio e a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 422, corpo: RECUSA_DO_CNPJ }]);
    const { formulario } = await abrirFormulario(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    const cnpj = formulario.locator('input[formcontrolname="cnpj"]');
    await nome.fill('Universidade revisada');
    await formulario.getByRole('button', { name: 'Salvar instituição' }).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Universidade revisada');
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
    expect(envios).toEqual(['PUT']);
    liberar();
    await expect(nome).toBeEnabled();
    await expect(cnpj).toBeFocused();
    await expect(cnpj).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('CNPJ fora do padrão.')).toBeVisible();
  });

  test('falha geral no salvamento mantém o foco no botão de salvar', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 500, corpo: ERRO_INTERNO }]);
    const { formulario } = await abrirFormulario(page);
    await formulario.getByRole('button', { name: 'Salvar instituição' }).click();
    liberar();
    await expect(formulario.getByText('Falha ao gravar a instituição')).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Salvar instituição' })).toBeFocused();
  });

  test('segunda criação mostra o aviso e renova a chave; processamento em curso a mantém', async ({
    page,
  }) => {
    const { liberar, chaves } = await mockApi(
      page,
      [
        { status: 409, corpo: PROCESSAMENTO_EM_CURSO },
        { status: 409, corpo: JA_EXISTE },
        { status: 409, corpo: JA_EXISTE },
      ],
      { cadastrada: false },
    );
    const { formulario } = await abrirFormulario(page);
    await preencherObrigatorios(formulario);
    const salvar = formulario.getByRole('button', { name: 'Salvar instituição' });
    await salvar.click();
    liberar();
    await expect(
      formulario.getByText('A requisição anterior ainda está em processamento'),
    ).toBeVisible();
    await expect(salvar).toBeFocused();
    await salvar.click();
    await expect(
      formulario.getByText('Já existe uma instituição cadastrada nesta instância'),
    ).toBeVisible();
    await expect(salvar).toBeFocused();
    expect(chaves).toHaveLength(2);
    expect(chaves[1]).toBe(chaves[0]);
    await expect(salvar).not.toHaveAttribute('aria-disabled', 'true');
    await salvar.click();
    await expect.poll(() => chaves.length).toBe(3);
    expect(chaves[2]).not.toBe(chaves[1]);
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 500, corpo: ERRO_INTERNO }]);
    const { formulario } = await abrirFormulario(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.getByText('Falha ao gravar a instituição')).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(formulario.getByRole('button', { name: 'Salvar instituição' })).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 201, corpo: 'novo-id' }], {
      cadastrada: false,
    });
    const { formulario } = await abrirFormulario(page);
    await formulario.locator('[formControlName="sigla"]').fill(INSTITUICAO.sigla);
    await formulario.getByRole('button', { name: 'Salvar instituição' }).focus();
    await page.keyboard.press('Enter');
    await expect(formulario.locator('[formControlName="nome"]')).toBeFocused();
    expect(envios).toEqual([]);
  });

  test('recusa só do endereço leva o foco à mensagem no bloco do endereço', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 422, corpo: RECUSA_DO_ENDERECO }]);
    const { formulario } = await abrirFormulario(page);
    await page.locator('#inst-endereco-cep').fill('68507590');
    await page.getByRole('button', { name: 'Buscar CEP' }).click();
    await expect(page.locator('#inst-endereco-logradouro')).toHaveValue('Rua Folha 31, Quadra 7');
    await formulario.getByRole('button', { name: 'Salvar instituição' }).click();
    liberar();
    const mensagem = formulario.locator('ui-endereco-geo .field__error');
    await expect(mensagem).toHaveText('A cidade não corresponde ao CEP informado.');
    await expect(mensagem).toBeFocused();
    await expect(formulario.locator('ui-endereco-geo fieldset')).toHaveAttribute(
      'aria-describedby',
      (await mensagem.getAttribute('id')) ?? '',
    );
  });

  test('cancelar o formulário devolve o foco ao acionador sem enviar', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 204 }]);
    const { acionador, formulario } = await abrirFormulario(page);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(acionador).toBeFocused();
    expect(envios).toEqual([]);
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }]);
    const { acionador, formulario } = await abrirFormulario(page);
    await formulario.getByRole('button', { name: 'Salvar instituição' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(acionador).toHaveAttribute('aria-disabled', 'true');
    await expect(acionador).not.toHaveAttribute('aria-disabled', 'true');
    await expect(acionador).toBeFocused();
  });

  test('edição concluída, com falha na recarga, leva o foco ao título da página', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], { recarga: 'com-falha' });
    const { formulario } = await abrirFormulario(page);
    await formulario.getByRole('button', { name: 'Salvar instituição' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('cadastro concluído devolve o foco ao botão que passou a editar', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 201, corpo: 'novo-id' }], {
      cadastrada: false,
    });
    const { formulario } = await abrirFormulario(page);
    await preencherObrigatorios(formulario);
    await formulario.getByRole('button', { name: 'Salvar instituição' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(principal(page)).toContainText('Editar');
    await expect(principal(page)).toBeFocused();
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [{ status: 204 }], { primeiraConsulta: 'falha' });
    await page.goto('/instituicao');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(principal(page)).toContainText('Editar');
    await expect(titulo(page)).toBeFocused();
  });
});
