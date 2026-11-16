import type { Page, Request, Route } from '@playwright/test';

export const UNIDADES = [
  {
    id: '01960000-0000-7000-0000-000000000001',
    nome: 'Reitoria',
    alias: null,
    slug: 'reitoria',
    sigla: 'REITORIA',
    codigo: 'REITORIA',
    unidadeSuperiorId: null,
    tipo: 'Reitoria',
    unidadeAcademica: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    criadoEm: '2026-06-10T12:00:00Z',
  },
  {
    id: '01960000-0000-7000-0000-000000000002',
    nome: 'Pró-Reitoria de Ensino de Graduação',
    alias: 'PROEG',
    slug: 'proeg',
    sigla: 'PROEG',
    codigo: 'PROEG',
    unidadeSuperiorId: '01960000-0000-7000-0000-000000000001',
    tipo: 'Pro-Reitoria',
    unidadeAcademica: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    criadoEm: '2026-06-10T12:01:00Z',
  },
  {
    id: '01960000-0000-7000-0000-000000000003',
    nome: 'Centro de Processos Seletivos',
    alias: 'CEPS',
    slug: 'ceps',
    sigla: 'CEPS',
    codigo: 'CEPS',
    unidadeSuperiorId: '01960000-0000-7000-0000-000000000002',
    tipo: 'Centro',
    unidadeAcademica: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    criadoEm: '2026-06-10T12:02:00Z',
  },
  {
    id: '01960000-0000-7000-0000-000000000004',
    nome: 'Centro de Tecnologia da Informação e Comunicação',
    alias: 'CTIC',
    slug: 'ctic',
    sigla: 'CTIC',
    codigo: 'CTIC',
    unidadeSuperiorId: '01960000-0000-7000-0000-000000000001',
    tipo: 'Centro',
    unidadeAcademica: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    criadoEm: '2026-06-10T12:03:00Z',
  },
] as const;

const CORS_DAS_UNIDADES = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const RECUSA_DE_IDEMPOTENCIA = {
  status: 422,
  headers: { ...CORS_DAS_UNIDADES, 'content-type': 'application/problem+json' },
  body: JSON.stringify({
    type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.idempotency.body_mismatch',
    title: 'Mesma Idempotency-Key reusada com body diferente',
    status: 422,
    detail: 'Mesma Idempotency-Key reusada com body diferente.',
    instance: 'urn:uuid:019eb1f6-4dd7-75dd-9265-385cadfdec34',
    code: 'uniplus.idempotency.body_mismatch',
    traceId: 'visual-idempotency',
  }),
};

const RECUSA_DE_VALIDACAO = {
  status: 422,
  headers: { ...CORS_DAS_UNIDADES, 'content-type': 'application/problem+json' },
  body: JSON.stringify({
    type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.validacao',
    title: 'Erro de validação',
    status: 422,
    code: 'uniplus.validacao',
    traceId: 'visual-validation',
    errors: [
      {
        field: 'VigenciaFim',
        code: 'GreaterThanOrEqualValidator',
        message: 'Data de encerramento deve ser igual ou posterior à data de início.',
      },
    ],
  }),
};

const UNIDADE_CRIADA = {
  status: 201,
  headers: { ...CORS_DAS_UNIDADES, 'content-type': 'application/json' },
  body: JSON.stringify('01960000-0000-7000-0000-000000000099'),
};

type DesfechoDaCriacao = 'validacao' | 'idempotencia-divergente' | 'criada';

const RESPOSTAS_DA_CRIACAO = {
  validacao: RECUSA_DE_VALIDACAO,
  'idempotencia-divergente': RECUSA_DE_IDEMPOTENCIA,
  criada: UNIDADE_CRIADA,
} satisfies Record<DesfechoDaCriacao, unknown>;

/**
 * A primeira criação é recusada pela validação e fixa a chave de idempotência; reenviar a mesma
 * chave com o fim de vigência corrigido é o reuso com corpo diferente, e uma chave nova cria.
 */
function desfechoDaCriacao(request: Request, chaves: { primeira?: string }): DesfechoDaCriacao {
  const chave = request.headers()['idempotency-key'];
  if (chaves.primeira === undefined) {
    chaves.primeira = chave;
    return 'validacao';
  }
  const corpo = request.postDataJSON() as { vigenciaFim?: string };
  const reuso = chave === chaves.primeira && corpo.vigenciaFim === '2026-06-10';
  return reuso ? 'idempotencia-divergente' : 'criada';
}

function atenderCriacao() {
  const chaves: { primeira?: string } = {};
  return async (route: Route, request: Request): Promise<void> => {
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_DAS_UNIDADES });
      return;
    }
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill(RESPOSTAS_DA_CRIACAO[desfechoDaCriacao(request, chaves)]);
  };
}

// Roster fechado TipoUnidade (valor numérico → label do DTO), espelhando
// TIPOS_UNIDADE da página para traduzir o filtro `?tipo=N` do contrato.
const TIPO_LABEL_POR_VALOR: Record<string, string> = {
  '1': 'Reitoria',
  '2': 'Pro-Reitoria',
  '3': 'Centro',
  '4': 'Instituto',
  '5': 'Faculdade',
  '6': 'Departamento',
  '7': 'Coordenacao',
  '8': 'Diretoria',
  '9': 'Divisao',
  '10': 'Nucleo',
  '11': 'Outro',
};

function normalizarBusca(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

type Unidade = (typeof UNIDADES)[number];

function casaComTermo(unidade: Unidade, termo: string): boolean {
  const campos = `${unidade.nome} ${unidade.sigla} ${unidade.codigo} ${unidade.slug} ${unidade.alias ?? ''}`;
  return normalizarBusca(campos).includes(normalizarBusca(termo));
}

function casaComTipos(unidade: Unidade, tipos: string[]): boolean {
  const labels = tipos.map((tipo) => TIPO_LABEL_POR_VALOR[tipo]).filter(Boolean);
  return labels.includes(unidade.tipo);
}

/**
 * Mimetiza o filtro server-side do backend (q + tipo): a página não filtra mais em memória, então
 * o mock precisa devolver só o que casa.
 */
function unidadesDaBusca(url: URL): Unidade[] {
  const q = url.searchParams.get('q');
  const tipos = url.searchParams.getAll('tipo');
  return UNIDADES.filter(
    (unidade) =>
      (!q || casaComTermo(unidade, q)) && (tipos.length === 0 || casaComTipos(unidade, tipos)),
  );
}

function respostaJson(corpo: unknown) {
  return {
    status: 200,
    headers: { ...CORS_DAS_UNIDADES, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  };
}

async function atenderListagem(route: Route, request: Request): Promise<void> {
  if (request.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_DAS_UNIDADES });
    return;
  }
  if (request.method() !== 'GET') {
    await route.continue();
    return;
  }
  await route.fulfill(respostaJson(unidadesDaBusca(new URL(request.url()))));
}

export async function mockUnidadesApi(page: Page): Promise<void> {
  await page.route(/\/api\/organizacao\/admin\/unidades$/, atenderCriacao());
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, atenderListagem);
}
