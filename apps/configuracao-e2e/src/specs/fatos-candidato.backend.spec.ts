import { test, expect, type Page } from '@playwright/test';
import { acharNaListagem, entrarComoPersona, prepararAcessosDaSimulacao } from '@uniplus/shared-e2e';

/**
 * Cadastro e edição do fato com descrição obrigatória e componente de exibição
 * contra a API real. Cada execução usa um código novo, porque o código de um fato nunca se
 * reutiliza.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4203';
const PADRAO = 'Padrão (pelo tipo do dado)';

interface FatoGravado {
  readonly codigo: string;
  readonly descricao: string;
  readonly componenteExibicao: string | null;
}

async function abrirCadastro(pagina: Page): Promise<void> {
  await expect(pagina.getByRole('heading', { level: 1, name: 'Fato do Candidato' })).toBeVisible();
  await pagina.getByRole('button', { name: 'Novo fato' }).click();
  await expect(pagina.locator('#cfg-fato-criacao')).toBeVisible();
}

async function preencherFato(
  pagina: Page,
  fato: { nome: string; codigo: string; descricao: string; componente?: string },
): Promise<void> {
  const form = pagina.locator('#cfg-fato-criacao');
  await form.getByLabel('Nome', { exact: true }).fill(fato.nome);
  await form.getByLabel('Código').fill(fato.codigo);
  if (fato.descricao !== '') await form.getByLabel('Descrição').fill(fato.descricao);
  if (fato.componente !== undefined) await form.locator('select[formcontrolname="componenteExibicao"]').selectOption(fato.componente);
  await form.locator('select[formcontrolname="dominio"]').selectOption('NUMERICO');
  await form.locator('select[formcontrolname="pontoResolucao"]').selectOption('INSCRICAO');
  await form.locator('select[formcontrolname="classificacaoProtecao"]').selectOption('PESSOAL');
  await form.locator('select[formcontrolname="hipoteseLegal"]').selectOption('CUMPRIMENTO_OBRIGACAO_LEGAL');
  await form.getByLabel('Finalidade do tratamento').fill('Conferência da renda para a reserva de vagas do processo seletivo.');
}

/** Fecha a edição que o cadastro abre e abre o resumo do fato pela lista. */
async function resumoDoFato(pagina: Page, codigo: string): Promise<void> {
  await pagina.getByRole('button', { name: 'Fechar', exact: true }).last().click();
  await pagina.getByRole('searchbox', { name: 'Buscar fato do candidato' }).fill(codigo);
  await pagina.getByRole('row').filter({ hasText: codigo }).getByRole('button', { name: /^Ver o detalhe de/ }).click();
}

async function fatoNaApi(codigo: string): Promise<FatoGravado | undefined> {
  return acharNaListagem<FatoGravado>(
    'isabella.figueiredo',
    '/api/configuracao/admin/fatos-candidato?limit=100',
    (f) => f.codigo === codigo,
  );
}

test.describe('Cadastro do fato do candidato', () => {
  test.beforeAll(async () => {
    test.setTimeout(600_000);
    await prepararAcessosDaSimulacao();
  });

  test('descrição em branco impede salvar e marca o campo como obrigatório', async ({ browser }) => {
    const codigo = `RENDA_SEM_DESCRICAO_${Date.now()}`;
    const pagina = await entrarComoPersona(browser, APP, 'isabella.figueiredo', '/fatos-candidato');
    await abrirCadastro(pagina);
    await preencherFato(pagina, { nome: 'Renda familiar bruta', codigo, descricao: '' });

    await pagina.getByRole('button', { name: /^Salvar|^Criar|^Cadastrar/ }).last().click();

    const descricao = pagina.locator('#cfg-fato-criacao').getByLabel('Descrição');
    await expect(descricao).toHaveAttribute('aria-required', 'true');
    await expect(descricao).toHaveAttribute('aria-invalid', 'true');
    await expect(pagina.locator('#cfg-fato-descricao-erro')).toBeVisible();
    expect(await fatoNaApi(codigo)).toBeUndefined();
  });

  test('fato declarado como moeda mostra o componente no resumo e volta ao padrão ao limpar', async ({ browser }) => {
    const codigo = `RENDA_FAMILIAR_BRUTA_${Date.now()}`;
    const pagina = await entrarComoPersona(browser, APP, 'isabella.figueiredo', '/fatos-candidato');
    await abrirCadastro(pagina);
    await preencherFato(pagina, {
      nome: 'Renda familiar bruta',
      codigo,
      descricao: 'Soma da renda bruta mensal das pessoas da família, em reais.',
      componente: 'MOEDA',
    });
    await pagina.getByRole('button', { name: /^Salvar|^Criar|^Cadastrar/ }).last().click();

    await expect.poll(async () => (await fatoNaApi(codigo))?.componenteExibicao).toBe('MOEDA');
    // Salvo o fato, a tela abre a edição dele com o componente declarado e o resumo da definição.
    const descritivo = pagina.locator('#cfg-fato-descritivo');
    await expect(descritivo.locator('select[formcontrolname="componenteExibicao"]')).toHaveValue('MOEDA');
    await resumoDoFato(pagina, codigo);
    await expect(pagina.locator('dd', { hasText: 'Moeda' })).toBeVisible();

    await pagina.getByRole('button', { name: 'Fechar', exact: true }).last().click();
    await pagina.getByRole('button', { name: `Editar o fato ${codigo}` }).click();
    await descritivo.locator('select[formcontrolname="componenteExibicao"]').selectOption('');
    await pagina.getByRole('button', { name: 'Salvar nome, descrição e componente' }).click();
    await expect.poll(async () => (await fatoNaApi(codigo))?.componenteExibicao).toBeNull();
  });

  test('fato sem componente declarado mostra o padrão pelo tipo do dado', async ({ browser }) => {
    const codigo = `RENDA_SEM_COMPONENTE_${Date.now()}`;
    const pagina = await entrarComoPersona(browser, APP, 'isabella.figueiredo', '/fatos-candidato');
    await abrirCadastro(pagina);
    await preencherFato(pagina, {
      nome: 'Renda sem componente',
      codigo,
      descricao: 'Valor numérico sem componente de exibição declarado.',
    });
    await pagina.getByRole('button', { name: /^Salvar|^Criar|^Cadastrar/ }).last().click();

    await expect.poll(async () => (await fatoNaApi(codigo))?.componenteExibicao).toBeNull();
    await resumoDoFato(pagina, codigo);
    await expect(pagina.locator('dd', { hasText: PADRAO })).toBeVisible();
  });

  test('fato de sistema deixa alterar nome, descrição e componente, e o aviso cita os três', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'isabella.figueiredo', '/fatos-candidato');
    await expect(pagina.getByRole('heading', { level: 1, name: 'Fato do Candidato' })).toBeVisible();
    await pagina.getByRole('searchbox', { name: 'Buscar fato do candidato' }).fill('FAIXA_ETARIA');

    await pagina.getByRole('button', { name: 'Editar o fato FAIXA_ETARIA' }).click();

    await expect(pagina.getByText('Fato de sistema', { exact: true })).toBeVisible();
    await expect(pagina.getByText(/Só o nome, a descrição, o componente de exibição e a proteção de dados/)).toBeVisible();
    const descritivo = pagina.locator('#cfg-fato-descritivo');
    await expect(descritivo.getByLabel('Nome', { exact: true })).toBeEditable();
    await expect(descritivo.getByLabel('Descrição')).toBeEditable();
    await expect(descritivo.locator('select[formcontrolname="componenteExibicao"]')).toBeEnabled();
    // Os demais campos do fato de sistema aparecem só para leitura, em lista de termos.
    await expect(pagina.getByText('Escopo', { exact: true })).toBeAttached();
    await expect(pagina.getByText('Conhecido a partir da fase')).toBeAttached();
  });
});
