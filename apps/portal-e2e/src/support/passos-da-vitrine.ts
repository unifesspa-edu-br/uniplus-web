import { expect, type Locator, type Page } from '@playwright/test';

export async function conferirCertameAberto(page: Page, nome: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Processos seletivos', level: 1 })).toBeVisible();
  await expect(page.locator('.certames-loading')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: nome, level: 3 })).toBeVisible();
}

export async function conferirPublicacoesCompletas(painel: Locator, url: string): Promise<void> {
  await expect(painel.getByRole('heading', { level: 4, name: 'Edital de abertura' })).toBeVisible();
  await expect(painel.getByText('Documento principal')).toBeVisible();
  await expect(painel.getByText('Anexos (1)')).toBeVisible();
  await expect(painel.getByRole('link', { name: /^edital-020-2026\.pdf/ })).toHaveAttribute(
    'href',
    url,
  );
  await expect(painel.getByText('Nenhuma publicação ainda')).toHaveCount(0);
}

export async function conferirVitrinePopulada(page: Page, nomes: string[]): Promise<void> {
  await expect(page.locator('.portal-hero')).toBeVisible();
  for (const nome of nomes) {
    await expect(page.getByRole('heading', { name: nome, level: 3 })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: /Ver edital/ })).toHaveCount(nomes.length);
  await expect(page.locator('.filter-chip__count')).toHaveText(['1', '1', '1', '1']);
  await expect(page.getByText('Nenhum certame publicado no momento')).toHaveCount(0);
}

export async function conferirAvisoDeAutenticacao(page: Page): Promise<void> {
  const aviso = page.locator('auth-error-banner [role="alert"]');
  await expect(aviso).toContainText('Serviço de autenticação indisponível');
  await expect(aviso.locator('.u-caption')).toBeVisible();
}
