import { type Locator, type Page, type Route } from '@playwright/test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const REITORIA_ID = '01960000-0000-7000-0000-000000000001';
export const INSTITUICAO = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigoEmec: '3990',
  nome: 'Universidade Federal do Sul e Sudeste do Pará',
  sigla: 'Unifesspa',
  organizacaoAcademica: 'Universidade',
  categoriaAdministrativa: 'Pública Federal',
  cnpj: null,
  mantenedora: null,
  codigoMantenedoraEmec: null,
  situacao: null,
  atoCredenciamento: null,
  atoRecredenciamento: null,
  conceitoInstitucional: null,
  igc: null,
  website: null,
  cidade: null,
  endereco: null,
  unidadeRaizId: REITORIA_ID,
  criadoEm: '2026-06-10T12:00:00Z',
};
const REITORIA = {
  id: REITORIA_ID,
  nome: 'Reitoria',
  alias: null,
  slug: 'reitoria',
  sigla: 'REITORIA',
  codigo: 'REITORIA',
  unidadeSuperiorId: null,
  tipo: 'REITORIA',
  unidadeAcademica: false,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
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

/** Atraso da recarga após a escrita: os botões da página ainda estão indisponíveis quando a sobreposição fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const problema = (status: number, code: string, title: string, errors?: unknown[]) => ({
  type: 'about:blank',
  title,
  status,
  code,
  ...(errors === undefined ? {} : { errors }),
});

export const RECUSA_DO_CNPJ = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Cnpj',
    code: 'uniplus.organizacao.instituicao.campo_opcional_tamanho',
    message: 'CNPJ fora do padrão.',
  },
]);
export const RECUSA_DO_ENDERECO = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'CidadeCodigoIbge',
    code: 'uniplus.endereco_referencia.cidade_incoerente',
    message: 'A cidade não corresponde ao CEP informado.',
  },
]);
export const JA_EXISTE = problema(
  409,
  'uniplus.organizacao.instituicao.ja_existe',
  'Já existe uma instituição cadastrada — a plataforma atende uma única instituição',
);
export const PROCESSAMENTO_EM_CURSO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);
export const NAO_ENCONTRADA = problema(
  404,
  'uniplus.organizacao.instituicao.nao_encontrada',
  'Instituição não encontrada',
);
export const ERRO_INTERNO = problema(
  500,
  'uniplus.internal.unexpected',
  'Falha ao gravar a instituição',
);

type Recarga = 'com-a-instituicao' | 'sem-a-instituicao' | 'com-falha';
type Resposta = { status: number; corpo?: unknown };

async function responder(route: Route, { status, corpo }: Resposta): Promise<void> {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    ...(corpo === undefined
      ? {}
      : {
          contentType: status >= 400 ? 'application/problem+json' : 'application/json',
          body: JSON.stringify(corpo),
        }),
  });
}

interface OpcoesDoMock {
  readonly recarga?: Recarga;
  readonly primeiraConsulta?: 'ok' | 'falha';
  readonly cadastrada?: boolean;
}

/**
 * Cada escrita consome a próxima resposta (a última se repete) e fica retida até `liberar`. A
 * recarga que segue uma escrita aceita demora `ATRASO_DA_RECARGA_EM_MS` e responde conforme
 * `recarga`; sem escrita aceita, a leitura responde com a instituição (ou 404, se `cadastrada` é
 * falso).
 */
type Estado = {
  aceita: boolean;
  consultas: number;
  envios: string[];
  chaves: string[];
  retida: Promise<void>;
  respostas: readonly Resposta[];
  opcoes: OpcoesDoMock;
};

async function rotasBasicas(page: Page) {
  await page.route(/\/api\/cep\/68507590$/, (r) =>
    responder(r, { status: 200, corpo: CEP_LOGRADOURO }),
  );
  await page.route(/\/api\/cidades(\?.*)?$/, (r) => responder(r, { status: 200, corpo: [] }));
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, (r) =>
    responder(r, { status: 200, corpo: [REITORIA] }),
  );
}

function respostaDaLeitura(estado: Estado): Resposta {
  const { recarga = 'com-a-instituicao', cadastrada = true } = estado.opcoes;
  if (estado.aceita && recarga === 'com-falha') return { status: 500, corpo: ERRO_INTERNO };
  const ausente = estado.aceita ? recarga === 'sem-a-instituicao' : !cadastrada;
  return ausente ? { status: 404 } : { status: 200, corpo: INSTITUICAO };
}

async function responderLeitura(route: Route, estado: Estado) {
  estado.consultas += 1;
  if (estado.opcoes.primeiraConsulta === 'falha' && estado.consultas === 1) {
    await responder(route, { status: 500, corpo: ERRO_INTERNO });
    return;
  }
  if (estado.aceita || estado.consultas > 1) {
    await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
  }
  await responder(route, respostaDaLeitura(estado));
}

async function rotaLeitura(page: Page, estado: Estado) {
  await page.route(/\/api\/organizacao\/instituicao$/, (route) => responderLeitura(route, estado));
}

async function responderEscrita(route: Route, estado: Estado) {
  const requisicao = route.request();
  if (requisicao.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  const resposta = estado.respostas[Math.min(estado.envios.length, estado.respostas.length - 1)];
  estado.envios.push(requisicao.method());
  estado.chaves.push(requisicao.headers()['idempotency-key'] ?? '');
  await estado.retida;
  estado.aceita =
    resposta.status < 400 || (resposta.status === 404 && requisicao.method() === 'DELETE');
  await responder(route, resposta);
}

async function rotaEscrita(page: Page, estado: Estado) {
  await page.route(/\/api\/organizacao\/admin\/instituicao(\/[^/?]+)?$/, (route) =>
    responderEscrita(route, estado),
  );
}

function criarEstado(
  respostas: readonly Resposta[],
  opcoes: OpcoesDoMock,
  retida: Promise<void>,
): Estado {
  return { aceita: false, consultas: 0, envios: [], chaves: [], retida, respostas, opcoes };
}

export async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  opcoes: OpcoesDoMock = {},
) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const estado = criarEstado(respostas, opcoes, retida);
  await rotasBasicas(page);
  await rotaLeitura(page, estado);
  await rotaEscrita(page, estado);
  return { liberar, envios: estado.envios, chaves: estado.chaves };
}

export const titulo = (page: Page) => page.getByRole('heading', { name: 'Instituição', level: 1 });
export const principal = (page: Page) => page.locator('#cfg-instituicao-acao');
export const drawer = (page: Page) =>
  page.getByRole('dialog', { name: 'Formulário da instituição' });
const confirmacao = (page: Page) => page.getByRole('dialog', { name: 'Remover instituição' });

/** Abre o formulário pelo botão principal: edita a instituição cadastrada ou, sem ela, cadastra. */
export async function abrirFormulario(
  page: Page,
): Promise<{ acionador: Locator; formulario: Locator }> {
  await page.goto('/instituicao');
  const acionador = principal(page);
  await acionador.click();
  return { acionador, formulario: drawer(page) };
}

export async function preencherObrigatorios(formulario: Locator): Promise<void> {
  await formulario.locator('[formControlName="nome"]').fill(INSTITUICAO.nome);
  await formulario.locator('[formControlName="sigla"]').fill(INSTITUICAO.sigla);
  await formulario.locator('[formControlName="codigoEmec"]').fill(INSTITUICAO.codigoEmec);
  await formulario
    .locator('[formControlName="organizacaoAcademica"]')
    .fill(INSTITUICAO.organizacaoAcademica);
  await formulario
    .locator('[formControlName="categoriaAdministrativa"]')
    .fill(INSTITUICAO.categoriaAdministrativa);
}

export async function abrirConfirmacao(
  page: Page,
): Promise<{ dialogo: Locator; remover: Locator }> {
  const { formulario } = await abrirFormulario(page);
  const remover = formulario.getByRole('button', { name: 'Remover' });
  await remover.click();
  return { dialogo: confirmacao(page), remover };
}
