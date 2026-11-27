import { expect, type Locator, type Page } from '@playwright/test';
import { problema, servirLeitura, type Resposta } from './escritas-retidas';
import {
  leituraDoItem,
  novoCenario,
  registrarRotas,
  type PrimeiraConsulta,
  type Recarga,
} from './mock-de-lista-com-escritas';
import { categoriasSeed, rgSeed as TIPO } from './tipos-documento-api';

export const PROBLEMA_409_DUPLICADO = problema(
  409,
  'uniplus.configuracao.tipo_documento.codigo_ja_existe',
  'Já existe um tipo de documento ativo com este código',
);
export const PROBLEMA_409_CONCORRENCIA = problema(
  409,
  'uniplus.concorrencia.conflito',
  'Conflito de concorrência',
);
export const PROBLEMA_409_CONCORRENCIA_DO_TIPO = {
  ...PROBLEMA_409_CONCORRENCIA,
  code: 'uniplus.configuracao.tipo_documento.conflito_de_concorrencia',
};
export const PROBLEMA_404 = problema(
  404,
  'uniplus.configuracao.tipo_documento.nao_encontrado',
  'Tipo de documento não encontrado',
);
const CODIGO_DO_NOME = 'uniplus.configuracao.tipo_documento.nome_tamanho';
export const RECUSA_DE_NOME = {
  ...problema(422, CODIGO_DO_NOME, 'Dados inválidos'),
  errors: [{ field: 'nome', code: CODIGO_DO_NOME, message: 'Nome fora do padrão.' }],
};

export const CRIADO: Resposta = { status: 201 };
export const SALVO: Resposta = { status: 204 };

const ROTAS = {
  lista: /\/api\/configuracao\/tipos-documento(\?.*)?$/,
  escritas: [
    /\/api\/configuracao\/admin\/tipos-documento\/[^/?]+$/,
    /\/api\/configuracao\/admin\/tipos-documento(\?.*)?$/,
  ],
};

async function servirApoios(page: Page): Promise<void> {
  await servirLeitura(page, /\/api\/configuracao\/categorias-documento(\?.*)?$/, categoriasSeed);
  await servirLeitura(page, /\/api\/configuracao\/admin\/protecao-do-catalogo(\?.*)?$/, []);
}

export async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga,
  primeiraConsulta: PrimeiraConsulta = 'ok',
) {
  const cenario = novoCenario(respostas);
  await servirApoios(page);
  await registrarRotas(page, ROTAS, leituraDoItem(TIPO, recarga, primeiraConsulta), cenario);
  return { liberar: cenario.liberar, envios: cenario.envios, chaves: cenario.chaves };
}

export const titulo = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Tipos de documento', level: 2 });
export const novo = (page: Page): Locator =>
  page.getByRole('button', { name: 'Novo tipo' }).first();
export const editar = (page: Page): Locator =>
  page.getByRole('button', { name: `Editar tipo de documento ${TIPO.codigo}`, exact: true });
export const lixeira = (page: Page): Locator =>
  page.getByRole('button', { name: `Remover tipo de documento ${TIPO.codigo}`, exact: true });
const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de tipo de documento', exact: true });
const confirmacao = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Remover tipo de documento', exact: true });
export const salvarDe = (formulario: Locator): Locator =>
  formulario.getByRole('button', { name: /^(Criar|Salvar) tipo de documento$/ });
export const campo = (formulario: Locator, nome: string): Locator =>
  formulario.locator(`[formControlName="${nome}"]`);

async function preencherCadastro(formulario: Locator): Promise<void> {
  await campo(formulario, 'codigo').fill('DECL_RENDA');
  await campo(formulario, 'nome').fill('Declaração de renda');
  await campo(formulario, 'categoria').selectOption('RENDA');
  await campo(formulario, 'classificacaoProtecao').selectOption('PESSOAL');
  await campo(formulario, 'hipoteseLegal').selectOption({
    label: 'Execução de políticas públicas',
  });
  await campo(formulario, 'finalidadeTratamento').fill('Comprovar a renda do candidato.');
}

export async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/tipos-documento');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await preencherCadastro(formulario);
  return formulario;
}

export async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/tipos-documento');
  await editar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  return formulario;
}

export async function abrirRemocao(page: Page) {
  await page.goto('/tipos-documento');
  await lixeira(page).click();
  const dialogo = confirmacao(page);
  return { dialogo, remover: dialogo.getByRole('button', { name: 'Remover', exact: true }) };
}
