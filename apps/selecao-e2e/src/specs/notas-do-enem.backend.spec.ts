import { readFile } from 'node:fs/promises';
import { UNIDADE_DO_CERTAME, entrarComoPersona, garantirConcessao, garantirPerfil } from '@uniplus/shared-e2e';
import type { Locator } from '@playwright/test';
import { expect, test } from '../fixtures/auth.fixture';
import {
  ERICK,
  FERNANDA,
  arquivoDeRetorno,
  linha,
  linhaDe23Campos,
} from '../fixtures/arquivo-do-inep-sintetico';
import { lotesDeNotasDoEnem, processoDasNotasDoEnem } from '../fixtures/processo-das-notas-do-enem';

/**
 * Envio ao INEP e importação das notas do ENEM contra a API real, sem simulação. Roda só com
 * `E2E_BACKEND_REAL=1` e a stack do `uniplus-api` no ar. O processo divulgado, com a etapa de nota
 * do ENEM, as edições declaradas e as inscrições enviadas das personas fictícias, é montado pela
 * própria spec (`processoDasNotasDoEnem`) e reaproveitado nas execuções seguintes.
 *
 * ```bash
 * E2E_BACKEND_REAL=1 npx playwright test -c apps/selecao-e2e/playwright.config.ts --project=selecao-backend-real
 * ```
 *
 * `E2E_EDICAO` indica a edição que as inscrições escolheram (padrão 2025).
 */
const EDICAO = process.env['E2E_EDICAO'] ?? '2025';
/**
 * Um arquivo de retorno novo a cada execução: o hash do arquivo identifica o lote vigente, e o mesmo
 * conteúdo numa segunda execução devolveria o lote anterior sem gravar nada. Só o número de
 * inscrição no ENEM muda; as notas, os CPFs e as linhas conferidas são os mesmos.
 */
const RODADA = Math.floor(Date.now() / 1000) % 100_000;
const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';

/**
 * Quem opera o envio e a importação precisa das permissões na unidade dona do certame e não pode
 * estar inscrito no processo. Diogo é servidor, não candidato, e os perfis são só desta spec. O
 * catálogo de leiautes do INEP é institucional, e um perfil não mistura os dois alcances.
 */
const OPERADOR = 'diogo.souza';
const PERFIS_DO_OPERADOR = [
  {
    nome: 'E2E notas do ENEM — operação do envio e da importação',
    permissoes: ['selecao:processos:configurar', 'selecao:envios-inep:gerar', 'selecao:notas-enem:importar'],
  },
  {
    nome: 'E2E notas do ENEM — consulta dos leiautes do INEP',
    permissoes: ['selecao:leiautes-inep:consultar'],
  },
];

test.describe('Notas do ENEM contra a API real', () => {
  let processoId = '';

  test.beforeAll(async () => {
    test.setTimeout(1_800_000);
    for (const perfil of PERFIS_DO_OPERADOR) {
      const perfilId = await garantirPerfil(
        perfil.nome,
        'Acesso do operador à spec das notas do ENEM contra a API real.',
        perfil.permissoes,
      );
      await garantirConcessao(OPERADOR, perfilId, UNIDADE_DO_CERTAME);
    }
    processoId = await processoDasNotasDoEnem();
  });

  test('baixa o envio, importa o retorno e recusa o arquivo fora do leiaute', async ({ browser }) => {
    const page = await entrarComoPersona(browser, APP, OPERADOR, `/processo-seletivo/${processoId}/notas-do-enem`);
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
    const presentes = cpfs.map((cpf, indice) => linha(FERNANDA, indice + 1, cpf, RODADA));
    const linhaDoErick = presentes.length + 1;
    const lotesAntes = await lotesDeNotasDoEnem(processoId, EDICAO);
    const linhas = [...presentes, linha(ERICK, linhaDoErick, ERICK.cpf, RODADA)];
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
    // O lote é novo: outro id e outro hash do arquivo, o mais recente da edição e o único vigente.
    const lotesDepois = await lotesDeNotasDoEnem(processoId, EDICAO);
    expect(lotesDepois).toHaveLength(lotesAntes.length + 1);
    const novo = lotesDepois[0];
    expect(lotesAntes.map((lote) => lote.id)).not.toContain(novo?.id);
    expect(lotesAntes.map((lote) => lote.arquivoHash)).not.toContain(novo?.arquivoHash);
    expect(novo?.vigente).toBe(true);
    expect(novo?.totalDeLinhas).toBe(linhas.length);
    expect(lotesDepois.filter((lote) => lote.vigente)).toHaveLength(1);
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
    expect(await lotesDeNotasDoEnem(processoId, EDICAO)).toEqual(lotesDepois);
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
