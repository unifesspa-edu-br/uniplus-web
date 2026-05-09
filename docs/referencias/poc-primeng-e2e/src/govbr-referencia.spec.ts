import { test, expect } from '@playwright/test';

import { join } from 'path';

const screenshotsDir = join(__dirname, '..', 'screenshots');

/**
 * Captura screenshots de referência do Gov.br Design System oficial.
 * Mesmo protocolo das PoCs Spartan e Zard.
 */
test.describe('Referência Gov.br DS — Screenshots oficiais', () => {
  const referencias = [
    { nome: 'cores', url: 'https://www.gov.br/ds/fundamentos-visuais/cores' },
    { nome: 'tipografia', url: 'https://www.gov.br/ds/fundamentos-visuais/tipografia' },
    { nome: 'button', url: 'https://www.gov.br/ds/components/button' },
    { nome: 'input', url: 'https://www.gov.br/ds/components/input' },
    { nome: 'select', url: 'https://www.gov.br/ds/components/select' },
    { nome: 'radio', url: 'https://www.gov.br/ds/components/radio' },
    { nome: 'checkbox', url: 'https://www.gov.br/ds/components/checkbox' },
    { nome: 'tab', url: 'https://www.gov.br/ds/components/tab' },
    { nome: 'table', url: 'https://www.gov.br/ds/components/table' },
    { nome: 'modal', url: 'https://www.gov.br/ds/components/modal' },
    { nome: 'message', url: 'https://www.gov.br/ds/components/message' },
    { nome: 'header', url: 'https://www.gov.br/ds/components/header' },
  ];

  for (const ref of referencias) {
    test(`capturar referência: ${ref.nome}`, async ({ page }) => {
      // goto já aguarda o evento 'load' por padrão; páginas estáticas do Gov.br DS não precisam de espera adicional.
      const response = await page.goto(ref.url);
      expect(response?.ok(), `Falha ao carregar ${ref.url}`).toBeTruthy();
      await page.screenshot({
        path: `${screenshotsDir}/ref-govbr-${ref.nome}.png`,
        fullPage: true,
      });
    });
  }
});
