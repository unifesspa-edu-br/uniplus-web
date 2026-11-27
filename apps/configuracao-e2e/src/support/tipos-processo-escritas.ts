import { expect, type Locator, type Page } from '@playwright/test';
import { problema, type Resposta } from './escritas-retidas';
import {
  atenderEscrita,
  atenderLeitura,
  atenderLeituraEEscrita,
  novoCenario,
  type PrimeiraConsulta,
} from './mock-de-lista-com-escritas';

interface Item {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  criadoEm: string;
}

export const ATIVO: Item = {
  id: '01960000-0000-7000-0000-000000000051',
  codigo: 'SISU',
  nome: 'SiSU',
  descricao: 'Sistema de Seleção Unificada.',
  ativo: true,
  criadoEm: '2026-08-11T12:00:00Z',
};
export const DESATIVADO: Item = {
  id: '01960000-0000-7000-0000-0000000000f0',
  codigo: 'VESTIBULAR_TRAD',
  nome: 'Vestibular tradicional',
  descricao: null,
  ativo: false,
  criadoEm: '2026-05-01T12:00:00Z',
};

export const PROBLEMA_409_CODIGO = problema(
  409,
  'uniplus.configuracao.tipo_processo.codigo_ja_existe',
  'Código do tipo de processo seletivo já está reservado',
);
export const PROBLEMA_409_CONCORRENCIA = problema(
  409,
  'uniplus.configuracao.tipo_processo.conflito_de_concorrencia',
  'Tipo de processo seletivo alterado concorrentemente',
);
export const PROBLEMA_409_CONCORRENCIA_NA_REMOCAO = problema(
  409,
  'uniplus.concorrencia.conflito',
  'Conflito de concorrência',
);
export const PROBLEMA_422_JA_DESATIVADO = problema(
  422,
  'uniplus.configuracao.tipo_processo.ja_desativado',
  'Tipo de processo seletivo já está desativado',
);
export const PROBLEMA_422_JA_ATIVO = problema(
  422,
  'uniplus.configuracao.tipo_processo.ja_ativo',
  'Tipo de processo seletivo já está ativo',
);
export const RECUSA_DE_NOME = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Nome',
    code: 'uniplus.configuracao.tipo_processo.nome_tamanho',
    message: 'Nome fora do padrão.',
  },
]);

/** O que a lista devolve depois da escrita bem-sucedida: os itens, ou a falha da recarga. */
type Recarga = readonly Item[] | 'falha';
export const CRIADO: Resposta = { status: 201 };
export const SALVO: Resposta = { status: 204 };

export const COM_AMBOS: readonly Item[] = [ATIVO, DESATIVADO];
export const SEM_O_ATIVO: readonly Item[] = [DESATIVADO];
export const ATIVO_DESATIVADO: readonly Item[] = [{ ...ATIVO, ativo: false }, DESATIVADO];
export const DESATIVADO_ATIVADO: readonly Item[] = [ATIVO, { ...DESATIVADO, ativo: true }];

export const situacaoDaRecarga = (recarga: Recarga) =>
  recarga === 'falha' ? 'com falha' : 'sem o item';

/** A lista e as escritas compartilham a rota; o método decide quem atende. */
export async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga,
  primeiraConsulta: PrimeiraConsulta = 'ok',
) {
  const cenario = novoCenario(respostas);
  const leitura = { inicial: COM_AMBOS, recarga, primeiraFalha: primeiraConsulta === 'falha' };
  const atender = atenderLeituraEEscrita(atenderLeitura(leitura, cenario), atenderEscrita(cenario));
  await page.route(/\/api\/configuracao\/admin\/tipos-processo(\/[^?]*)?(\?.*)?$/, atender);
  return { liberar: cenario.liberar, envios: cenario.envios };
}

export const titulo = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Tipos de processo', level: 2, exact: true });
export const novo = (page: Page): Locator =>
  page.getByRole('button', { name: 'Novo tipo de processo' });
export const editar = (page: Page): Locator =>
  page.getByRole('button', { name: `Editar tipo de processo ${ATIVO.codigo}` });
export const lixeira = (page: Page): Locator =>
  page.getByRole('button', { name: `Desativar tipo de processo ${ATIVO.codigo}` });
export const reativar = (page: Page): Locator =>
  page.getByRole('button', { name: `Reativar tipo de processo ${DESATIVADO.codigo}` });
export const desativarAposReativar = (page: Page): Locator =>
  page.getByRole('button', { name: `Desativar tipo de processo ${DESATIVADO.codigo}` });
export const reativarAposDesativar = (page: Page): Locator =>
  page.getByRole('button', { name: `Reativar tipo de processo ${ATIVO.codigo}` });
const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de tipo de processo' });

export const campoNome = (formulario: Locator): Locator =>
  formulario.locator('input[formcontrolname="nome"]');
export const criarTipo = (formulario: Locator): Locator =>
  formulario.getByRole('button', { name: 'Criar tipo de processo' });
export const salvarTipo = (formulario: Locator): Locator =>
  formulario.getByRole('button', { name: 'Salvar tipo de processo' });

export async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/tipos-processo');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await campoNome(formulario).fill('Novo tipo');
  return formulario;
}

export async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/tipos-processo');
  await editar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  return formulario;
}

export async function abrirConfirmacao(page: Page, qual: 'desativar' | 'reativar') {
  const desativar = qual === 'desativar';
  await page.goto('/tipos-processo');
  await (desativar ? lixeira(page) : reativar(page)).click();
  const nomeDoDialogo = desativar ? 'Desativar tipo de processo' : 'Reativar tipo de processo';
  const dialogo = page.getByRole('dialog', { name: nomeDoDialogo, exact: true });
  const nome = desativar ? 'Desativar' : 'Reativar';
  return { dialogo, confirmar: dialogo.getByRole('button', { name: nome, exact: true }) };
}
