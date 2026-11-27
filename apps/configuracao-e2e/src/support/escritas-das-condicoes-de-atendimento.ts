import type { Locator, Page } from '@playwright/test';
import { mockCadastro, type Cadastro, type RecargaDeCadastro } from './api-de-cadastro-simples';
import { problema, type Resposta } from './escritas-retidas';
import { abrirFormulario, campo, pedirConfirmacaoDeRemocao } from './passos-de-cadastro-simples';

const CAMINHO = '/condicoes-atendimento';

export const LEDOR = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'LEDOR',
  nome: 'Ledor',
  descricao: null,
  criadoEm: '2026-06-10T12:00:00Z',
};
export const PCD = {
  ...LEDOR,
  id: '01960000-0000-7000-0000-0000000000c2',
  codigo: 'PCD',
  nome: 'Pcd',
};

const CADASTRO: Cadastro = {
  leitura: /\/api\/configuracao\/condicoes-atendimento(\?.*)?$/,
  escrita: /\/api\/configuracao\/admin\/condicoes-atendimento(\/[^/?]+)?$/,
  item: LEDOR,
};

export const PROBLEMA_409 = problema(
  409,
  'uniplus.configuracao.condicao_atendimento.remocao_bloqueada_codigo_protegido',
  'A condição reservada não pode ser removida',
);
export const PROBLEMA_422 = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Nome',
    code: 'uniplus.configuracao.condicao_atendimento.nome_tamanho',
    message: 'Nome fora do padrão.',
  },
]);
export const PROBLEMA_DUPLICADO = problema(
  409,
  'uniplus.configuracao.condicao_atendimento.codigo_ja_existe',
  'Já existe uma condição de atendimento ativa com este código',
);
export const PROBLEMA_PROCESSANDO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);

export const mockApi = (
  page: Page,
  respostas: readonly Resposta[],
  recarga: RecargaDeCadastro,
  inicial: readonly unknown[] = [LEDOR],
) => mockCadastro(page, { cadastro: CADASTRO, recarga, inicial }, respostas);

export const titulo = (page: Page) =>
  page.getByRole('heading', { name: 'Condições de atendimento', level: 2 });
export const editar = (page: Page, nome = /^Editar condição de atendimento LEDOR$/) =>
  page.getByRole('button', { name: nome });
export const remover = (page: Page) =>
  page.getByRole('button', { name: /^Remover condição de atendimento LEDOR$/ });
export const novo = (page: Page) => page.getByRole('button', { name: 'Nova condição' }).first();
export const regiaoDeStatus = (page: Page) =>
  page.locator('cfg-condicoes-atendimento-page > [role="status"]');

export const abrirDrawer = (page: Page, abrir: () => Promise<void>) =>
  abrirFormulario(page, CAMINHO, 'Formulário da condição de atendimento', abrir);
export const abrirEdicao = (page: Page) => abrirDrawer(page, () => editar(page).click());
export const abrirCadastro = (page: Page) => abrirDrawer(page, () => novo(page).click());

export const pedirRemocao = (page: Page) =>
  pedirConfirmacaoDeRemocao(page, CAMINHO, /^Remover condição de atendimento/, remover(page));

export async function preencherCadastro(drawer: Locator): Promise<void> {
  await campo(drawer, 'codigo').fill('DISLEXIA');
  await campo(drawer, 'nome').fill('Dislexia');
}
