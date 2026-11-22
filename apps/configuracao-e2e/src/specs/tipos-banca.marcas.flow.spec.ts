import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import {
  mockarTiposDeBanca,
  TIPO_ENTREVISTA,
  TIPO_HETEROIDENTIFICACAO,
  type EscritasDosTiposDeBanca,
} from '../support/api-dos-tipos-de-banca';
import { PERMISSOES_DE_QUEM_ADMINISTRA_OS_TIPOS_DE_BANCA } from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * As marcas do tipo de banca no cadastro (UNI-REQ-0476): "exige duas ou mais bancas" e "encerra o
 * recurso na 1ª instância", com o papel e os tipos de decisão que o tipo julga. O aviso diz que
 * mudar a marca não altera processo já configurado: cada processo guarda a cópia do tipo.
 *
 * A API é servida por rota e autenticação é a do projeto `fluxo-chromium`; a pessoa que administra o
 * cadastro tem só a permissão de manter tipos de banca.
 */

const AVISO_DA_COPIA =
  /Mudar a marca não altera processo já configurado: cada processo guarda a cópia do tipo\./;

const formulario = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de tipo de banca' });
const exigeDuasOuMais = (drawer: Locator): Locator =>
  drawer.getByRole('checkbox', { name: 'Exige duas ou mais bancas' });
const encerraNaPrimeira = (drawer: Locator): Locator =>
  drawer.getByRole('checkbox', { name: 'Encerra o recurso na 1ª instância' });

async function abrirEdicao(page: Page, rotulo: string): Promise<Locator> {
  await page.goto('/tipos-banca');
  await page.getByRole('button', { name: `Editar tipo de banca ${rotulo}`, exact: true }).click();
  const drawer = formulario(page);
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('#cfg-papel')).toHaveValue(/\w/);
  return drawer;
}

test.describe('Tipos de banca — marcas do tipo', () => {
  let escritas: EscritasDosTiposDeBanca;

  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DE_QUEM_ADMINISTRA_OS_TIPOS_DE_BANCA);
    escritas = await mockarTiposDeBanca(page, [TIPO_ENTREVISTA, TIPO_HETEROIDENTIFICACAO]);
  });

  test('a lista mostra as marcas de cada tipo em texto', async ({ page }) => {
    await page.goto('/tipos-banca');

    const heteroidentificacao = page.locator(
      `tr[data-tipo-banca-id="${TIPO_HETEROIDENTIFICACAO.id}"]`,
    );
    await expect(heteroidentificacao.getByText('Exige duas ou mais bancas.')).toBeVisible();
    await expect(heteroidentificacao.getByText('Encerra o recurso na 1ª instância.')).toBeVisible();
    const entrevista = page.locator(`tr[data-tipo-banca-id="${TIPO_ENTREVISTA.id}"]`);
    await expect(entrevista.locator('td[data-label="Marcas"]')).toHaveText('—');
  });

  test('o tipo de heteroidentificação abre com as duas marcas preenchidas e o aviso da cópia', async ({
    page,
  }) => {
    const drawer = await abrirEdicao(page, TIPO_HETEROIDENTIFICACAO.codigo.rotulo);

    await expect(exigeDuasOuMais(drawer)).toBeChecked();
    await expect(encerraNaPrimeira(drawer)).toBeChecked();
    await expect(drawer.locator('#cfg-papel')).toHaveValue('AVALIA_O_MERITO');
    await expect(drawer.getByRole('checkbox', { name: 'Gabarito da prova' })).toBeChecked();
    await expect(drawer.getByText(AVISO_DA_COPIA)).toBeVisible();
    await expect(exigeDuasOuMais(drawer)).toHaveAccessibleDescription(
      /Este tipo exige a criação de duas ou mais bancas/,
    );
    await expect(encerraNaPrimeira(drawer)).toHaveAccessibleDescription(
      /O recurso deste tipo termina na primeira instância/,
    );
  });

  test('marcar as duas marcas no tipo sem marca as envia, sem o código', async ({ page }) => {
    const drawer = await abrirEdicao(page, TIPO_ENTREVISTA.codigo.rotulo);
    await expect(exigeDuasOuMais(drawer)).not.toBeChecked();

    await exigeDuasOuMais(drawer).check();
    await encerraNaPrimeira(drawer).check();
    await drawer.getByRole('button', { name: 'Salvar tipo de banca' }).click();

    await expect.poll(() => escritas.envios.length).toBe(1);
    const [envio] = escritas.envios;
    expect(envio.id).toBe(TIPO_ENTREVISTA.id);
    expect(envio.corpo).toMatchObject({
      exigeDuasOuMaisBancas: true,
      encerraRecursoNaPrimeiraInstancia: true,
      papel: 'AVALIA_O_MERITO',
      tiposDeDecisaoJulgados: [],
    });
    expect(envio.corpo).not.toHaveProperty('codigo');
  });

  test('retirar as marcas do tipo de heteroidentificação as envia desmarcadas e mantém as decisões', async ({
    page,
  }) => {
    const drawer = await abrirEdicao(page, TIPO_HETEROIDENTIFICACAO.codigo.rotulo);

    await exigeDuasOuMais(drawer).uncheck();
    await encerraNaPrimeira(drawer).uncheck();
    await drawer.getByRole('button', { name: 'Salvar tipo de banca' }).click();

    await expect.poll(() => escritas.envios.length).toBe(1);
    expect(escritas.envios[0].corpo).toMatchObject({
      exigeDuasOuMaisBancas: false,
      encerraRecursoNaPrimeiraInstancia: false,
      tiposDeDecisaoJulgados: ['GABARITO_DA_PROVA'],
    });
  });

  test('a recusa da API à marca aparece junto da caixa, com o texto devolvido', async ({
    page,
  }) => {
    const mensagem = 'A marca não é aceita para o papel deste tipo de banca.';
    escritas.recusa = {
      type: 'about:blank',
      title: 'Dados inválidos',
      status: 422,
      code: 'uniplus.validacao',
      errors: [
        {
          field: 'ExigeDuasOuMaisBancas',
          code: 'uniplus.configuracao.tipo_banca.marca_incompativel_com_o_papel',
          message: mensagem,
        },
      ],
    };
    const drawer = await abrirEdicao(page, TIPO_ENTREVISTA.codigo.rotulo);

    await exigeDuasOuMais(drawer).check();
    await drawer.getByRole('button', { name: 'Salvar tipo de banca' }).click();

    await expect(drawer.getByText(mensagem)).toHaveCount(1);
    await expect(exigeDuasOuMais(drawer)).toHaveAttribute('aria-invalid', 'true');
    await expect(exigeDuasOuMais(drawer)).toHaveAccessibleDescription(new RegExp(mensagem));
  });
});
