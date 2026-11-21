import { expect, type Locator, type Page } from '@playwright/test';
import { BASE_DA_LISTA, TIPO_PORTARIA } from './api-da-base-legal-bonus-regional';

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
    name: `Remover base legal de bônus regional ${BASE_DA_LISTA.identificacao}`,
    exact: true,
  });
export const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de base legal de bônus regional' });
export const confirmacao = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Remover base legal' });
export const busca = (formulario: Locator): Locator =>
  formulario.getByPlaceholder('Digite o nome completo do município…');

export const tipoDoInstrumento = (formulario: Locator): Locator =>
  formulario.getByRole('combobox', { name: 'Tipo de instrumento' });
export const campoDaIdentificacao = (formulario: Locator): Locator =>
  formulario.getByRole('textbox', { name: /^Identificação/ });
export const campoDaDescricao = (formulario: Locator): Locator =>
  formulario.getByRole('textbox', { name: /^Descrição/ });

export async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/base-legal-bonus-regional');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await tipoDoInstrumento(formulario).selectOption({ label: TIPO_PORTARIA.rotulo });
  await campoDaIdentificacao(formulario).fill('Nova portaria');
  await campoDaDescricao(formulario).fill('Descrição da portaria.');
  await busca(formulario).fill('Marabá');
  await formulario.getByRole('button', { name: /Marabá — PA/ }).click();
  await expect(formulario.getByRole('button', { name: 'Remover Marabá' })).toBeVisible();
  return formulario;
}

export async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/base-legal-bonus-regional');
  await editar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  return formulario;
}

export async function abrirRemocao(page: Page) {
  await page.goto('/base-legal-bonus-regional');
  await lixeira(page).click();
  const dialogo = confirmacao(page);
  return { dialogo, remover: dialogo.getByRole('button', { name: 'Remover', exact: true }) };
}
