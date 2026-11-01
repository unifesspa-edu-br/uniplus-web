import { test, expect } from '@playwright/test';
import { UNIDADE_DO_CERTAME, entrarComoPersona, garantirConcessao, garantirPerfil } from '@uniplus/shared-e2e';
import { cenarioDaProjecao, type CenarioDaProjecao } from '../fixtures/cenario-da-projecao';

/**
 * Listagem das inscrições enviadas do processo (web#1333) contra a API real. O que cada pessoa
 * vê na linha depende das permissões de dado dela: público (ofertas escolhidas e situação), interno
 * (número e data do envio), pessoal (nome) e identificador (CPF mascarado). O campo que a API
 * omite não deixa marca, e a linha sempre leva ao detalhe.
 *
 * Personas e permissões: `ACESSOS_DA_SIMULACAO` em `@uniplus/shared-e2e`.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';

test.describe('Inscrições do processo seletivo (listagem)', () => {
  let cenario: CenarioDaProjecao;

  test.beforeAll(async () => {
    test.setTimeout(900_000);
    cenario = await cenarioDaProjecao();
  });

  test('servidor com dados pessoais lista as inscrições com nome, ofertas e situação, sem o CPF', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', `/processo-seletivo/${cenario.processoId}/inscricoes`);

    await expect(pagina.getByRole('heading', { level: 2, name: 'Inscrições enviadas' })).toBeVisible();
    await expect(pagina.getByText(`${cenario.nomeDoProcesso} — inscrições enviadas`)).toBeVisible();
    for (const coluna of ['Inscrição', 'Nome', 'Ofertas', 'Situação', 'Enviada em']) {
      await expect(pagina.getByRole('columnheader', { name: coluna })).toBeVisible();
    }
    // O número do documento é do identificador: dados pessoais não o trazem, nem a permissão de revelar.
    await expect(pagina.getByRole('columnheader', { name: 'CPF' })).toHaveCount(0);
    const linhaDeErick = pagina.getByRole('row', { name: /Erick Isaac Ramos/ });
    await expect(linhaDeErick).toContainText('Medicina');
    await expect(pagina.getByRole('button', { name: /Revelar/ })).toHaveCount(0);
    await expect(pagina.locator('main')).not.toContainText(/\*\*\*\.\d{3}\.\d{3}-\*\*|334\.342\.259-27/);
    await expect(pagina.getByRole('row', { name: /Ariel Drumond/ })).toBeVisible();
  });

  test('quem consulta o identificador vê o CPF mascarado e nenhuma outra coluna', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'helena.rezende', `/processo-seletivo/${cenario.processoId}/inscricoes`);

    await expect(pagina.getByRole('heading', { level: 2, name: 'Inscrições enviadas' })).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'CPF' })).toBeVisible();
    for (const coluna of ['Nome', 'Ofertas', 'Situação']) {
      await expect(pagina.getByRole('columnheader', { name: coluna })).toHaveCount(0);
    }
    await expect(pagina.getByRole('row').filter({ hasText: '***.342.259-**' })).toHaveCount(1);
    await expect(pagina.getByRole('row').filter({ hasText: '***.598.363-**' })).toHaveCount(1);
    await expect(pagina.getByText('334.342.259-27')).toHaveCount(0);
    await expect(pagina.getByRole('button', { name: /Revelar/ })).toHaveCount(0);
  });

  test('avaliação cega vê ofertas e situação sem nome, CPF nem marca de campo oculto', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'leandro.viana', `/processo-seletivo/${cenario.processoId}/inscricoes`);

    await expect(pagina.getByRole('heading', { level: 2, name: 'Inscrições enviadas' })).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'Situação' })).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'Ofertas' })).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'Nome' })).toHaveCount(0);
    await expect(pagina.getByRole('columnheader', { name: 'CPF' })).toHaveCount(0);
    await expect(pagina.locator('main')).not.toContainText(/Erick|Drumond|\*\*\*\.|oculto|sem permiss/i);
  });

  test('quem só consulta inscrições recebe linhas sem ofertas, situação, nome nem CPF, mas ainda abre o detalhe', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'manoel.aparicio', `/processo-seletivo/${cenario.processoId}/inscricoes`);

    await expect(pagina.getByRole('heading', { level: 2, name: 'Inscrições enviadas' })).toBeVisible();
    for (const coluna of ['Nome', 'CPF', 'Ofertas', 'Situação']) {
      await expect(pagina.getByRole('columnheader', { name: coluna })).toHaveCount(0);
    }
    await expect(pagina.locator('main')).not.toContainText(/Erick|Drumond|\*\*\*\./);
    await pagina.getByRole('link', { name: /Abrir inscrição sem dados visíveis/ }).first().click();

    await expect(pagina).toHaveURL(new RegExp(`/processo-seletivo/${cenario.processoId}/inscricoes/[0-9a-f-]{36}$`));
    await expect(pagina.getByRole('heading', { level: 1, name: 'Inscrição' })).toBeVisible();
  });

  test('quem tem só dados internos vê número e data do envio, e a linha abre o detalhe', async ({ browser }) => {
    const permissao = 'selecao:dados-internos:consultar';
    const perfil = await garantirPerfil(
      `E2E projeção — somente ${permissao}`,
      `Matriz de permissões: só ${permissao}, além do acesso às inscrições.`,
      ['selecao:inscricoes:consultar', permissao],
    );
    await garantirConcessao('andre.barbosa', perfil, UNIDADE_DO_CERTAME);
    const pagina = await entrarComoPersona(browser, APP, 'andre.barbosa', `/processo-seletivo/${cenario.processoId}/inscricoes`);

    await expect(pagina.getByRole('heading', { level: 2, name: 'Inscrições enviadas' })).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'Inscrição' })).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'Enviada em' })).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'Situação' })).toHaveCount(0);
    await expect(pagina.getByRole('cell', { name: /^\d{8}$/ }).first()).toBeVisible();
    await expect(pagina.getByRole('row').getByRole('link').first()).toBeVisible();
  });

  test('a linha leva ao detalhe da inscrição na rota do processo', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', `/processo-seletivo/${cenario.processoId}/inscricoes`);

    await pagina.getByRole('row', { name: /Ariel Drumond/ }).getByRole('link').first().click();

    await expect(pagina).toHaveURL(
      new RegExp(`/processo-seletivo/${cenario.processoId}/inscricoes/${cenario.fernanda.inscricaoId}$`),
    );
  });

  test('processo sem inscrição enviada mostra o estado vazio', async ({ browser }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      'diogo.souza',
      `/processo-seletivo/${cenario.processoSemInscricaoId}/inscricoes`,
    );

    await expect(pagina.getByText('Nenhuma inscrição enviada')).toBeVisible();
  });

  test('processo inexistente mostra "Processo seletivo não encontrado" com retorno', async ({ browser }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      'diogo.souza',
      '/processo-seletivo/01a00000-0000-7000-8000-000000000000/inscricoes',
    );

    await expect(pagina.getByText('Processo seletivo não encontrado')).toBeVisible();
    await expect(pagina.getByRole('link', { name: /Voltar/ })).toBeVisible();
  });

  test('quem não consulta inscrições é levado à página de acesso negado', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'caroline.jesus', `/processo-seletivo/${cenario.processoId}/inscricoes`);

    await expect(pagina).toHaveURL(/acesso-negado/);
  });
});
