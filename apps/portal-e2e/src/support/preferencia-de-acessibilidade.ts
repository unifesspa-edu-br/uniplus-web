import { expect, type Page } from '@playwright/test';

export type TemaDaMatriz = 'light' | 'dark' | 'contrast';
export type FonteDaMatriz = 'default' | 'legible';

export interface PreferenciaDaMatriz {
  readonly tema: TemaDaMatriz;
  readonly fonte: FonteDaMatriz;
}

/** O nome do projeto da matriz tem a forma `aaa-<largura>-<tema>-<fonte>`. */
export function preferenciaDoProjeto(nomeDoProjeto: string): PreferenciaDaMatriz {
  const partes = nomeDoProjeto.split('-');
  return {
    tema: partes[2] === 'dark' || partes[2] === 'contrast' ? partes[2] : 'light',
    fonte: partes[3] === 'legible' ? 'legible' : 'default',
  };
}

/** Grava, antes de a página carregar, a preferência de acessibilidade que o portal lê ao iniciar. */
export async function instalarPreferencia(page: Page, dados: PreferenciaDaMatriz): Promise<void> {
  await page.addInitScript(({ tema, fonte }) => {
    const alto = tema === 'contrast';
    const valor = { theme: alto ? 'auto' : tema, contrast: alto, fontMode: fonte };
    window.localStorage.setItem('uniplus.a11y', JSON.stringify(valor));
  }, dados);
}

/** Confere que o portal aplicou o tema e o modo de fonte pedidos antes de a página ser medida. */
export async function conferirPreferenciaAplicada(
  page: Page,
  { tema, fonte }: PreferenciaDaMatriz,
): Promise<void> {
  const raiz = page.locator('html');
  await expect(raiz).toHaveAttribute('data-theme', tema);
  if (fonte === 'legible') {
    await expect(raiz).toHaveAttribute('data-font-mode', 'legible');
  } else {
    await expect(raiz).not.toHaveAttribute('data-font-mode', 'legible');
  }
}
