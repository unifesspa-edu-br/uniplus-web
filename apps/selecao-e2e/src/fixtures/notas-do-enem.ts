import type { Page, Request, Route } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import { ERICK, FERNANDA, HELENA, KEVIN, type PessoaFicticia } from './arquivo-do-inep-sintetico';

/**
 * API simulada da tela de notas do ENEM, no formato real (vendor MIME e `problem+json`). O CI do
 * frontend sobe o Keycloak, mas não a API: tudo o que a tela lê e envia passa por esta rota.
 */
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000005bb';
export const ETAPA_ID = '01960000-0000-7000-0000-0000000005cc';
export const ID_DO_LOTE = '01960000-0000-7000-0000-0000000005dd';
export const ROTA_DA_TELA = `/processo-seletivo/${PROCESSO_ID}/notas-do-enem`;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, accept, content-type',
};

const NS = 'uniplus.selecao.notas_do_enem.';

export interface RespostaSimulada {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
}

export function json(corpo: unknown, status = 200): RespostaSimulada {
  return { status, contentType: 'application/json', body: JSON.stringify(corpo) };
}

export function texto(corpo: string): RespostaSimulada {
  return { status: 200, contentType: 'text/plain; charset=utf-8', body: corpo };
}

export function problema(
  status: number,
  codigo: string,
  title: string,
  detail?: string,
): RespostaSimulada {
  const corpo = corpoDoProblema(status, codigo, title, detail);
  return { status, contentType: 'application/problem+json', body: JSON.stringify(corpo) };
}

function corpoDoProblema(status: number, codigo: string, title: string, detail?: string) {
  return {
    type: 'about:blank',
    title,
    status,
    code: codigo.includes('.') ? codigo : `${NS}${codigo}`,
    detail,
    traceId: 'a'.repeat(32),
  };
}

export function processo(sobrescritas: { status?: string } = {}): unknown {
  const { status = 'publicado' } = sobrescritas;
  return {
    id: PROCESSO_ID,
    identificadorLegivel: 'medicina-2027',
    nome: 'Medicina 2027 — Processo Seletivo Unificado com Nota do ENEM e Reserva de Vagas',
    situacao: {
      codigo: status.toUpperCase(),
      rotulo: status === 'rascunho' ? 'Rascunho' : 'Publicado',
    },
  };
}

/** O snapshot vigente: a configuração congelada na publicação, da qual a API resolve etapa e edições. */
export function snapshotVigente(
  sobrescritas: { etapaDoEnem?: boolean; edicoes?: readonly string[] } = {},
): unknown {
  const { etapaDoEnem = true, edicoes = ['2024', '2025'] } = sobrescritas;
  return {
    snapshotPublicacaoId: '01960000-0000-7000-0000-0000000005ee',
    atoId: '01960000-0000-7000-0000-0000000005ff',
    schemaVersion: '0.0.21',
    algoritmoHash: 'sha256',
    hashConfiguracao: 'c'.repeat(64),
    hashEdital: 'e'.repeat(64),
    configuracao: configuracaoDoEnem(etapaDoEnem, edicoes),
  };
}

function configuracaoDoEnem(etapaDoEnem: boolean, edicoes: readonly string[]) {
  return {
    etapas: etapasDaConfiguracao(etapaDoEnem),
    dadosDosFormularios: [
      {
        codigoDoDado: 'EDICAO_ENEM',
        valoresSelecionaveis: edicoes.map((valorCodigo, indice) => ({
          valorCodigo,
          ordem: indice + 1,
        })),
      },
    ],
  };
}

function etapasDaConfiguracao(etapaDoEnem: boolean) {
  return [
    { id: 'outra', nome: 'Prova objetiva', tipoEtapa: { notaDeOrigemNoEnem: false } },
    ...(etapaDoEnem
      ? [{ id: ETAPA_ID, nome: 'Nota do ENEM', tipoEtapa: { notaDeOrigemNoEnem: true } }]
      : []),
  ];
}

function leiaute(codigo: string, tipo: string, descricao: string): unknown {
  return { codigo, versao: 'v1', tipo, descricao, hash: 'h'.repeat(64), quantidadeDeCampos: 20 };
}

/** A máscara da tela: oculta os três primeiros dígitos e os verificadores. */
export function cpfMascarado(cpf: string): string {
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

function oferta(ordem: number, nome: string): unknown {
  return { id: `01960000-0000-7000-0000-00000000070${ordem}`, nome, ordem };
}

function doInscrito(pessoa: PessoaFicticia): Record<string, unknown> {
  return {
    inscricaoId: null,
    nomeDoCandidato: pessoa.nome,
    cpfMascarado: cpfMascarado(pessoa.cpf),
    ofertas: [
      oferta(1, 'Medicina — Marabá — Integral'),
      oferta(2, 'Enfermagem — Marabá — Integral'),
    ],
  };
}

export const LEIAUTES = {
  envio: [leiaute('ENVIO_CPF', 'ENVIO', 'Envio de CPFs ao INEP')],
  retorno: [
    leiaute('RETORNO_20', 'RETORNO', 'Retorno do INEP com 20 campos, a partir da edição de 2024'),
    leiaute('RETORNO_23', 'RETORNO', 'Retorno do INEP com 23 campos, até a edição de 2023'),
  ],
};

export function lote(sobrescritas: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...identificacaoDoLote(),
    ...totaisDoLote(),
    vigente: true,
    ocorrencias: ocorrenciasDoLote(),
    ausentes: ausentesDoLote(),
    ...sobrescritas,
  };
}

function identificacaoDoLote() {
  return {
    id: ID_DO_LOTE,
    edicao: '2025',
    leiauteCodigo: 'RETORNO_20',
    leiauteVersao: 'v1',
    leiauteHash: 'h'.repeat(64),
    arquivoHash: 'a'.repeat(64),
    importadoPor: 'usuario-opaco',
    importadoPorNome: 'Diogo Souza',
    importadoEm: '2026-10-26T12:00:00Z',
  };
}

function totaisDoLote() {
  return {
    totalDeLinhas: 5,
    totalDeInscritosComNota: 2,
    totalDeLancamentos: 10,
    totalDeInscritosSemLinha: 1,
    totalDeInscritosAusentes: 1,
    totalDeLinhasSemInscrito: 1,
    totalDeInscritosEmConflito: 1,
  };
}

function ocorrenciasDoLote() {
  return [
    ocorrenciaDoInscrito(HELENA, 'INSCRITO_SEM_LINHA', 'INS-0003', null),
    ocorrenciaDoInscrito(FERNANDA, 'CONFLITO', 'INS-0004', [2, 4]),
    linhaSemInscrito(),
  ];
}

const ROTULOS_DAS_OCORRENCIAS: Record<string, string> = {
  INSCRITO_SEM_LINHA: 'Inscrito sem linha',
  CONFLITO: 'Conflito',
};

function ocorrenciaDoInscrito(
  pessoa: PessoaFicticia,
  tipo: string,
  numeroDeInscricao: string,
  numerosDasLinhas: number[] | null,
) {
  return {
    ...doInscrito(pessoa),
    tipo: { codigo: tipo, rotulo: ROTULOS_DAS_OCORRENCIAS[tipo] },
    numeroDeInscricao,
    numerosDasLinhas,
    sexo: null,
  };
}

function linhaSemInscrito() {
  return {
    tipo: { codigo: 'LINHA_SEM_INSCRITO', rotulo: 'Linha sem inscrito' },
    inscricaoId: null,
    numeroDeInscricao: null,
    numerosDasLinhas: [14],
    nomeDoCandidato: ERICK.nome,
    cpfMascarado: cpfMascarado(ERICK.cpf),
    sexo: 'M',
    ofertas: null,
  };
}

function ausentesDoLote() {
  return [
    {
      ...doInscrito(KEVIN),
      inscricaoId: '01960000-0000-7000-0000-0000000005a1',
      numeroDeInscricao: 'INS-0005',
      areas: ['MATEMATICA', 'REDACAO'],
    },
  ];
}

/** Uma geração do histórico de envios, no contrato atual. */
export function envio(sobrescritas: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '01960000-0000-7000-0000-0000000005e1',
    edicao: '2025',
    leiauteCodigo: 'ENVIO_CPF',
    leiauteVersao: 'v1',
    geradoPor: 'usuario-opaco',
    geradoPorNome: 'Diogo Souza',
    geradoEm: '2026-10-26T12:00:00Z',
    totalDeCpfs: 3,
    ...sobrescritas,
  };
}

export interface Cenario {
  readonly processo?: unknown;
  /** O snapshot vigente; `null` é o processo sem versão publicada (404). */
  readonly snapshot?: unknown;
  readonly leiautes?: { envio?: readonly unknown[]; retorno?: readonly unknown[] };
  readonly envios?: readonly unknown[];
  readonly lotes?: readonly unknown[];
  /** Resposta do POST de envio; sem ela, o arquivo de envio vazio. */
  readonly gerarEnvio?: RespostaSimulada;
  /** Resposta do POST de importação; sem ela, 201 com o lote padrão. */
  readonly importar?: RespostaSimulada & { readonly status: number };
  readonly lotePorId?: unknown;
  /** Quando verdadeiro, as leituras do processo falham, como com a API fora do ar. */
  readonly semApi?: boolean;
}

export interface Registro {
  /** Corpo de cada POST de envio, em ordem. */
  readonly envios: string[];
  /** Corpo cru de cada POST de importação, em ordem. */
  readonly importacoes: Buffer[];
}

/** Instala a API simulada e devolve o que a tela enviou a ela. */
export async function simularApi(page: Page, cenario: Cenario = {}): Promise<Registro> {
  const registro: Registro = { envios: [], importacoes: [] };
  const edicao = '2025';
  const escopo = `/api/selecao/processos-seletivos/${PROCESSO_ID}/etapas/${ETAPA_ID}/edicoes-do-enem/${edicao}`;

  await page.route(/\/api\//, (route: Route) =>
    atenderRequisicao(route, escopo, cenario, registro),
  );
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
  return registro;
}

async function atenderRequisicao(
  route: Route,
  escopo: string,
  cenario: Cenario,
  registro: Registro,
): Promise<void> {
  const requisicao = route.request();
  if (requisicao.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  if (cenario.semApi) return route.abort('connectionrefused');
  const resposta = responder(requisicao, escopo, cenario, registro);
  await route.fulfill({ ...resposta, headers: CORS });
}

function responderEnvios(
  requisicao: Request,
  cenario: Cenario,
  registro: Registro,
): RespostaSimulada {
  if (requisicao.method() !== 'POST') return json(cenario.envios ?? []);
  registro.envios.push(requisicao.postData() ?? '');
  return cenario.gerarEnvio ?? texto('');
}

function responderLotes(
  requisicao: Request,
  cenario: Cenario,
  registro: Registro,
): RespostaSimulada {
  if (requisicao.method() !== 'POST') return json(cenario.lotes ?? []);
  registro.importacoes.push(requisicao.postDataBuffer() ?? Buffer.alloc(0));
  return cenario.importar ?? json(lote(), 201);
}

function responderSnapshot(cenario: Cenario): RespostaSimulada {
  return cenario.snapshot === null
    ? problema(404, 'uniplus.selecao.snapshot_nao_encontrado', 'Sem versão publicada')
    : json(cenario.snapshot ?? snapshotVigente());
}

function responderLeiautes(requisicao: Request, cenario: Cenario): RespostaSimulada {
  const tipo = new URL(requisicao.url()).searchParams.get('tipo') === 'ENVIO' ? 'envio' : 'retorno';
  return json(cenario.leiautes?.[tipo] ?? LEIAUTES[tipo]);
}

function rotasDeConsultaDoProcesso(requisicao: Request, cenario: Cenario) {
  return {
    [`/api/selecao/processos-seletivos/${PROCESSO_ID}`]: () => json(cenario.processo ?? processo()),
    [`/api/selecao/processos-seletivos/${PROCESSO_ID}/snapshot-vigente`]: () =>
      responderSnapshot(cenario),
    '/api/selecao/leiautes-de-arquivo-do-inep': () => responderLeiautes(requisicao, cenario),
  };
}

function responder(
  requisicao: Request,
  escopo: string,
  cenario: Cenario,
  registro: Registro,
): RespostaSimulada {
  const { pathname } = new URL(requisicao.url());
  const rotas: Record<string, () => RespostaSimulada> = {
    ...rotasDeConsultaDoProcesso(requisicao, cenario),
    [`${escopo}/envios-ao-inep`]: () => responderEnvios(requisicao, cenario, registro),
    [`${escopo}/lotes-de-notas`]: () => responderLotes(requisicao, cenario, registro),
    [`${escopo}/lotes-de-notas/${ID_DO_LOTE}`]: () => json(cenario.lotePorId ?? lote()),
  };
  return rotas[pathname]?.() ?? json([]);
}
