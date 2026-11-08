import { expect, test, type Page } from '@playwright/test';
import { simularCampi, simularOfertas } from '../support/respostas-lentas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Roteiro de avaliação humana do aviso de falha de leitura (o passo a passo está em
 * `leitura-acompanhada.flow.spec.ts`). Só existe com `AVALIACAO_HUMANA=1`, e exige o navegador
 * visível (`--headed`): em modo headless o teste falha de imediato, dizendo isso.
 */
const TEMPO_DA_AVALIACAO_EM_MS = 30 * 60_000;

/** Mantém o navegador aberto até a pessoa fechar a página ou o tempo da avaliação acabar. */
async function aguardarAPessoaFecharAPagina(page: Page): Promise<void> {
  await page.waitForEvent('close', { timeout: TEMPO_DA_AVALIACAO_EM_MS });
}

function declararAvaliacaoHumana(): void {
  test.describe('Aviso de falha de leitura — avaliação humana', () => {
    test.beforeEach(({ headless }) => {
      expect(headless, 'A avaliação humana precisa do navegador visível: rode com --headed.').toBe(
        false,
      );
      test.setTimeout(TEMPO_DA_AVALIACAO_EM_MS + 60_000);
    });

    test('tela dos campi com respostas lentas para ser conduzida com leitor de tela', async ({
      page,
    }) => {
      await mockConfiguracaoRuntimeConfig(page);
      await simularCampi(page, 'sucesso');
      await page.goto('/campi');
      await expect(page).toHaveURL(/\/campi/);

      await aguardarAPessoaFecharAPagina(page);
    });

    test('campo em drawer e aviso dos catálogos com respostas lentas para ser conduzidos com leitor de tela', async ({
      page,
    }) => {
      await mockConfiguracaoRuntimeConfig(page);
      await simularOfertas(page);
      await page.goto('/ofertas-curso');
      await expect(page).toHaveURL(/\/ofertas-curso/);

      await aguardarAPessoaFecharAPagina(page);
    });
  });
}

if (process.env['AVALIACAO_HUMANA'] === '1') declararAvaliacaoHumana();
