import { test, expect } from '@playwright/test';
import {
  entrarComoPersona,
  garantirConcessao,
  garantirPerfil,
  unidadeDoCertame,
} from '@uniplus/shared-e2e';
import { cenarioDaProjecao, type CenarioDaProjecao } from '../fixtures/cenario-da-projecao';

/**
 * Listagem das inscrições enviadas do processo (web#1333) contra a API real. O que cada pessoa
 * vê na linha depende das permissões de dado dela: público (ofertas escolhidas e situação), interno
 * (número e data do envio), pessoal (nome) e identificador (CPF mascarado). O campo que a API
 * omite não deixa marca, e a linha sempre leva ao detalhe.
 *
 * Cada papel tem uma pessoa reservada a esta spec; nenhuma outra spec nem o suporte a usa.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';

const QUEM_CONSULTA_DADOS_PESSOAIS = 'yasmin.assuncao';
const QUEM_CONSULTA_IDENTIFICADOR = 'aline.lima';
const QUEM_AVALIA_SEM_IDENTIFICACAO = 'leonardo.lopes';
const QUEM_SO_CONSULTA_INSCRICOES = 'jose.moreira';
const QUEM_CONSULTA_DADOS_INTERNOS = 'sophie.farias';
const QUEM_NAO_CONSULTA_INSCRICOES = 'aline.nogueira';
const PERFIS = [
  {
    persona: QUEM_CONSULTA_DADOS_PESSOAIS,
    permissoes: [
      'selecao:dados-publicos:consultar',
      'selecao:dados-internos:consultar',
      'selecao:dados-pessoais:consultar',
      'selecao:dados-identificadores:consultar',
    ],
  },
  { persona: QUEM_CONSULTA_IDENTIFICADOR, permissoes: ['selecao:dados-identificadores:consultar'] },
  { persona: QUEM_AVALIA_SEM_IDENTIFICACAO, permissoes: ['selecao:dados-publicos:consultar'] },
  { persona: QUEM_SO_CONSULTA_INSCRICOES, permissoes: [] },
  { persona: QUEM_CONSULTA_DADOS_INTERNOS, permissoes: ['selecao:dados-internos:consultar'] },
] as const;

test.describe('Inscrições do processo seletivo (listagem)', () => {
  let cenario: CenarioDaProjecao;

  test.beforeAll(async () => {
    test.setTimeout(900_000);
    cenario = await cenarioDaProjecao();
    for (const { persona, permissoes } of PERFIS) {
      const perfil = await garantirPerfil(
        `E2E listagem de inscrições — ${persona}`,
        `Acesso à listagem para ${persona}.`,
        ['selecao:inscricoes:consultar', ...permissoes],
      );
      await garantirConcessao(persona, perfil, await unidadeDoCertame());
    }
  });

  test('servidor com dados pessoais lista as inscrições com nome, ofertas, situação e o CPF mascarado', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      QUEM_CONSULTA_DADOS_PESSOAIS,
      `/processo-seletivo/${cenario.processoId}/inscricoes`,
    );

    await expect(
      pagina.getByRole('heading', { level: 2, name: 'Inscrições enviadas' }),
    ).toBeVisible();
    await expect(pagina.getByText(`${cenario.nomeDoProcesso} — inscrições enviadas`)).toBeVisible();
    for (const coluna of ['Inscrição', 'Nome', 'Ofertas', 'Situação', 'Enviada em']) {
      await expect(pagina.getByRole('columnheader', { name: coluna })).toBeVisible();
    }
    // O número do documento é do identificador: vem mascarado para quem consulta a classe, e nunca em claro.
    await expect(pagina.getByRole('columnheader', { name: 'CPF' })).toBeVisible();
    const linhaDeErick = pagina.getByRole('row', { name: /Erick Isaac Ramos/ });
    await expect(linhaDeErick).toContainText('Medicina');
    await expect(linhaDeErick).toContainText(/\*\*\*\.\d{3}\.\d{3}-\*\*/);
    await expect(pagina.locator('main')).not.toContainText(cenario.erick.cpf);
    await expect(pagina.getByRole('row', { name: /Ariel Drumond/ })).toBeVisible();
  });

  test('quem consulta o identificador vê o CPF mascarado e nenhuma outra coluna', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      QUEM_CONSULTA_IDENTIFICADOR,
      `/processo-seletivo/${cenario.processoId}/inscricoes`,
    );

    await expect(
      pagina.getByRole('heading', { level: 2, name: 'Inscrições enviadas' }),
    ).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'CPF' })).toBeVisible();
    for (const coluna of ['Nome', 'Ofertas', 'Situação']) {
      await expect(pagina.getByRole('columnheader', { name: coluna })).toHaveCount(0);
    }
    await expect(pagina.getByRole('row').filter({ hasText: '***.342.259-**' })).toHaveCount(1);
    await expect(pagina.getByRole('row').filter({ hasText: '***.598.363-**' })).toHaveCount(1);
    await expect(pagina.getByText(cenario.erick.cpf)).toHaveCount(0);
    await expect(pagina.getByRole('button', { name: /Revelar/ })).toHaveCount(0);
  });

  test('avaliação cega vê ofertas e situação sem nome, CPF nem marca de campo oculto', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      QUEM_AVALIA_SEM_IDENTIFICACAO,
      `/processo-seletivo/${cenario.processoId}/inscricoes`,
    );

    await expect(
      pagina.getByRole('heading', { level: 2, name: 'Inscrições enviadas' }),
    ).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'Situação' })).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'Ofertas' })).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'Nome' })).toHaveCount(0);
    await expect(pagina.getByRole('columnheader', { name: 'CPF' })).toHaveCount(0);
    await expect(pagina.locator('main')).not.toContainText(
      /Erick|Drumond|\*\*\*\.|oculto|sem permiss/i,
    );
  });

  test('quem só consulta inscrições recebe linhas sem ofertas, situação, nome nem CPF, mas ainda abre o detalhe', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      QUEM_SO_CONSULTA_INSCRICOES,
      `/processo-seletivo/${cenario.processoId}/inscricoes`,
    );

    await expect(
      pagina.getByRole('heading', { level: 2, name: 'Inscrições enviadas' }),
    ).toBeVisible();
    for (const coluna of ['Nome', 'CPF', 'Ofertas', 'Situação']) {
      await expect(pagina.getByRole('columnheader', { name: coluna })).toHaveCount(0);
    }
    await expect(pagina.locator('main')).not.toContainText(/Erick|Drumond|\*\*\*\./);
    await pagina
      .getByRole('link', { name: /Abrir inscrição sem dados visíveis/ })
      .first()
      .click();

    await expect(pagina).toHaveURL(
      new RegExp(`/processo-seletivo/${cenario.processoId}/inscricoes/[0-9a-f-]{36}$`),
    );
    await expect(pagina.getByRole('heading', { level: 1, name: 'Inscrição' })).toBeVisible();
  });

  test('quem tem só dados internos vê número e data do envio, e a linha abre o detalhe', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      QUEM_CONSULTA_DADOS_INTERNOS,
      `/processo-seletivo/${cenario.processoId}/inscricoes`,
    );

    await expect(
      pagina.getByRole('heading', { level: 2, name: 'Inscrições enviadas' }),
    ).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'Inscrição' })).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'Enviada em' })).toBeVisible();
    await expect(pagina.getByRole('columnheader', { name: 'Situação' })).toHaveCount(0);
    await expect(pagina.getByRole('cell', { name: /^\d{8}$/ }).first()).toBeVisible();
    await expect(pagina.getByRole('row').getByRole('link').first()).toBeVisible();
  });

  test('a linha leva ao detalhe da inscrição na rota do processo', async ({ browser }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      QUEM_CONSULTA_DADOS_PESSOAIS,
      `/processo-seletivo/${cenario.processoId}/inscricoes`,
    );

    await pagina
      .getByRole('row', { name: /Ariel Drumond/ })
      .getByRole('link')
      .first()
      .click();

    await expect(pagina).toHaveURL(
      new RegExp(
        `/processo-seletivo/${cenario.processoId}/inscricoes/${cenario.fernanda.inscricaoId}$`,
      ),
    );
  });

  test('processo sem inscrição enviada mostra o estado vazio', async ({ browser }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      QUEM_CONSULTA_DADOS_PESSOAIS,
      `/processo-seletivo/${cenario.processoSemInscricaoId}/inscricoes`,
    );

    await expect(pagina.getByText('Nenhuma inscrição enviada')).toBeVisible();
  });

  test('processo inexistente mostra "Processo seletivo não encontrado" com retorno', async ({
    browser,
  }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      QUEM_CONSULTA_DADOS_PESSOAIS,
      '/processo-seletivo/01a00000-0000-7000-8000-000000000000/inscricoes',
    );

    await expect(pagina.getByText('Processo seletivo não encontrado')).toBeVisible();
    await expect(pagina.getByRole('link', { name: /Voltar/ })).toBeVisible();
  });

  test('quem não consulta inscrições é levado à página de acesso negado', async ({ browser }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      QUEM_NAO_CONSULTA_INSCRICOES,
      `/processo-seletivo/${cenario.processoId}/inscricoes`,
    );

    await expect(pagina).toHaveURL(/acesso-negado/);
  });
});
