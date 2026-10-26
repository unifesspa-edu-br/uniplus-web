import { readFile } from 'node:fs/promises';
import type { Locator } from '@playwright/test';
import { expect, test } from '../fixtures/auth.fixture';
import {
  ERICK,
  FERNANDA,
  arquivoDeRetorno,
  linha,
  linhaDe23Campos,
} from '../fixtures/arquivo-do-inep-sintetico';

/**
 * Envio ao INEP e importação das notas do ENEM contra a API real, sem simulação. Roda só com
 * `E2E_BACKEND_REAL=1`, a stack do `uniplus-api` no ar e `E2E_PROCESSO_ID` apontando um processo já
 * divulgado, com a etapa de nota do ENEM, as edições declaradas e inscrições enviadas das
 * personas fictícias (`scripts/roteiro-processo-teste-notas-do-enem.sh` da uniplus-api, que
 * imprime o id). Sem `E2E_PROCESSO_ID` o teste falha dizendo o que falta, em vez de passar sem ter
 * conferido nada.
 *
 * ```bash
 * E2E_BACKEND_REAL=1 E2E_PROCESSO_ID=<id> \
 *   npx playwright test -c apps/selecao-e2e/playwright.config.ts --project=selecao-backend-real
 * ```
 *
 * `E2E_EDICAO` indica a edição que as inscrições escolheram (padrão 2025).
 */
const PROCESSO_ID = process.env['E2E_PROCESSO_ID'] ?? '';
const EDICAO = process.env['E2E_EDICAO'] ?? '2025';

test.describe('Notas do ENEM contra a API real', () => {
  test.beforeAll(() => {
    if (PROCESSO_ID === '') {
      throw new Error(
        'Defina E2E_PROCESSO_ID com o processo que o roteiro de teste das notas do ENEM criou.',
      );
    }
  });

  test('baixa o envio, importa o retorno e recusa o arquivo fora do leiaute', async ({ page }) => {
    await page.goto(`/processo-seletivo/${PROCESSO_ID}/notas-do-enem`);
    await expect(page.getByRole('heading', { level: 1, name: 'Notas do ENEM' })).toBeVisible();
    const envio = page.getByRole('region', { name: 'Enviar CPFs ao INEP' });
    const importacao = page.getByRole('region', { name: 'Importar o retorno do INEP' });

    // Envio: o arquivo traz os CPFs das inscrições da edição, um por linha, sem repetir.
    await envio.getByLabel('Edição do ENEM').selectOption(EDICAO);
    await escolherLeiauteSeHouverOpcoes(envio, 'Leiaute do arquivo de envio');
    const download = page.waitForEvent('download');
    await envio.getByRole('button', { name: 'Baixar arquivo de envio' }).click();
    const arquivo = await download;
    expect(arquivo.suggestedFilename()).toMatch(new RegExp(`-envio-${EDICAO}\\.txt$`));
    const cpfs = (await readFile(await arquivo.path(), 'utf-8')).trim().split('\n');
    expect(cpfs.length).toBeGreaterThan(0);
    expect(cpfs.every((cpf) => /^\d{11}$/.test(cpf))).toBe(true);
    expect(new Set(cpfs).size).toBe(cpfs.length);
    // A linha sem inscrito precisa de alguém que não se inscreveu nesta edição.
    expect(cpfs).not.toContain(ERICK.cpf);

    // Retorno: todos os CPFs do envio presentes e uma pessoa não inscrita, que vira linha sem inscrito.
    const presentes = cpfs.map((cpf, indice) => linha(FERNANDA, indice + 1, cpf));
    const linhaDoErick = presentes.length + 1;
    const linhas = [...presentes, linha(ERICK, linhaDoErick)];
    await importacao.getByLabel('Edição do ENEM').selectOption(EDICAO);
    await escolherLeiauteSeHouverOpcoes(importacao, 'Leiaute do arquivo de retorno');
    await importacao.locator('input[type="file"]').setInputFiles({
      name: 'retorno-inep-sintetico.txt',
      mimeType: 'text/plain',
      buffer: arquivoDeRetorno(linhas),
    });
    await importacao.getByRole('button', { name: 'Importar notas' }).click();
    await expect(
      importacao.getByRole('heading', { name: 'Resultado da importação' }),
    ).toBeVisible();
    await importacao.getByRole('tab', { name: /Linhas sem inscrito/ }).click();
    const linhaSemInscrito = importacao.getByRole('tabpanel').getByRole('row').nth(1);
    await expect(linhaSemInscrito).toContainText(String(linhaDoErick));
    await expect(linhaSemInscrito).toContainText(ERICK.nome);
    await expect(linhaSemInscrito).toContainText('Masculino');
    await expect(linhaSemInscrito).toContainText(cpfMascarado(ERICK.cpf));
    await expect(importacao.getByText(ERICK.cpf)).toHaveCount(0);

    // Arquivo de 23 campos com o leiaute de 20: recusado inteiro, nada gravado.
    await importacao.locator('input[type="file"]').setInputFiles({
      name: 'retorno-inep-23-campos.txt',
      mimeType: 'text/plain',
      buffer: arquivoDeRetorno(
        cpfs.map((cpf, indice) => linhaDe23Campos(FERNANDA, indice + 1, cpf)),
      ),
    });
    await importacao.getByRole('button', { name: 'Importar notas' }).click();
    const alerta = importacao.getByRole('alert').filter({ hasText: 'Arquivo recusado' });
    await expect(alerta).toContainText('nenhuma nota foi gravada');
    await expect(alerta).toContainText('Envie o arquivo exatamente como o INEP o devolveu');
  });
});

/** Com um só leiaute ativo a tela já o escolhe e o mostra como texto; com mais, escolhe o primeiro. */
async function escolherLeiauteSeHouverOpcoes(card: Locator, rotulo: string): Promise<void> {
  const campo = card.getByLabel(rotulo);
  if ((await campo.count()) > 0) await campo.selectOption({ index: 1 });
}

/** A máscara da tela: oculta os três primeiros dígitos e os verificadores. */
function cpfMascarado(cpf: string): string {
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}
