import { expect, type Locator, type Page } from '@playwright/test';
import { problema, type Resposta } from './escritas-retidas';
import {
  leituraDoItem,
  novoCenario,
  registrarRotas,
  type PrimeiraConsulta,
  type Recarga,
} from './mock-de-lista-com-escritas';

export const TIPO = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'RESULTADO_PRELIMINAR_INSCRICAO',
  nome: 'Resultado preliminar da inscrição',
  congelaConfiguracao: true,
  unicoPorObjeto: false,
  efeitoIrreversivel: false,
  ehResultado: true,
  publicavelComoAvulso: false,
  exigeAtoCorrigido: false,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  baseLegal: null,
  criadoEm: '2026-08-30T12:00:00Z',
};

const IDENTIFICACAO = `${TIPO.codigo}, vigência iniciada em 01/01/2026`;

export const PROBLEMA_409_SOBREPOSICAO = problema(
  409,
  'uniplus.publicacoes.tipo_ato.vigencia_sobreposta',
  'Vigência sobreposta',
);
export const PROBLEMA_404 = problema(
  404,
  'uniplus.publicacoes.tipo_ato.nao_encontrado',
  'Tipo de ato não encontrado',
);
export const RECUSA_DE_NOME = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Nome',
    code: 'uniplus.publicacoes.tipo_ato.nome_tamanho',
    message: 'Nome fora do padrão.',
  },
]);

export const CRIADO: Resposta = { status: 201 };
export const SALVO: Resposta = { status: 204 };

const ROTAS = {
  lista: /\/api\/publicacoes\/tipos-ato(\?.*)?$/,
  escritas: [
    /\/api\/publicacoes\/admin\/tipos-ato\/[^/?]+$/,
    /\/api\/publicacoes\/admin\/tipos-ato(\?.*)?$/,
  ],
};

export async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga,
  primeiraConsulta: PrimeiraConsulta = 'ok',
) {
  const cenario = novoCenario(respostas);
  await registrarRotas(page, ROTAS, leituraDoItem(TIPO, recarga, primeiraConsulta), cenario);
  return { liberar: cenario.liberar, envios: cenario.envios };
}

export const titulo = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Tipos de ato', level: 2 });
export const novo = (page: Page): Locator => page.getByRole('button', { name: 'Novo tipo de ato' });
export const editar = (page: Page): Locator =>
  page.getByRole('button', { name: `Editar tipo de ato ${IDENTIFICACAO}`, exact: true });
export const lixeira = (page: Page): Locator =>
  page.getByRole('button', {
    name: `Remover vigência do tipo de ato ${IDENTIFICACAO}`,
    exact: true,
  });
const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de tipo de ato' });
const confirmacao = (page: Page): Locator => page.getByRole('dialog', { name: 'Remover vigência' });

export const campoNome = (formulario: Locator): Locator =>
  formulario.locator('input[formcontrolname="nome"]');
export const salvarTipo = (formulario: Locator): Locator =>
  formulario.getByRole('button', { name: 'Salvar tipo de ato' });

/** A ajuda dos dois grupos cita "Não"; só o rótulo da opção tem esse texto inteiro. */
async function responderNao(formulario: Locator, pergunta: string): Promise<void> {
  const grupo = formulario.getByRole('radiogroup', { name: pergunta });
  await grupo.getByText('Não', { exact: true }).click();
  await expect(grupo.getByRole('radio', { name: 'Não', exact: true })).toBeChecked();
}

export async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/tipos-ato');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await formulario.locator('input[formcontrolname="codigo"]').fill(TIPO.codigo);
  await campoNome(formulario).fill('Nova vigência');
  await formulario.locator('input[formcontrolname="vigenciaInicio"]').fill('2026-02-01');
  await responderNao(formulario, 'Pode ser publicado como documento avulso do processo');
  await responderNao(formulario, 'Corrige sempre outro ato');
  return formulario;
}

export async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/tipos-ato');
  await editar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  return formulario;
}

export async function abrirRemocao(page: Page) {
  await page.goto('/tipos-ato');
  await lixeira(page).click();
  const dialogo = confirmacao(page);
  return { dialogo, remover: dialogo.getByRole('button', { name: 'Remover', exact: true }) };
}
