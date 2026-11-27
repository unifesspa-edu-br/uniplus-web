import { expect, type Locator, type Page } from '@playwright/test';
import { BASE_DA_LISTA, MARABA, TIPO_PORTARIA } from './api-da-base-legal-do-fada';

export const titulo = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Bases legais', level: 2 });
export const novo = (page: Page): Locator => page.getByRole('button', { name: 'Nova base legal' });
export const editar = (page: Page): Locator =>
  page.getByRole('button', {
    name: `Editar base legal ${BASE_DA_LISTA.identificacao}`,
    exact: true,
  });
export const lixeira = (page: Page): Locator =>
  page.getByRole('button', {
    name: `Remover base legal do Fator de Atenuação ${BASE_DA_LISTA.identificacao}`,
    exact: true,
  });
export const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de base legal do Fator de Atenuação' });
export const confirmacao = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Remover base legal' });
export const busca = (formulario: Locator): Locator =>
  formulario.getByRole('combobox', { name: /^Municípios/ });

export const tipoDoInstrumento = (formulario: Locator): Locator =>
  formulario.getByRole('combobox', { name: 'Tipo de instrumento' });
export const campoDaIdentificacao = (formulario: Locator): Locator =>
  formulario.getByRole('textbox', { name: /^Identificação/ });
export const campoDaDescricao = (formulario: Locator): Locator =>
  formulario.getByRole('textbox', { name: /^Descrição/ });

export async function preencherBaseLegal(page: Page, identificacao: string, descricao: string) {
  await novo(page).click();
  const formulario = drawer(page);
  await tipoDoInstrumento(formulario).selectOption({ label: TIPO_PORTARIA.rotulo });
  await campoDaIdentificacao(formulario).fill(identificacao);
  await campoDaDescricao(formulario).fill(descricao);
}

export async function escolherMaraba(page: Page) {
  await page.getByRole('combobox', { name: /^Municípios/ }).fill('Marabá');
  await page.getByRole('option', { name: /Marabá \(PA\)/ }).click();
  await expect(page.getByRole('button', { name: 'Remover Marabá' })).toBeVisible();
}

export function verificarBaseLegalCriada(enviada: unknown) {
  expect(enviada).toMatchObject({
    tipoInstrumento: TIPO_PORTARIA.codigo,
    identificacao: BASE_DA_LISTA.identificacao,
    municipios: [{ codigoIbge: MARABA.codigoIbge, nome: MARABA.nome, uf: MARABA.uf }],
  });
}

export async function abrirConfirmacaoDaRemocao(page: Page) {
  await page
    .getByRole('button', {
      name: `Remover base legal do Fator de Atenuação ${BASE_DA_LISTA.identificacao}`,
      exact: true,
    })
    .click();
  const dialogo = page.locator('dialog.uni-dialog');
  await expect(dialogo).toBeVisible();
  return dialogo;
}

export async function verificarAvisoDoTipoNoFormulario(formulario: Locator) {
  const aviso = formulario.locator('ui-alerta-nova-tentativa');
  await expect(aviso).toContainText('sem o vocabulário de tipos');
  await expect(tipoDoInstrumento(formulario)).toHaveAttribute(
    'aria-describedby',
    'cfg-blbr-tipos-falha',
  );
  return aviso;
}

export async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/bases-legais-fada');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await tipoDoInstrumento(formulario).selectOption({ label: TIPO_PORTARIA.rotulo });
  await campoDaIdentificacao(formulario).fill('Nova portaria');
  await campoDaDescricao(formulario).fill('Descrição da portaria.');
  await busca(formulario).fill('Marabá');
  await formulario.getByRole('option', { name: /Marabá \(PA\)/ }).click();
  await expect(formulario.getByRole('button', { name: 'Remover Marabá' })).toBeVisible();
  return formulario;
}

export async function pesquisarBelemEApertarEnter(formulario: Locator): Promise<void> {
  await busca(formulario).fill('Belém');
  await busca(formulario).press('Enter');
}

export async function verificarCadastroAberto(formulario: Locator): Promise<void> {
  await expect(formulario).toBeVisible();
  await expect(formulario.getByRole('button', { name: 'Remover Marabá' })).toBeVisible();
}

export async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/bases-legais-fada');
  await editar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  return formulario;
}

export async function abrirRemocao(page: Page) {
  await page.goto('/bases-legais-fada');
  await lixeira(page).click();
  const dialogo = confirmacao(page);
  return { dialogo, remover: dialogo.getByRole('button', { name: 'Remover', exact: true }) };
}
