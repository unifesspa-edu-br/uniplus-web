import { expect, type Page } from '@playwright/test';

/**
 * Abre o bloco "Filtros" da lista, que chega recolhido: os filtros por categoria só ficam
 * clicáveis com ele aberto. O nome acessível do botão começa por "Filtros" e segue com o resumo
 * dos filtros ativos.
 */
export async function abrirFiltros(page: Page): Promise<void> {
  const alternar = page.getByRole('button', { name: /^Filtros,/ });
  await expect(alternar).toHaveAttribute('aria-expanded', 'false');
  await alternar.click();
  await expect(alternar).toHaveAttribute('aria-expanded', 'true');
}
