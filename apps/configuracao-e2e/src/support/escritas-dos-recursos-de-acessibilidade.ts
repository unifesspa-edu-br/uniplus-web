import type { Locator, Page } from '@playwright/test';
import { mockCadastro, type Cadastro, type RecargaDeCadastro } from './api-de-cadastro-simples';
import { problema, type Resposta } from './escritas-retidas';
import { abrirFormulario, campo, pedirConfirmacaoDeRemocao } from './passos-de-cadastro-simples';

const CAMINHO = '/recursos-acessibilidade';

export const LEDOR = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'LEDOR',
  nome: 'Ledor',
  descricao: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const CADASTRO: Cadastro = {
  leitura: /\/api\/configuracao\/recursos-acessibilidade(\?.*)?$/,
  escrita: /\/api\/configuracao\/admin\/recursos-acessibilidade(\/[^/?]+)?$/,
  item: LEDOR,
};

export const PROBLEMA_404 = problema(
  404,
  'uniplus.configuracao.recurso_acessibilidade.nao_encontrado',
  'Recurso de acessibilidade não encontrado',
);
export const PROBLEMA_422 = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Nome',
    code: 'uniplus.configuracao.recurso_acessibilidade.nome_tamanho',
    message: 'Nome fora do padrão.',
  },
]);
export const PROBLEMA_CODIGO_DUPLICADO = problema(
  409,
  'uniplus.configuracao.recurso_acessibilidade.codigo_ja_existe',
  'Já existe um recurso de acessibilidade ativo com este código',
);
export const PROBLEMA_NOME_DUPLICADO = problema(
  409,
  'uniplus.configuracao.recurso_acessibilidade.nome_ja_existe',
  'Já existe um recurso de acessibilidade ativo com este nome',
);
export const PROBLEMA_PROCESSANDO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);

export const mockApi = (page: Page, respostas: readonly Resposta[], recarga: RecargaDeCadastro) =>
  mockCadastro(page, { cadastro: CADASTRO, recarga, inicial: [LEDOR] }, respostas);

export const titulo = (page: Page) =>
  page.getByRole('heading', { name: 'Recursos de acessibilidade', level: 2 });
export const editar = (page: Page, nome = /^Editar recurso de acessibilidade LEDOR$/) =>
  page.getByRole('button', { name: nome });
export const remover = (page: Page) =>
  page.getByRole('button', { name: /^Remover recurso de acessibilidade LEDOR$/ });
export const novo = (page: Page) => page.getByRole('button', { name: 'Novo recurso' }).first();
export const regiaoDeStatus = (page: Page) =>
  page.locator('cfg-recurso-acessibilidade-list > [role="status"]');

const abrirDrawer = (page: Page, abrir: () => Promise<void>) =>
  abrirFormulario(page, CAMINHO, 'Formulário do recurso de acessibilidade', abrir);
export const abrirEdicao = (page: Page) => abrirDrawer(page, () => editar(page).click());
export const abrirCadastro = (page: Page) => abrirDrawer(page, () => novo(page).click());

export const abrirLista = (page: Page) => page.goto(CAMINHO);

export const pedirRemocao = (page: Page) =>
  pedirConfirmacaoDeRemocao(page, CAMINHO, /^Remover recurso de acessibilidade/, remover(page));

export async function preencherCadastro(drawer: Locator): Promise<void> {
  await campo(drawer, 'nome').fill('Sala de apoio');
  await campo(drawer, 'codigo').fill('SALA_DE_APOIO');
}
