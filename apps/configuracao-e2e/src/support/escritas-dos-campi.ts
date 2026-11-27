import { expect, type Locator, type Page, type Route } from '@playwright/test';
import {
  esperarARecarga,
  problema,
  reter,
  responder,
  responderPreflight,
  type Resposta,
} from './escritas-retidas';

const CAMPUS = {
  id: '01960000-0000-7000-0000-0000000000b1',
  sigla: 'MARABA',
  nome: 'Campus de Marabá',
  codigoEmec: '12345',
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const CEP_LOGRADOURO = {
  cep: '68507590',
  tipo: 'Rua',
  logradouro: 'Folha 31, Quadra 7',
  complemento: null,
  bairro: 'Nova Marabá',
  distrito: null,
  cidade: 'Marabá',
  codigoIbge: '1504208',
  uf: 'PA',
  latitude: '-5.368',
  longitude: '-49.118',
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
};

export const ERRO_INTERNO = problema(
  500,
  'uniplus.internal.unexpected',
  'Falha ao gravar o campus',
);
export const RECUSA_DA_SIGLA = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Sigla',
    code: 'uniplus.configuracao.campus.sigla_tamanho',
    message: 'Sigla fora do padrão.',
  },
]);
export const RECUSA_DO_ENDERECO = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'CidadeCodigoIbge',
    code: 'uniplus.configuracao.campus.cidade_divergente',
    message: 'A cidade não corresponde ao CEP informado.',
  },
]);
export const SIGLA_JA_EXISTE = problema(
  409,
  'uniplus.configuracao.campus.sigla_ja_existe',
  'Já existe um campus ativo com esta sigla',
);
export const PROCESSAMENTO_EM_CURSO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);
export const REMOCAO_BLOQUEADA = problema(
  409,
  'uniplus.configuracao.campus.remocao_bloqueada_por_local_oferta',
  'Não é possível remover um campus responsável por locais de oferta ativos',
);

type Recarga = 'com-o-campus' | 'sem-o-campus' | 'com-falha';
type Cenario = { recarga: Recarga; primeiraConsulta: 'ok' | 'falha' };
type EstadoDoMock = {
  envios: string[];
  chaves: string[];
  retida: Promise<void>;
  aceita: boolean;
  consultas: number;
};

async function responderALista(route: Route, estado: EstadoDoMock, cenario: Cenario) {
  estado.consultas += 1;
  const primeira = estado.consultas === 1;
  const falha = { status: 500, corpo: ERRO_INTERNO };
  if (primeira && cenario.primeiraConsulta === 'falha') return responder(route, falha);
  if (estado.aceita || !primeira) await esperarARecarga();
  if (estado.aceita && cenario.recarga === 'com-falha') return responder(route, falha);
  const semCampus = estado.aceita && cenario.recarga === 'sem-o-campus';
  return responder(route, { status: 200, corpo: semCampus ? [] : [CAMPUS] });
}

async function responderAEscrita(
  route: Route,
  respostas: readonly Resposta[],
  estado: EstadoDoMock,
) {
  const requisicao = route.request();
  if (requisicao.method() === 'OPTIONS') return responderPreflight(route);
  const resposta = respostas[Math.min(estado.envios.length, respostas.length - 1)];
  estado.envios.push(requisicao.method());
  estado.chaves.push(requisicao.headers()['idempotency-key'] ?? '');
  await estado.retida;
  estado.aceita = resposta.status < 400;
  return responder(route, resposta);
}

async function servirCep(page: Page): Promise<void> {
  await page.route(/\/api\/cep\/68507590$/, (r) =>
    responder(r, { status: 200, corpo: CEP_LOGRADOURO }),
  );
  await page.route(/\/api\/cidades(\?.*)?$/, (r) => responder(r, { status: 200, corpo: [] }));
}

async function servirAdministracao(
  page: Page,
  respostas: readonly Resposta[],
  estado: EstadoDoMock,
) {
  await page.route(/\/api\/configuracao\/admin\/campi(\/[^/?]+)?$/, (route) =>
    responderAEscrita(route, respostas, estado),
  );
}

async function servirLista(page: Page, estado: EstadoDoMock, cenario: Cenario) {
  await page.route(/\/api\/configuracao\/campi(\?.*)?$/, (route) =>
    responderALista(route, estado, cenario),
  );
}

/**
 * Cada escrita consome a próxima resposta (a última se repete) e fica retida até `liberar`. A
 * recarga que segue uma escrita aceita demora o atraso da recarga e responde conforme
 * `recarga`; sem escrita aceita, a lista responde com o campus.
 */
export async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga = 'com-o-campus',
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  const { retida, liberar } = reter();
  const estado: EstadoDoMock = { envios: [], chaves: [], retida, aceita: false, consultas: 0 };
  await servirCep(page);
  await servirLista(page, estado, { recarga, primeiraConsulta });
  await servirAdministracao(page, respostas, estado);
  return { liberar, envios: estado.envios, chaves: estado.chaves };
}

export const titulo = (page: Page) => page.getByRole('heading', { name: 'Campi', level: 2 });
const drawer = (page: Page) => page.getByRole('dialog', { name: 'Formulário de campus' });
const confirmacao = (page: Page) => page.getByRole('dialog', { name: 'Remover campus' });

export async function abrirEdicao(
  page: Page,
): Promise<{ acionador: Locator; formulario: Locator }> {
  await page.goto('/campi');
  const acionador = page.getByRole('button', { name: 'Editar campus MARABA' });
  await acionador.click();
  return { acionador, formulario: drawer(page) };
}

export async function abrirConfirmacao(
  page: Page,
): Promise<{ acionador: Locator; dialogo: Locator }> {
  await page.goto('/campi');
  const acionador = page.getByRole('button', { name: 'Remover campus MARABA' });
  await acionador.click();
  return { acionador, dialogo: confirmacao(page) };
}

export async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/campi');
  await page.getByRole('button', { name: 'Novo campus' }).first().click();
  return drawer(page);
}

export async function preencherSiglaENome(formulario: Locator): Promise<void> {
  await formulario.locator('[formControlName="sigla"]').fill('PARAUAPEBAS');
  await formulario.locator('[formControlName="nome"]').fill('Campus de Parauapebas');
}

export async function buscarOCep(page: Page): Promise<void> {
  await page.locator('#campus-endereco-cep').fill('68507590');
  await page.getByRole('button', { name: 'Buscar CEP' }).click();
  await expect(page.locator('#campus-endereco-logradouro')).toHaveValue('Rua Folha 31, Quadra 7');
}

export async function preencherCadastroComCep(page: Page): Promise<Locator> {
  const formulario = await abrirCadastro(page);
  await preencherSiglaENome(formulario);
  await buscarOCep(page);
  return formulario;
}
