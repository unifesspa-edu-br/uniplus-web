import type { Locator, Page } from '@playwright/test';
import { mockCadastro, type Cadastro, type RecargaDeCadastro } from './api-de-cadastro-simples';
import { problema, type Resposta } from './escritas-retidas';
import { abrirFormulario, campo, pedirConfirmacaoDeRemocao } from './passos-de-cadastro-simples';

const CAMINHO = '/tipos-deficiencia';

export const VISUAL = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'VISUAL',
  nome: 'Visual',
  descricao: 'Baixa visão',
  permanente: true,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const CADASTRO: Cadastro = {
  leitura: /\/api\/configuracao\/tipos-deficiencia(\?.*)?$/,
  escrita: /\/api\/configuracao\/admin\/tipos-deficiencia(\/[^/?]+)?$/,
  item: VISUAL,
};

export const PROBLEMA_404 = problema(
  404,
  'uniplus.configuracao.tipo_deficiencia.nao_encontrado',
  'Tipo de deficiência não encontrado',
);
export const PROBLEMA_422 = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Nome',
    code: 'uniplus.configuracao.tipo_deficiencia.nome_tamanho',
    message: 'Nome fora do padrão.',
  },
]);
export const PROBLEMA_CODIGO_DUPLICADO = problema(
  409,
  'uniplus.configuracao.tipo_deficiencia.codigo_ja_existe',
  'Já existe um tipo de deficiência ativo com este código',
);
export const PROBLEMA_NOME_DUPLICADO = problema(
  409,
  'uniplus.configuracao.tipo_deficiencia.nome_ja_existe',
  'Já existe um tipo de deficiência ativo com este nome',
);
export const PROBLEMA_PROCESSANDO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);

export const mockApi = (page: Page, respostas: readonly Resposta[], recarga: RecargaDeCadastro) =>
  mockCadastro(page, { cadastro: CADASTRO, recarga, inicial: [VISUAL] }, respostas);

export const titulo = (page: Page) =>
  page.getByRole('heading', { name: 'Tipos de deficiência', level: 2 });
export const editar = (page: Page, nome = /^Editar tipo de deficiência VISUAL$/) =>
  page.getByRole('button', { name: nome });
export const remover = (page: Page) =>
  page.getByRole('button', { name: /^Remover tipo de deficiência VISUAL$/ });
export const novo = (page: Page) => page.getByRole('button', { name: 'Novo tipo' }).first();
export const regiaoDeStatus = (page: Page) =>
  page.locator('cfg-tipos-deficiencia-list > [role="status"]');

const abrirDrawer = (page: Page, abrir: () => Promise<void>) =>
  abrirFormulario(page, CAMINHO, 'Formulário do tipo de deficiência', abrir);
export const abrirEdicao = (page: Page) => abrirDrawer(page, () => editar(page).click());
export const abrirCadastro = (page: Page) => abrirDrawer(page, () => novo(page).click());

export const abrirLista = (page: Page) => page.goto(CAMINHO);

export const pedirRemocao = (page: Page) =>
  pedirConfirmacaoDeRemocao(page, CAMINHO, /^Remover tipo de deficiência/, remover(page));

export async function preencherCadastro(drawer: Locator): Promise<void> {
  await campo(drawer, 'nome').fill('Auditiva');
  await campo(drawer, 'codigo').fill('AUDITIVA');
  await campo(drawer, 'descricao').fill('Perda auditiva');
}
