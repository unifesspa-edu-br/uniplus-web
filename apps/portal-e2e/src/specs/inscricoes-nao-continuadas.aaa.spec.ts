import {
  assertReflowContract,
  assertTextSpacingResilience,
  runAxeWcagAA,
  SENHA_DAS_PERSONAS,
} from '@uniplus/shared-e2e';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  conferirCardSemCorteHorizontal,
  conferirOrdemNaArvoreDeAcessibilidade,
} from '../support/conferencias-do-card-da-inscricao';
import { keycloakLogin, resetPasswords } from '../support/keycloak-login';
import {
  rascunhoSemContinuar,
  simularMinhasInscricoes,
} from '../support/minhas-inscricoes-simuladas';
import { inscricaoNaLista } from '../support/passos-da-inscricao';
import {
  conferirPreferenciaAplicada,
  instalarPreferencia,
  preferenciaDoProjeto,
  type PreferenciaDaMatriz,
} from '../support/preferencia-de-acessibilidade';

const PROCESSO_ENCERRADO = 'Processo Seletivo de Ingresso 2026.1 — Prazo Encerrado';
const PROCESSO_NAO_INICIADO = 'Processo Seletivo de Mobilidade Acadêmica 2026.2';

const USUARIO_CANDIDATO = 'candidato';

const MENSAGEM_PRAZO_ENCERRADO =
  'O prazo de inscrições foi encerrado. Como sua inscrição não foi enviada dentro do prazo, ela não foi efetivada e não poderá mais ser concluída.';
const MENSAGEM_PERIODO_NAO_INICIADO =
  'O período de inscrições deste processo seletivo ainda não começou. Você poderá continuar sua inscrição quando ele começar.';

const CURSOS_ESCOLHIDOS = [
  { nome: 'Medicina', grau: 'Bacharelado' },
  { nome: 'Direito', grau: 'Bacharelado' },
];

const RASCUNHO_ENCERRADO = rascunhoSemContinuar({
  indice: 1,
  nomeDoProcesso: PROCESSO_ENCERRADO,
  motivo: 'PERIODO_ENCERRADO',
  cursos: CURSOS_ESCOLHIDOS,
});

const RASCUNHO_NAO_INICIADO = rascunhoSemContinuar({
  indice: 2,
  nomeDoProcesso: PROCESSO_NAO_INICIADO,
  motivo: 'PERIODO_NAO_INICIADO',
  cursos: [],
});

// O login é o real, com o usuário candidato do Keycloak do ambiente de E2E; só a lista de inscrições é simulada na rede,
// para o card do rascunho que não pode continuar não depender de dados que a API teria de produzir.
// Cada cenário roda nas dezoito combinações de largura, tema e modo de fonte (um projeto cada).
test.describe('Minhas inscrições — rascunho que não pode continuar @aaa', () => {
  let preferencia: PreferenciaDaMatriz;

  test.beforeAll(async () => {
    await resetPasswords([{ username: USUARIO_CANDIDATO, password: SENHA_DAS_PERSONAS }]);
  });

  test.beforeEach(async ({ page }, testInfo) => {
    preferencia = preferenciaDoProjeto(testInfo.project.name);
    await instalarPreferencia(page, preferencia);
    await simularMinhasInscricoes(page, [RASCUNHO_ENCERRADO, RASCUNHO_NAO_INICIADO]);
    await entrarNaListaDeInscricoes(page, preferencia);
  });

  test('prazo encerrado aparece como "Não enviada", sem ações, e passa em WCAG 2.1 AA', async ({
    page,
  }) => {
    const card = inscricaoNaLista(page, PROCESSO_ENCERRADO);

    await expect(card.locator('ui-tag')).toHaveText('Não enviada');
    await expect(card).toContainText(MENSAGEM_PRAZO_ENCERRADO);
    await conferirSemAcoes(card);

    await assertAcessibilidade(page, card);
  });

  test('período não iniciado aparece como "Rascunho", sem ações, e passa em WCAG 2.1 AA', async ({
    page,
  }) => {
    const card = inscricaoNaLista(page, PROCESSO_NAO_INICIADO);

    await expect(card.locator('ui-tag')).toHaveText('Rascunho');
    await expect(card).toContainText(MENSAGEM_PERIODO_NAO_INICIADO);
    await expect(card).not.toContainText('prazo de inscrições foi encerrado');
    await conferirSemAcoes(card);

    await assertAcessibilidade(page, card);
  });

  test('o DOM lê o nome do processo, o status, a mensagem e os cursos, nessa ordem', async ({
    page,
  }) => {
    const card = inscricaoNaLista(page, PROCESSO_ENCERRADO);

    await expect(card.locator('h2, ui-tag, p, ul.inscricao-cursos')).toHaveText([
      PROCESSO_ENCERRADO,
      'Não enviada',
      MENSAGEM_PRAZO_ENCERRADO,
      /^1ª\s+opção\s+Medicina\s+\(Bacharelado\)\s*2ª\s+opção\s+Direito\s+\(Bacharelado\)$/,
    ]);
  });

  test('a árvore de acessibilidade expõe as mesmas partes, na mesma ordem', async ({ page }) => {
    const card = inscricaoNaLista(page, PROCESSO_ENCERRADO);

    await expect(card.getByRole('heading', { level: 2, name: PROCESSO_ENCERRADO })).toBeVisible();
    await conferirOrdemNaArvoreDeAcessibilidade(card, [
      PROCESSO_ENCERRADO,
      'Não enviada',
      MENSAGEM_PRAZO_ENCERRADO,
      'Medicina (Bacharelado)',
      'Direito (Bacharelado)',
    ]);
  });
});

async function entrarNaListaDeInscricoes(
  page: Page,
  preferencia: PreferenciaDaMatriz,
): Promise<void> {
  await page.goto('/inscricao');
  await keycloakLogin(page, USUARIO_CANDIDATO, SENHA_DAS_PERSONAS, {
    expectRedirectTo: /^https?:\/\/[^/]+\/inscricao(?:[?#]|$)/,
  });
  await conferirPreferenciaAplicada(page, preferencia);
  await expect(page.getByRole('heading', { level: 1, name: /^Olá, / })).toBeVisible();
  await expect(page.getByText('Carregando inscrições...')).toHaveCount(0);
  // Simulação que não casa deixaria a lista vazia ou em erro, e a medição passaria por engano.
  await expect(page.getByRole('alert')).toHaveCount(0);
}

/** A API não permite continuar nem descartar: o card não oferece botão nem link nenhum. */
async function conferirSemAcoes(card: Locator): Promise<void> {
  await expect(card.getByRole('button')).toHaveCount(0);
  await expect(card.getByRole('link')).toHaveCount(0);
  await expect(card.getByText(/Continuar|Concluir|Descartar/)).toHaveCount(0);
}

async function assertAcessibilidade(page: Page, card: Locator): Promise<void> {
  await conferirCardSemCorteHorizontal(page, card);
  const resultado = await runAxeWcagAA(page);
  expect(resultado.violations).toEqual([]);
  await assertReflowContract(page);
  await assertTextSpacingResilience(page);
}
