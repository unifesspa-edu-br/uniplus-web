import { expect, test, type Locator, type Page } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';
import {
  ERICK,
  FERNANDA,
  HELENA,
  KEVIN,
  arquivoDeEnvio,
  retornoComLinhaSemInscrito,
  retornoDe23Campos,
  retornoSemUmInscrito,
} from '../fixtures/arquivo-do-inep-sintetico';
import {
  LEIAUTES,
  ROTA_DA_TELA,
  cpfMascarado,
  envio,
  json,
  lote,
  problema,
  processo,
  simularApi,
  snapshotVigente,
  texto,
} from '../fixtures/notas-do-enem';

/**
 * Tela de notas do ENEM do processo (UNI-REQ-0174), com a API simulada: o CI do frontend sobe o
 * Keycloak, mas não a API. Os arquivos de retorno são gerados das personas fictícias do portal.
 */

const INSCRITAS = [FERNANDA, KEVIN, HELENA] as const;

async function abrir(page: Page): Promise<void> {
  await page.goto(ROTA_DA_TELA);
  await expect(page.getByRole('heading', { level: 1, name: 'Notas do ENEM' })).toBeVisible();
}

function cartaoDeEnvio(page: Page): Locator {
  return page.getByRole('region', { name: 'Enviar CPFs ao INEP' });
}

function cartaoDeImportacao(page: Page): Locator {
  return page.getByRole('region', { name: 'Importar o retorno do INEP' });
}

async function escolherEdicao(cartao: Locator, titulo: string, edicao = '2025'): Promise<void> {
  await cartao.getByLabel('Edição do ENEM').selectOption(edicao);
  await expect(cartao.getByRole('heading', { name: titulo })).toBeVisible();
  await expect(cartao.getByRole('status').filter({ hasText: 'Carregando' })).toHaveCount(0);
}

async function escolherEdicaoDeEnvio(page: Page, edicao?: string): Promise<void> {
  await escolherEdicao(cartaoDeEnvio(page), 'Envios gerados desta edição', edicao);
}

async function escolherEdicaoDeRetorno(page: Page, edicao?: string): Promise<void> {
  await escolherEdicao(cartaoDeImportacao(page), 'Lotes importados desta edição', edicao);
}

/** Com um só leiaute ativo a tela já o escolhe e não mostra o campo; com mais, o operador escolhe. */
async function escolherLeiauteDeRetorno(page: Page): Promise<void> {
  const campo = cartaoDeImportacao(page).getByLabel('Leiaute do arquivo de retorno');
  if ((await campo.count()) > 0) await campo.selectOption({ index: 1 });
}

async function escolherArquivo(page: Page, nome: string, conteudo: Buffer): Promise<void> {
  await cartaoDeImportacao(page)
    .locator('input[type="file"]')
    .setInputFiles({ name: nome, mimeType: 'text/plain', buffer: conteudo });
}

async function semNenhumCpfNaTela(page: Page): Promise<void> {
  const html = await page.content();
  for (const pessoa of [FERNANDA, KEVIN, HELENA, ERICK]) {
    expect(html).not.toContain(pessoa.cpf);
  }
}

function identificadoresDe(resultado: AxeResults): string[] {
  return resultado.violations.map((violacao) => violacao.id);
}

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
    await expect(page.getByRole('heading', { name: 'Lotes importados desta edição' })).toHaveCount(
      0,
    );

    expect(registro.envios).toEqual([]);
    expect(registro.importacoes).toEqual([]);
  });

  test('cada cartão tem a própria edição: escolher uma não muda a outra', async ({ page }) => {
    await simularApi(page);
    await abrir(page);

    await escolherEdicaoDeEnvio(page, '2024');

    await expect(cartaoDeEnvio(page).getByLabel('Edição do ENEM')).toHaveValue('2024');
    await expect(cartaoDeImportacao(page).getByLabel('Edição do ENEM')).toHaveValue('');
    await expect(
      cartaoDeImportacao(page).getByRole('button', { name: 'Importar notas' }),
    ).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Lotes importados desta edição' })).toHaveCount(
      0,
    );
  });

  test('com a edição e sem leiaute ou arquivo, a importação aponta cada falta e nada sai', async ({
    page,
  }) => {
    const registro = await simularApi(page);
    await abrir(page);
    await escolherEdicaoDeRetorno(page);

    await cartaoDeImportacao(page).getByRole('button', { name: 'Importar notas' }).click();
    await expect(page.getByText('Escolha o leiaute do arquivo de retorno.')).toBeVisible();
    await expect(page.getByText('Escolha o arquivo de retorno do INEP.')).toBeVisible();
    await expect(page.getByLabel('Leiaute do arquivo de retorno')).toBeFocused();

    expect(registro.importacoes).toEqual([]);
  });

  test('com um só leiaute de retorno não há campo a escolher e só falta o arquivo', async ({
    page,
  }) => {
    const registro = await simularApi(page, { leiautes: { retorno: [LEIAUTES.retorno[0]] } });
    await abrir(page);
    await escolherEdicaoDeRetorno(page);

    await expect(page.getByLabel('Leiaute do arquivo de retorno')).toHaveCount(0);
    await cartaoDeImportacao(page).getByRole('button', { name: 'Importar notas' }).click();
    await expect(page.getByText('Escolha o arquivo de retorno do INEP.')).toBeVisible();
    await expect(page.getByText('Escolha o leiaute do arquivo de retorno.')).toHaveCount(0);

    expect(registro.importacoes).toEqual([]);
  });

  test('baixa o arquivo de envio só com os CPFs das personas inscritas', async ({ page }) => {
    const registro = await simularApi(page, { gerarEnvio: texto(arquivoDeEnvio(INSCRITAS)) });
    await abrir(page);
    await escolherEdicaoDeEnvio(page);

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

  test('importa o arquivo e mostra o resultado em abas, com a linha sem inscrito mascarada', async ({
    page,
  }) => {
    const retorno = retornoComLinhaSemInscrito(INSCRITAS, ERICK);
    const registro = await simularApi(page);
    await abrir(page);
    await escolherEdicaoDeRetorno(page);
    const cartao = cartaoDeImportacao(page);
    await cartao
      .getByLabel('Leiaute do arquivo de retorno')
      .selectOption({ label: 'Retorno do INEP com 20 campos, a partir da edição de 2024 (v1)' });
    await escolherArquivo(page, 'retorno-inep-2025.txt', retorno);

    await cartao.getByRole('button', { name: 'Importar notas' }).click();

    const titulo = cartao.getByRole('heading', { name: 'Resultado da importação' });
    await expect(titulo).toBeFocused();
    await expect(
      cartao.getByText(
        'Lote importado: 2 inscritos com nota, 1 sem nota, 1 linha sem inscrito, 1 inscrito em conflito, 1 inscrito ausente.',
      ),
    ).toBeVisible();
    await expect(cartao.getByRole('tab')).toHaveText([
      /Sem nota\s*1/,
      /Ausentes\s*1/,
      /Linhas sem inscrito\s*1/,
      /Conflitos\s*1/,
    ]);

    await cartao.getByRole('tab', { name: /^Linhas sem inscrito/ }).click();
    const semInscrito = cartao.getByRole('tabpanel').getByRole('row').nth(1);
    await expect(semInscrito).toContainText('14');
    await expect(semInscrito).toContainText(ERICK.nome);
    await expect(semInscrito).toContainText('Masculino');
    await expect(semInscrito).toContainText(cpfMascarado(ERICK.cpf));

    await cartao.getByRole('tab', { name: /^Ausentes/ }).click();
    const ausente = cartao.getByRole('tabpanel').getByRole('row').nth(1);
    await expect(ausente).toContainText('INS-0005');
    await expect(ausente).toContainText(KEVIN.nome);
    await expect(ausente).toContainText('Medicina — Marabá — Integral');
    await expect(ausente).toContainText('2ª opção: Enfermagem — Marabá — Integral');
    await expect(ausente).toContainText('Matemática, Redação');

    await cartao.getByRole('tab', { name: /^Conflitos/ }).click();
    const conflito = cartao.getByRole('tabpanel').getByRole('row').nth(1);
    await expect(conflito).toContainText('INS-0004');
    await expect(conflito).toContainText('2 e 4');

    expect(registro.importacoes).toHaveLength(1);
    expect(registro.importacoes[0].includes(retorno)).toBe(true);
    await expect(page.locator('.uni-uploader__item')).toHaveCount(0);
    await semNenhumCpfNaTela(page);
  });

  test('o arquivo que já é o do lote vigente diz que nada mudou', async ({ page }) => {
    await simularApi(page, { importar: json(lote({ ocorrencias: [], ausentes: [] }), 200) });
    await abrir(page);
    await escolherEdicaoDeRetorno(page);
    await escolherLeiauteDeRetorno(page);
    await escolherArquivo(page, 'retorno-inep-2025.txt', retornoSemUmInscrito(INSCRITAS, HELENA));

    await cartaoDeImportacao(page).getByRole('button', { name: 'Importar notas' }).click();

    await expect(page.getByText('Este arquivo já é o do lote vigente. Nada mudou.')).toBeVisible();
  });

  test('arquivo fora do leiaute: nenhuma nota gravada e orientação de conferir o leiaute', async ({
    page,
  }) => {
    await simularApi(page, {
      importar: problema(
        422,
        'arquivo_fora_do_leiaute',
        'Arquivo fora do leiaute',
        'Linha 1, coluna 21.',
      ),
    });
    await abrir(page);
    await escolherEdicaoDeRetorno(page);
    await escolherLeiauteDeRetorno(page);
    await escolherArquivo(page, 'retorno-inep-2025.txt', retornoDe23Campos(INSCRITAS));

    await cartaoDeImportacao(page).getByRole('button', { name: 'Importar notas' }).click();

    const alerta = page.getByRole('alert').filter({ hasText: 'Arquivo recusado' });
    await expect(alerta).toBeFocused();
    await expect(alerta).toContainText('nenhuma nota foi gravada');
    await expect(alerta).toContainText('Confira se o leiaute selecionado é o do arquivo');
    await expect(alerta).toContainText('Linha 1, coluna 21.');
    await expect(page.locator('.uni-uploader__item')).toHaveCount(1);
  });

  test('com um só leiaute a recusa por leiaute não manda conferir uma escolha que não existe', async ({
    page,
  }) => {
    await simularApi(page, {
      leiautes: { retorno: [LEIAUTES.retorno[0]] },
      importar: problema(
        422,
        'arquivo_fora_do_leiaute',
        'Arquivo fora do leiaute',
        'Linha 1, coluna 21.',
      ),
    });
    await abrir(page);
    await escolherEdicaoDeRetorno(page);
    await escolherArquivo(page, 'retorno-inep-2025.txt', retornoDe23Campos(INSCRITAS));

    await cartaoDeImportacao(page).getByRole('button', { name: 'Importar notas' }).click();

    const alerta = page.getByRole('alert').filter({ hasText: 'Arquivo recusado' });
    await expect(alerta).toContainText('nenhuma nota foi gravada');
    await expect(alerta).toContainText('Envie o arquivo exatamente como o INEP o devolveu');
    await expect(alerta).not.toContainText('Confira se o leiaute selecionado');
  });

  for (const [status, codigo, trecho] of [
    [413, 'arquivo_grande_demais', 'passa de 10 MB'],
    [415, 'tipo_de_arquivo_nao_aceito', 'não é de texto'],
  ] as const) {
    test(`a recusa ${status} da API chega com a explicação`, async ({ page }) => {
      await simularApi(page, { importar: problema(status, codigo, 'Recusa') });
      await abrir(page);
      await escolherEdicaoDeRetorno(page);
      await escolherLeiauteDeRetorno(page);
      await escolherArquivo(page, 'retorno-inep-2025.txt', retornoSemUmInscrito(INSCRITAS, HELENA));

      await cartaoDeImportacao(page).getByRole('button', { name: 'Importar notas' }).click();

      const alerta = page.getByRole('alert').filter({ hasText: 'Arquivo recusado' });
      await expect(alerta).toContainText('nenhuma nota foi gravada');
      await expect(alerta).toContainText(trecho);
    });
  }

  test('edição sem inscritos é um aviso orientador, não um erro', async ({ page }) => {
    await simularApi(page, {
      gerarEnvio: problema(422, 'edicao_sem_inscritos', 'Edição sem inscritos'),
    });
    await abrir(page);
    await escolherEdicaoDeEnvio(page);

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
    await escolherEdicaoDeEnvio(page);
    await escolherEdicaoDeRetorno(page);

    await expect(cartaoDeEnvio(page).getByRole('row', { name: /Diogo Souza/ })).toContainText('3');
    await expect(cartaoDeImportacao(page).getByRole('row', { name: /Diogo Souza/ })).toContainText(
      'Vigente',
    );
  });

  test('"Ver ocorrências" abre as ocorrências de um lote do histórico', async ({ page }) => {
    await simularApi(page, { lotes: [lote({ ocorrencias: null, ausentes: null })] });
    await abrir(page);
    await escolherEdicaoDeRetorno(page);

    await cartaoDeImportacao(page)
      .getByRole('button', { name: /^Ver ocorrências/ })
      .click();

    await expect(page.getByRole('heading', { name: 'Ocorrências do lote' })).toBeFocused();
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

    await escolherEdicaoDeEnvio(page);
    await cartaoDeEnvio(page).getByRole('button', { name: 'Baixar arquivo de envio' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Não há o que enviar' })).toBeVisible();
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);

    await escolherEdicaoDeRetorno(page);
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
