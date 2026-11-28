import { expect, test } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import {
  ERICK,
  HELENA,
  arquivoDeEnvio,
  retornoSemUmInscrito,
} from '../fixtures/arquivo-do-inep-sintetico';
import {
  ROTA_DA_TELA,
  envio,
  lote,
  problema,
  processo,
  simularApi,
  snapshotVigente,
  texto,
} from '../fixtures/notas-do-enem';
import {
  INSCRITAS,
  abrir,
  cartaoDeEnvio,
  cartaoDeImportacao,
  escolherArquivo,
  escolherEdicao,
  escolherLeiauteDeRetorno,
  identificadoresDe,
  semNenhumCpfNaTela,
} from '../support/passos-da-tela-de-notas-do-enem';

/** Tela de notas do ENEM do processo (UNI-REQ-0174), com a API simulada: o CI do frontend sobe o
 * Keycloak, mas não a API. Os arquivos são gerados das personas fictícias do portal. */

test.describe('Notas do ENEM do processo', () => {
  test('sem edição os botões ficam desabilitados com o motivo, e nenhum POST sai', async ({
    page,
  }) => {
    const registro = await simularApi(page);
    await abrir(page);

    const baixar = cartaoDeEnvio(page).getByRole('button', { name: 'Baixar arquivo de envio' });
    await expect(baixar).toBeDisabled();
    await expect(baixar).toHaveAccessibleDescription(
      'Escolha a edição do ENEM para gerar o arquivo de envio.',
    );
    const importar = cartaoDeImportacao(page).getByRole('button', { name: 'Importar notas' });
    await expect(importar).toBeDisabled();
    await expect(importar).toHaveAccessibleDescription(/Escolha a edição do ENEM para importar\./);
    await expect(page.getByRole('heading', { name: 'Envios gerados desta edição' })).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Importações de notas desta edição' }),
    ).toHaveCount(0);

    expect(registro.envios).toEqual([]);
    expect(registro.importacoes).toEqual([]);
  });

  test('cada cartão tem a própria edição: escolher uma não muda a outra', async ({ page }) => {
    await simularApi(page);
    await abrir(page);

    await escolherEdicao(cartaoDeEnvio(page), 'Envios gerados desta edição', '2024');

    await expect(cartaoDeEnvio(page).getByLabel('Edição do ENEM')).toHaveValue('2024');
    await expect(cartaoDeImportacao(page).getByLabel('Edição do ENEM')).toHaveValue('');
    await expect(
      cartaoDeImportacao(page).getByRole('button', { name: 'Importar notas' }),
    ).toBeDisabled();
    await expect(
      page.getByRole('heading', { name: 'Importações de notas desta edição' }),
    ).toHaveCount(0);
  });

  test('baixa o arquivo de envio só com os CPFs das personas inscritas', async ({ page }) => {
    const registro = await simularApi(page, { gerarEnvio: texto(arquivoDeEnvio(INSCRITAS)) });
    await abrir(page);
    await escolherEdicao(cartaoDeEnvio(page), 'Envios gerados desta edição');

    const download = page.waitForEvent('download');
    await cartaoDeEnvio(page).getByRole('button', { name: 'Baixar arquivo de envio' }).click();
    const arquivo = await download;

    expect(arquivo.suggestedFilename()).toBe('medicina-2027-envio-2025.txt');
    const caminho = await arquivo.path();
    const { readFile } = await import('node:fs/promises');
    const linhas = (await readFile(caminho, 'utf-8')).trim().split('\n');
    expect(linhas).toEqual(INSCRITAS.map((pessoa) => pessoa.cpf));
    expect(JSON.parse(registro.envios[0])).toEqual({
      leiauteCodigo: 'ENVIO_CPF',
      leiauteVersao: 'v1',
    });
    await expect(
      page.getByText('Arquivo de envio gerado com 3 CPFs. Verifique a pasta de downloads.'),
    ).toBeVisible();
    await semNenhumCpfNaTela(page);
  });

  test('edição sem inscritos é um aviso orientador, não um erro', async ({ page }) => {
    await simularApi(page, {
      gerarEnvio: problema(422, 'edicao_sem_inscritos', 'Edição sem inscritos'),
    });
    await abrir(page);
    await escolherEdicao(cartaoDeEnvio(page), 'Envios gerados desta edição');

    await cartaoDeEnvio(page).getByRole('button', { name: 'Baixar arquivo de envio' }).click();

    const aviso = page.getByRole('alert').filter({ hasText: 'Não há o que enviar ao INEP.' });
    await expect(aviso).toContainText(
      'Gere o arquivo depois que os candidatos enviarem as inscrições.',
    );
    await expect(aviso).toHaveClass(/alert--warning/);
  });

  test('os históricos de cada cartão dizem quem gerou e quem importou', async ({ page }) => {
    await simularApi(page, { envios: [envio()], lotes: [lote({ ocorrencias: null })] });
    await abrir(page);
    await escolherEdicao(cartaoDeEnvio(page), 'Envios gerados desta edição');
    await escolherEdicao(cartaoDeImportacao(page), 'Importações de notas desta edição');

    await expect(cartaoDeEnvio(page).getByRole('row', { name: /Diogo Souza/ })).toContainText('3');
    await expect(cartaoDeImportacao(page).getByRole('row', { name: /Diogo Souza/ })).toContainText(
      'Vigente',
    );
  });

  test('"Ver ocorrências" abre as ocorrências de um lote do histórico', async ({ page }) => {
    await simularApi(page, { lotes: [lote({ ocorrencias: null, ausentes: null })] });
    await abrir(page);
    await escolherEdicao(cartaoDeImportacao(page), 'Importações de notas desta edição');

    await cartaoDeImportacao(page)
      .getByRole('button', { name: /^Ver ocorrências/ })
      .click();

    await expect(page.getByRole('heading', { name: 'Ocorrências da importação' })).toBeFocused();
    await cartaoDeImportacao(page)
      .getByRole('tab', { name: /^Linhas sem inscrito/ })
      .click();
    await expect(cartaoDeImportacao(page).getByRole('tabpanel')).toContainText(ERICK.nome);
  });

  test('o processo em rascunho explica que falta divulgar', async ({ page }) => {
    await simularApi(page, { processo: processo({ status: 'rascunho' }) });
    await abrir(page);

    await expect(page.getByText('O processo ainda não foi divulgado')).toBeVisible();
    await expect(page.getByLabel('Edição do ENEM')).toHaveCount(0);
  });

  test('o processo sem etapa de nota do ENEM diz que não há onde importar', async ({ page }) => {
    await simularApi(page, { snapshot: snapshotVigente({ etapaDoEnem: false }) });
    await abrir(page);

    await expect(page.getByText('Este processo não tem etapa de nota do ENEM')).toBeVisible();
  });

  test('com a API fora do ar a leitura do processo falha com saída para tentar de novo', async ({
    page,
  }) => {
    await simularApi(page, { semApi: true });
    await page.goto(ROTA_DA_TELA);

    await expect(
      page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o processo seletivo' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar novamente' }).first()).toBeVisible();
  });

  test('não viola WCAG 2.1 AA nos estados da tela', async ({ page }) => {
    await simularApi(page, {
      gerarEnvio: problema(422, 'edicao_sem_inscritos', 'Edição sem inscritos'),
      envios: [envio()],
      lotes: [lote({ ocorrencias: null })],
    });
    await abrir(page);
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);

    await escolherEdicao(cartaoDeEnvio(page), 'Envios gerados desta edição');
    await cartaoDeEnvio(page).getByRole('button', { name: 'Baixar arquivo de envio' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Não há o que enviar' })).toBeVisible();
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);

    await escolherEdicao(cartaoDeImportacao(page), 'Importações de notas desta edição');
    await escolherLeiauteDeRetorno(page);
    await escolherArquivo(page, 'retorno-inep-2025.txt', retornoSemUmInscrito(INSCRITAS, HELENA));
    await cartaoDeImportacao(page).getByRole('button', { name: 'Importar notas' }).click();
    await expect(
      cartaoDeImportacao(page).getByRole('heading', { name: 'Resultado da importação' }),
    ).toBeVisible();
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);

    for (const aba of [/^Ausentes/, /^Linhas sem inscrito/, /^Conflitos/]) {
      await cartaoDeImportacao(page).getByRole('tab', { name: aba }).click();
      expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
    }
  });
});
