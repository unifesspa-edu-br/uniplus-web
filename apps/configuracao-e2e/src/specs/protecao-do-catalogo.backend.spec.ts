import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import { acharNaListagem, entrarComoPersona, prepararAcessosDaSimulacao, aprovarCatalogoInicial } from '@uniplus/shared-e2e';

/**
 * Solicitação, ajuste recomendado, aceite e bloqueio da aprovação da proteção de dados do
 * catálogo contra a API real. Isabella administra o catálogo; Caroline é a proteção
 * de dados. Cada execução cria tipos de documento novos, com nome e código próprios.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4203';

interface TipoGravado {
  readonly codigo: string;
  readonly classificacaoProtecao: string;
  readonly protecaoAprovada: boolean;
}

interface ItemDaProtecao {
  readonly codigo: string;
  readonly aprovacao: { readonly situacao: string; readonly classificacaoRecomendada: string | null };
}

interface SituacaoDoTipo {
  readonly situacao: string;
  readonly classificacao: string;
  readonly recomendada: string | null;
}

/**
 * A situação vem da fila da proteção de dados, que lista o que ainda não está aprovado; o tipo
 * que não está nela e consta aprovado na listagem do cadastro é APROVADA.
 */
async function tipoNaApi(codigo: string): Promise<SituacaoDoTipo | undefined> {
  const tipo = await acharNaListagem<TipoGravado>(
    'isabella.figueiredo',
    '/api/configuracao/tipos-documento?limit=100',
    (t) => t.codigo === codigo,
  );
  if (tipo === undefined) return undefined;
  const item = await acharNaListagem<ItemDaProtecao>(
    'isabella.figueiredo',
    '/api/configuracao/admin/protecao-do-catalogo',
    (i) => i.codigo === codigo,
  );
  return {
    situacao: item?.aprovacao.situacao ?? (tipo.protecaoAprovada ? 'APROVADA' : 'DESCONHECIDA'),
    classificacao: tipo.classificacaoProtecao,
    recomendada: item?.aprovacao.classificacaoRecomendada ?? null,
  };
}

async function cadastrarTipo(pagina: Page, nome: string, codigo: string): Promise<void> {
  await expect(pagina.getByRole('heading', { level: 1, name: 'Tipo de Documento' })).toBeVisible();
  await pagina.getByRole('button', { name: 'Novo tipo' }).first().click();
  const form = pagina.locator('#cfg-tipo-documento-form');
  await form.locator('input[formcontrolname="codigo"]').fill(codigo);
  await form.locator('input[formcontrolname="nome"]').fill(nome);
  await form.locator('select[formcontrolname="categoria"]').selectOption({ index: 1 });
  await form.locator('select[formcontrolname="classificacaoProtecao"]').selectOption('INTERNO');
  await form.locator('select[formcontrolname="hipoteseLegal"]').selectOption('CUMPRIMENTO_OBRIGACAO_LEGAL');
  await form.locator('textarea[formcontrolname="finalidadeTratamento"]').fill('Conferência de documento complementar do atendimento especializado.');
  await pagina.getByRole('button', { name: 'Criar tipo de documento' }).click();
  await expect.poll(async () => (await tipoNaApi(codigo))?.situacao).toBe('PENDENTE');
}

async function linhaDoTipo(pagina: Page, codigo: string) {
  await pagina.getByRole('searchbox', { name: 'Buscar tipo de documento' }).fill(codigo);
  return pagina.getByRole('row').filter({ hasText: codigo });
}

async function comoCaroline(browser: Browser): Promise<Page> {
  return entrarComoPersona(browser, APP, 'caroline.jesus', '/protecao-do-catalogo');
}

/** Abre o drawer do item pela linha da fila e abre o diálogo de recomendar ajuste. */
async function abrirRecomendacaoDeAjuste(pagina: Page, nomeDoItem: string): Promise<Locator> {
  await pagina.getByRole('button', { name: `Ver o detalhe de ${nomeDoItem}` }).click();
  await pagina.getByRole('button', { name: 'Recomendar ajuste' }).click();
  return pagina.getByRole('dialog', { name: 'Recomendar ajuste da proteção de dados' });
}

test.describe('Aprovação da proteção de dados dos tipos de documento e dos fatos do candidato', () => {
  test.describe.configure({ mode: 'serial' });

  const sufixo = Date.now();
  const nome = `Laudo médico complementar ${sufixo}`;
  const codigo = `LAUDO_MEDICO_COMPLEMENTAR_${sufixo}`;

  test.beforeAll(async () => {
    test.setTimeout(600_000);
    await prepararAcessosDaSimulacao();
    await aprovarCatalogoInicial();
  });

  test('o tipo novo nasce pendente e a solicitação lista os pendentes antes de enviar', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'isabella.figueiredo', '/tipos-documento');
    await cadastrarTipo(pagina, nome, codigo);

    await pagina.getByRole('button', { name: 'Enviar solicitação' }).click();

    const dialogo = pagina.getByRole('dialog', { name: 'Enviar solicitação de aprovação' });
    await expect(dialogo.getByText(nome)).toBeVisible();
    await dialogo.getByRole('button', { name: /^Enviar \d+ ite/ }).click();

    await expect.poll(async () => (await tipoNaApi(codigo))?.situacao).toBe('SOLICITADA');
    await expect(pagina.getByRole('button', { name: 'Enviar solicitação' })).toHaveCount(0);
  });

  test('o ajuste sem classificação recomendada não é enviado', async ({ browser }) => {
    const pagina = await comoCaroline(browser);
    await expect(pagina.getByRole('heading', { level: 1, name: 'Proteção de dados dos tipos de documento e dos fatos do candidato' })).toBeVisible();

    const dialogo = await abrirRecomendacaoDeAjuste(pagina, nome);
    await dialogo.getByRole('button', { name: 'Recomendar ajuste' }).click();

    await expect(pagina.getByText('Indique a classificação recomendada.')).toBeVisible();
    expect((await tipoNaApi(codigo))?.situacao).toBe('SOLICITADA');
  });

  test('o ajuste recomendado volta ao administrador, que aceita e o tipo fica aprovado como sensível', async ({ browser }) => {
    const caroline = await comoCaroline(browser);
    const dialogo = await abrirRecomendacaoDeAjuste(caroline, nome);
    await dialogo.getByLabel('Classificação recomendada').selectOption('SENSIVEL');
    await dialogo.getByRole('button', { name: 'Recomendar ajuste' }).click();
    await expect.poll(async () => (await tipoNaApi(codigo))?.situacao).toBe('AJUSTE_RECOMENDADO');
    expect((await tipoNaApi(codigo))?.recomendada).toBe('SENSIVEL');

    const isabella = await entrarComoPersona(browser, APP, 'isabella.figueiredo', '/tipos-documento');
    const linha = await linhaDoTipo(isabella, codigo);
    await expect(linha).toContainText(/Ajuste recomendado/i);
    await linha.getByRole('button', { name: `Ver o detalhe de ${nome}` }).click();
    await isabella.getByRole('button', { name: 'Aceitar recomendação' }).click();
    await isabella.getByRole('dialog', { name: 'Aceitar a recomendação' }).getByRole('button', { name: 'Aceitar recomendação' }).click();

    await expect.poll(async () => (await tipoNaApi(codigo))?.situacao).toBe('APROVADA');
    expect((await tipoNaApi(codigo))?.classificacao).toBe('SENSIVEL');
  });

  test('reclassificar item aprovado avisa que ele volta a pendente, e mudar só o nome não avisa', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'isabella.figueiredo', '/tipos-documento');
    await linhaDoTipo(pagina, codigo);
    await pagina.getByRole('button', { name: `Editar tipo de documento ${codigo}` }).click();
    const form = pagina.locator('#cfg-tipo-documento-form');

    await form.locator('input[formcontrolname="nome"]').fill(`${nome} (revisado)`);
    await expect(pagina.getByText('O item volta a pendente')).toHaveCount(0);

    await form.locator('select[formcontrolname="classificacaoProtecao"]').selectOption('INTERNO');
    await expect(pagina.getByText('O item volta a pendente')).toBeVisible();
  });

  test('quem mantém o cadastro, mas não aprova, não entra na fila da proteção de dados', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'isabella.figueiredo', '/protecao-do-catalogo');

    await expect(pagina).toHaveURL(/acesso-negado/);
  });
});
