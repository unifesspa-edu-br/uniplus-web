import type { Page, Request, Route } from '@playwright/test';
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
  return {
    status,
    contentType: 'application/problem+json',
    body: JSON.stringify({
      type: 'about:blank',
      title,
      status,
      code: codigo.includes('.') ? codigo : `${NS}${codigo}`,
      detail,
      traceId: 'a'.repeat(32),
    }),
  };
}

export function processo(sobrescritas: { status?: string } = {}): unknown {
  const { status = 'publicado' } = sobrescritas;
  return {
    id: PROCESSO_ID,
    identificadorLegivel: 'medicina-2027',
    nome: 'Medicina 2027 — Processo Seletivo Unificado com Nota do ENEM e Reserva de Vagas',
    status,
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
    configuracao: {
      etapas: [
        { id: 'outra', nome: 'Prova objetiva', tipoEtapa: { notaDeOrigemNoEnem: false } },
        ...(etapaDoEnem
          ? [{ id: ETAPA_ID, nome: 'Nota do ENEM', tipoEtapa: { notaDeOrigemNoEnem: true } }]
          : []),
      ],
      fatosColetados: [
        {
          fatoCodigo: 'EDICAO_ENEM',
          valoresSelecionaveis: edicoes.map((valorCodigo, indice) => ({
            valorCodigo,
            ordem: indice + 1,
          })),
        },
      ],
    },
  };
}

function leiaute(codigo: string, tipo: string, descricao: string): unknown {
  return { codigo, versao: 'v1', tipo, descricao, hash: 'h'.repeat(64), quantidadeDeCampos: 20 };
}

/** A máscara da tela: oculta os três primeiros dígitos e os verificadores. */
export function cpfMascarado(cpf: string): string {
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

function curso(ordem: number, oferta: string): unknown {
  return { ordem, oferta };
}

function doInscrito(pessoa: PessoaFicticia): Record<string, unknown> {
  return {
    inscricaoId: null,
    nomeDoCandidato: pessoa.nome,
    cpfMascarado: cpfMascarado(pessoa.cpf),
    opcoesDeCurso: [
      curso(1, 'Medicina — Marabá — Integral'),
      curso(2, 'Enfermagem — Marabá — Integral'),
    ],
  };
}

export const LEIAUTES = {
  envio: [leiaute('ENVIO_CPF', 'envio', 'Envio de CPFs ao INEP')],
  retorno: [
    leiaute('RETORNO_20', 'retorno', 'Retorno do INEP com 20 campos, a partir da edição de 2024'),
    leiaute('RETORNO_23', 'retorno', 'Retorno do INEP com 23 campos, até a edição de 2023'),
  ],
};

export function lote(sobrescritas: Record<string, unknown> = {}): Record<string, unknown> {
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
    totalDeLinhas: '5',
    totalDeInscritosComNota: '2',
    totalDeLancamentos: '10',
    totalDeInscritosSemLinha: '1',
    totalDeInscritosAusentes: '1',
    totalDeLinhasSemInscrito: '1',
    totalDeInscritosEmConflito: '1',
    vigente: true,
    ocorrencias: [
      {
        ...doInscrito(HELENA),
        tipo: 'INSCRITO_SEM_LINHA',
        numeroDeInscricao: 'INS-0003',
        numerosDasLinhas: null,
        sexo: null,
      },
      {
        ...doInscrito(FERNANDA),
        tipo: 'CONFLITO',
        numeroDeInscricao: 'INS-0004',
        numerosDasLinhas: ['2', '4'],
        sexo: null,
      },
      {
        tipo: 'LINHA_SEM_INSCRITO',
        inscricaoId: null,
        numeroDeInscricao: null,
        numerosDasLinhas: ['14'],
        nomeDoCandidato: ERICK.nome,
        cpfMascarado: cpfMascarado(ERICK.cpf),
        sexo: 'M',
        opcoesDeCurso: null,
      },
    ],
    ausentes: [
      {
        ...doInscrito(KEVIN),
        inscricaoId: '01960000-0000-7000-0000-0000000005a1',
        numeroDeInscricao: 'INS-0005',
        areas: ['MATEMATICA', 'REDACAO'],
      },
    ],
    ...sobrescritas,
  };
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
    totalDeCpfs: '3',
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

  await page.route(/\/api\//, async (route: Route) => {
    const requisicao = route.request();
    if (requisicao.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    if (cenario.semApi) {
      await route.abort('connectionrefused');
      return;
    }
    const resposta = responder(requisicao, escopo, cenario, registro);
    await route.fulfill({
      status: resposta.status,
      contentType: resposta.contentType,
      headers: CORS,
      body: resposta.body,
    });
  });
  return registro;
}

function responder(
  requisicao: Request,
  escopo: string,
  cenario: Cenario,
  registro: Registro,
): RespostaSimulada {
  const { pathname, searchParams } = new URL(requisicao.url());
  const metodo = requisicao.method();

  if (pathname === `/api/selecao/processos-seletivos/${PROCESSO_ID}`) {
    return json(cenario.processo ?? processo());
  }
  if (pathname === `/api/selecao/processos-seletivos/${PROCESSO_ID}/snapshot-vigente`) {
    return cenario.snapshot === null
      ? problema(404, 'uniplus.selecao.snapshot_nao_encontrado', 'Sem versão publicada')
      : json(cenario.snapshot ?? snapshotVigente());
  }
  if (pathname === '/api/selecao/leiautes-de-arquivo-do-inep') {
    const tipo = searchParams.get('tipo') === 'envio' ? 'envio' : 'retorno';
    return json(cenario.leiautes?.[tipo] ?? LEIAUTES[tipo]);
  }
  if (pathname === `${escopo}/envios-ao-inep`) {
    if (metodo === 'POST') {
      registro.envios.push(requisicao.postData() ?? '');
      return cenario.gerarEnvio ?? texto('');
    }
    return json(cenario.envios ?? []);
  }
  if (pathname === `${escopo}/lotes-de-notas`) {
    if (metodo === 'POST') {
      registro.importacoes.push(requisicao.postDataBuffer() ?? Buffer.alloc(0));
      return cenario.importar ?? json(lote(), 201);
    }
    return json(cenario.lotes ?? []);
  }
  if (pathname === `${escopo}/lotes-de-notas/${ID_DO_LOTE}`) {
    return json(cenario.lotePorId ?? lote());
  }
  return json([]);
}
