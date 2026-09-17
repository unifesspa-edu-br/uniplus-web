import { expect, test, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

/**
 * A variante terciária é a única sem caixa — fundo e borda transparentes. Numa
 * âncora só de texto, o que a distingue do corpo ao redor é apenas a cor, e o
 * SC 1.4.1 da WCAG 2.1 não aceita a cor sozinha: nas três paletas do projeto a
 * razão entre o controle e o texto vizinho fica abaixo dos 3:1 que a técnica
 * G183 pediria, e no tema de contraste `--text-primary` e `--color-primary` são
 * o mesmo `#ffff00` (#802).
 *
 * O sublinhado é a pista não-cromática, e ele se cala quando há ícone, que já
 * cumpre esse papel. Nada disso é observável por lint, teste unitário ou build:
 * só o estilo computado diz se a regra continua valendo. Sem estas asserções,
 * retirar a regra de `components.css` não acusaria em lugar nenhum.
 *
 * O formulário de novo calendário reúne as três formas numa tela só, e este
 * arquivo roda nos três temas suportados.
 */
test.describe('Botão terciário — pista não-cromática (#802)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const theme = metadataTheme(testInfo);
    await mockConfiguracaoRuntimeConfig(page);
    await page.addInitScript((dsTheme: VisualTheme) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
          contrast: dsTheme === 'contrast',
          fontMode: 'default',
        }),
      );
    }, theme);

    await page.goto('/calendario-dias-uteis/novo');
    await expect(page.getByRole('heading', { name: /calendário/i, level: 1 })).toBeVisible();
  });

  test('a âncora terciária de texto exibe sublinhado', async ({ page }, testInfo) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', metadataTheme(testInfo));

    await expect(page.getByRole('link', { name: 'Cancelar' })).toHaveCSS(
      'text-decoration-line',
      'underline',
    );
  });

  test('a âncora terciária com ícone não exibe sublinhado', async ({ page }) => {
    // O ícone já é a pista não-cromática. Sublinhar aqui também marcaria o
    // glifo: a decoração se propaga ao item flex e desenha um traço solto sob
    // o chevron, que regra nenhuma no descendente desfaz.
    await expect(page.getByRole('link', { name: 'Voltar à lista' })).toHaveCSS(
      'text-decoration-line',
      'none',
    );
  });

  test('o botão terciário não exibe sublinhado', async ({ page }) => {
    // A pista endereça a âncora, que é o caso do SC 1.4.1 descrito na #802.
    // O botão de ação permanece como o #741 e o #798 o deixaram.
    //
    // O formulário nasce sem nenhuma linha de dia não útil, então o botão de
    // remoção só existe depois de acrescentar uma.
    await page.getByRole('button', { name: 'Adicionar dia' }).click();

    await expect(page.getByRole('button', { name: /^Remover dia não útil/ }).first()).toHaveCSS(
      'text-decoration-line',
      'none',
    );
  });

  test('o sublinhado reforça no hover, como em qualquer link do sistema', async ({ page }) => {
    // `base.css` dá 1px em repouso e 2px no hover a toda âncora. Escrever a
    // regra com o atalho `text-decoration` reposicionaria `-thickness` em
    // `auto` com especificidade maior que a de `a:hover`, e o reforço sumiria
    // sem nada acusar.
    const cancelar = page.getByRole('link', { name: 'Cancelar' });
    await cancelar.hover();

    // A espessura sozinha não discrimina: `a:hover` computa 2px mesmo quando
    // não há sublinhado desenhado. É o par com a linha que prende o contrato.
    await expect(cancelar).toHaveCSS('text-decoration-line', 'underline');
    await expect(cancelar).toHaveCSS('text-decoration-thickness', '2px');
  });
});

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}
