import { expect, test } from '@playwright/test';
import {
  ERICK,
  HELENA,
  KEVIN,
  retornoComLinhaSemInscrito,
  retornoDe23Campos,
  retornoSemUmInscrito,
} from '../fixtures/arquivo-do-inep-sintetico';
import {
  LEIAUTES,
  cpfMascarado,
  json,
  lote,
  problema,
  simularApi,
} from '../fixtures/notas-do-enem';
import {
  INSCRITAS,
  abrir,
  cartaoDeImportacao,
  escolherArquivo,
  escolherEdicao,
  escolherLeiauteDeRetorno,
  semNenhumCpfNaTela,
} from '../support/passos-da-tela-de-notas-do-enem';

/** Importação do arquivo de retorno do INEP na tela de notas do ENEM, com a API simulada. */

test.describe('Notas do ENEM do processo', () => {
  test('com a edição e sem leiaute ou arquivo, a importação aponta cada falta e nada sai', async ({
    page,
  }) => {
    const registro = await simularApi(page);
    await abrir(page);
    await escolherEdicao(cartaoDeImportacao(page), 'Lotes importados desta edição');

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
    await escolherEdicao(cartaoDeImportacao(page), 'Lotes importados desta edição');

    await expect(page.getByLabel('Leiaute do arquivo de retorno')).toHaveCount(0);
    await cartaoDeImportacao(page).getByRole('button', { name: 'Importar notas' }).click();
    await expect(page.getByText('Escolha o arquivo de retorno do INEP.')).toBeVisible();
    await expect(page.getByText('Escolha o leiaute do arquivo de retorno.')).toHaveCount(0);

    expect(registro.importacoes).toEqual([]);
  });

  test('importa o arquivo e mostra o resultado em abas, com a linha sem inscrito mascarada', async ({
    page,
  }) => {
    const retorno = retornoComLinhaSemInscrito(INSCRITAS, ERICK);
    const registro = await simularApi(page);
    await abrir(page);
    await escolherEdicao(cartaoDeImportacao(page), 'Lotes importados desta edição');
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
    await escolherEdicao(cartaoDeImportacao(page), 'Lotes importados desta edição');
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
    await escolherEdicao(cartaoDeImportacao(page), 'Lotes importados desta edição');
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
    await escolherEdicao(cartaoDeImportacao(page), 'Lotes importados desta edição');
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
      await escolherEdicao(cartaoDeImportacao(page), 'Lotes importados desta edição');
      await escolherLeiauteDeRetorno(page);
      await escolherArquivo(page, 'retorno-inep-2025.txt', retornoSemUmInscrito(INSCRITAS, HELENA));

      await cartaoDeImportacao(page).getByRole('button', { name: 'Importar notas' }).click();

      const alerta = page.getByRole('alert').filter({ hasText: 'Arquivo recusado' });
      await expect(alerta).toContainText('nenhuma nota foi gravada');
      await expect(alerta).toContainText(trecho);
    });
  }
});
