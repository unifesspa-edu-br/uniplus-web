import type { Page, Route } from '@playwright/test';
import type {
  EtapaProcessoDto,
  EtapaProcessoInput,
  FaseCronogramaDto,
  FaseCronogramaInput,
} from '@uniplus/shared-data/selecao';
import { CATEGORIAS_DE_DOCUMENTO } from '../fixtures/catalogos-do-cronograma';
import {
  bancaDaEtapaDoServidor,
  comBancasNaEtapa,
  comBancasNaFase,
  comProdutoNaFase,
} from '../fixtures/cronograma-do-servidor';
import {
  ID_DO_PROCESSO_COMPLETO,
  PROCESSO_PUBLICADO_COMPLETO,
} from '../fixtures/processo-publicado-completo';
import { TIPOS_DE_BANCA, type TipoDeBancaDoCatalogo } from '../fixtures/tipos-de-banca';
import { situacaoDoProcesso } from '../fixtures/valor-do-enum';
import {
  CORS,
  mockarCatalogos,
  PRODUTO_DEFINITIVO,
  problema,
  recusar,
  SEM_CONTEUDO,
} from './api-da-unidade-da-fase';
import { formulariosNaFase } from './formularios-na-fase';
import { leituraDoProcessoCompleto } from './leituras-do-processo-completo';
import { responder, responderCatalogos, responderCom } from './responder';

export type BancaDaFaseLida = FaseCronogramaDto['bancasRequeridas'][number];
export type BancaDaEtapaLida = EtapaProcessoDto['bancas'][number];
export type BancaDaFaseEnviada = FaseCronogramaInput['bancasRequeridas'][number];
export type BancaDaEtapaEnviada = EtapaProcessoInput['bancas'][number];
type RegraEnviada = NonNullable<BancaDaEtapaEnviada['regraDeDeliberacao']>;

const ROTA_DO_PROCESSO = new RegExp(`/api/selecao/processos-seletivos/${ID_DO_PROCESSO_COMPLETO}`);
const ROTA_DOS_TIPOS_DE_BANCA = /\/api\/configuracao\/tipos-banca(\?.*)?$/;

/** Uma causa que a API devolve em `errors[]`, com os identificadores que apontam o item da lista. */
export interface ErroDaApi {
  readonly field?: string;
  readonly code: string;
  readonly message: string;
  readonly identificadores?: readonly { lista: string; identificador: string }[];
}

/** O que o servidor simulado guarda e o que a tela lhe enviou. */
export interface ServidorDasBancas {
  fase: FaseCronogramaDto;
  etapa: EtapaProcessoDto;
  situacao: 'rascunho' | 'publicado';
  catalogo: readonly TipoDeBancaDoCatalogo[];
  /** Enquanto houver erros aqui, a gravação do escopo é recusada com eles e nada é guardado. */
  recusaDaGravacao: { fases: readonly ErroDaApi[]; etapas: readonly ErroDaApi[] };
  /** Lida a cada publicação: com erros, a publicação é recusada; sem, é aceita. */
  recusaDaPublicacao: (() => readonly ErroDaApi[]) | null;
  gravadas: number;
  readonly fasesEnviadas: FaseCronogramaInput[][];
  readonly etapasEnviadas: EtapaProcessoInput[][];
}

export interface CenarioDasBancas {
  readonly bancasDaFase?: FaseCronogramaDto['bancasRequeridas'];
  readonly bancasDaEtapa?: EtapaProcessoDto['bancas'];
  readonly etapa?: EtapaProcessoDto;
  readonly situacao?: ServidorDasBancas['situacao'];
  readonly catalogo?: readonly TipoDeBancaDoCatalogo[];
}

/**
 * O processo do cenário, sem banca na fase nem na etapa por padrão. A fase publica também o
 * resultado definitivo: sem ele a conferência local do cronograma cobra a fase que conclui o ciclo
 * recursal e a gravação não chega ao servidor.
 */
export function novoServidorDasBancas(cenario: CenarioDasBancas = {}): ServidorDasBancas {
  const [fase] = PROCESSO_PUBLICADO_COMPLETO.cronogramaFases;
  const [etapa] = PROCESSO_PUBLICADO_COMPLETO.etapas;
  return {
    fase: comBancasNaFase(comProdutoNaFase(fase, PRODUTO_DEFINITIVO), cenario.bancasDaFase ?? []),
    etapa: comBancasNaEtapa(cenario.etapa ?? etapa, cenario.bancasDaEtapa ?? []),
    situacao: cenario.situacao ?? 'rascunho',
    catalogo: cenario.catalogo ?? TIPOS_DE_BANCA,
    recusaDaGravacao: { fases: [], etapas: [] },
    recusaDaPublicacao: null,
    gravadas: 0,
    fasesEnviadas: [],
    etapasEnviadas: [],
  };
}

/** O id que o servidor dá à banca ou ao candidato atendido que acabou de criar. */
function novoId(servidor: ServidorDasBancas): string {
  servidor.gravadas += 1;
  return `01a0d640-0000-7000-8000-00000000b${String(servidor.gravadas).padStart(3, '0')}`;
}

const ROTULOS_DA_REGRA: Readonly<Record<string, string>> = {
  COLEGIADA_COM_VOTACAO: 'Colegiada, com votação',
  ATO_INDIVIDUAL: 'Ato individual',
  MAIORIA_SIMPLES: 'Maioria simples',
  MAIORIA_ABSOLUTA: 'Maioria absoluta',
  UNANIMIDADE: 'Unanimidade',
  VOTO_DA_PRESIDENCIA: 'Voto da presidência',
  NOVA_VOTACAO: 'Nova votação',
  TODOS_OS_TITULARES: 'Todos os titulares votam',
  PRESIDENCIA_NO_QUORUM: 'A presidência encerra ao atingir o quórum',
  FAVORAVEL: 'Favorável',
  DESFAVORAVEL: 'Desfavorável',
};

const CODIGOS_DOS_VOCABULARIOS = {
  'modos-deliberacao': ['COLEGIADA_COM_VOTACAO', 'ATO_INDIVIDUAL'],
  'criterios-votacao': ['MAIORIA_SIMPLES', 'MAIORIA_ABSOLUTA', 'UNANIMIDADE'],
  'desempates-votacao': ['VOTO_DA_PRESIDENCIA', 'NOVA_VOTACAO'],
  'encerramentos-votacao': ['TODOS_OS_TITULARES', 'PRESIDENCIA_NO_QUORUM'],
  'resultados-sem-unanimidade': ['FAVORAVEL', 'DESFAVORAVEL', 'NOVA_VOTACAO'],
} as const;

const VOCABULARIOS_DA_REGRA = Object.entries(CODIGOS_DOS_VOCABULARIOS).map(
  ([recurso, codigos]) =>
    [
      `selecao/vocabularios/${recurso}`,
      codigos.map((codigo) => ({ codigo, rotulo: ROTULOS_DA_REGRA[codigo] })),
    ] as const,
);

function valorLido<T extends string>(
  codigo: T | null | undefined,
): { codigo: T; rotulo: string } | null {
  return codigo ? { codigo, rotulo: ROTULOS_DA_REGRA[codigo] ?? '' } : null;
}

function regraLida(regra: RegraEnviada | null | undefined): BancaDaEtapaLida['regraDeDeliberacao'] {
  if (!regra?.modo) return null;
  return {
    modo: { codigo: regra.modo, rotulo: ROTULOS_DA_REGRA[regra.modo] ?? '' },
    integrantes: regra.integrantes,
    suplentes: regra.suplentes,
    quorum: regra.quorum ?? null,
    criterio: valorLido(regra.criterio),
    desempate: valorLido(regra.desempate),
    encerramento: valorLido(regra.encerramento),
    semUnanimidade: valorLido(regra.semUnanimidade),
  };
}

interface BancaEnviada {
  readonly id?: string | null;
  readonly tipoBancaId: string;
  readonly regraDeDeliberacao?: RegraEnviada | null;
}

/** A cópia do tipo só é feita na criação da banca: a banca que já existe mantém a que tinha. */
function copiaDaBanca(
  servidor: ServidorDasBancas,
  enviada: BancaEnviada,
  anteriores: readonly BancaDaEtapaLida[],
): BancaDaEtapaLida {
  const anterior = anteriores.find(
    (banca) => banca.id === enviada.id && banca.tipoBancaOrigemId === enviada.tipoBancaId,
  );
  if (anterior) return anterior;
  const tipo = servidor.catalogo.find((candidato) => candidato.id === enviada.tipoBancaId);
  if (!tipo) throw new Error(`O servidor simulado não tem o tipo de banca ${enviada.tipoBancaId}`);
  return bancaDaEtapaDoServidor(tipo);
}

function bancaLida(
  servidor: ServidorDasBancas,
  enviada: BancaEnviada,
  posicao: number,
  anteriores: readonly BancaDaEtapaLida[],
): BancaDaEtapaLida {
  return {
    ...copiaDaBanca(servidor, enviada, anteriores),
    id: enviada.id ?? novoId(servidor),
    posicaoNoTipo: posicao,
    regraDeDeliberacao: regraLida(enviada.regraDeDeliberacao),
  };
}

const porCodigoEPosicao = (a: BancaDaEtapaLida, b: BancaDaEtapaLida): number => {
  if (a.codigo.codigo !== b.codigo.codigo) return a.codigo.codigo < b.codigo.codigo ? -1 : 1;
  return a.posicaoNoTipo - b.posicaoNoTipo;
};

/** A leitura sai por código do tipo e, dentro dele, pela posição, que vem da ordem do envio. */
function lerBancas<E extends BancaEnviada, L extends BancaDaEtapaLida>(
  servidor: ServidorDasBancas,
  enviadas: readonly E[],
  anteriores: readonly BancaDaEtapaLida[],
  completar: (lida: BancaDaEtapaLida, enviada: E) => L,
): L[] {
  const contagem = new Map<string, number>();
  const lidas = enviadas.map((enviada) => {
    const posicao = (contagem.get(enviada.tipoBancaId) ?? 0) + 1;
    contagem.set(enviada.tipoBancaId, posicao);
    return completar(bancaLida(servidor, enviada, posicao, anteriores), enviada);
  });
  return lidas.sort(porCodigoEPosicao);
}

function candidatosLidos(
  servidor: ServidorDasBancas,
  categoriasIds: readonly string[],
): BancaDaFaseLida['candidatosAtendidos'] {
  return categoriasIds.map((categoriaId) => ({
    id: novoId(servidor),
    categoriaDocumentoOrigemId: categoriaId,
    codigo: CATEGORIAS_DE_DOCUMENTO.find((categoria) => categoria.id === categoriaId)?.codigo ?? '',
  }));
}

function bancasDaFaseGravadas(
  servidor: ServidorDasBancas,
  enviadas: readonly BancaDaFaseEnviada[],
): BancaDaFaseLida[] {
  return lerBancas(servidor, enviadas, servidor.fase.bancasRequeridas, (lida, enviada) => ({
    ...lida,
    candidatosAtendidos: candidatosLidos(servidor, enviada.categoriasDocumentoIds),
  }));
}

async function recusouAGravacao(route: Route, erros: readonly ErroDaApi[]): Promise<boolean> {
  if (erros.length === 0) return false;
  await recusar(route, problema(422, 'uniplus.validacao', 'Validação', erros));
  return true;
}

async function gravarFases(
  route: Route,
  servidor: ServidorDasBancas,
  corpo: FaseCronogramaInput[],
): Promise<void> {
  servidor.fasesEnviadas.push(corpo);
  if (await recusouAGravacao(route, servidor.recusaDaGravacao.fases)) return;
  const bancas = bancasDaFaseGravadas(servidor, corpo[0].bancasRequeridas);
  servidor.fase = comBancasNaFase(servidor.fase, bancas);
  await route.fulfill(SEM_CONTEUDO);
}

async function gravarEtapas(
  route: Route,
  servidor: ServidorDasBancas,
  corpo: EtapaProcessoInput[],
): Promise<void> {
  servidor.etapasEnviadas.push(corpo);
  if (await recusouAGravacao(route, servidor.recusaDaGravacao.etapas)) return;
  const bancas = lerBancas(servidor, corpo[0].bancas, servidor.etapa.bancas, (lida) => lida);
  servidor.etapa = comBancasNaEtapa(servidor.etapa, bancas);
  await route.fulfill(SEM_CONTEUDO);
}

async function publicar(route: Route, servidor: ServidorDasBancas): Promise<void> {
  const erros = servidor.recusaDaPublicacao?.() ?? [];
  if (erros.length > 0) {
    const titulo = 'A configuração não pode ser publicada';
    await recusar(route, problema(422, 'uniplus.validacao', titulo, erros));
    return;
  }
  servidor.situacao = 'publicado';
  await route.fulfill(SEM_CONTEUDO);
}

function detalheDoProcesso(servidor: ServidorDasBancas) {
  return {
    ...PROCESSO_PUBLICADO_COMPLETO,
    formularios: formulariosNaFase(servidor.fase.id),
    situacao: situacaoDoProcesso(servidor.situacao),
    cronogramaFases: [servidor.fase],
    etapas: [servidor.etapa],
    atendimentoEspecializado: null,
    regrasDeComprovacao: PROCESSO_PUBLICADO_COMPLETO.regrasDeComprovacao.slice(0, 1),
    classificacao: { ...PROCESSO_PUBLICADO_COMPLETO.classificacao, regrasEliminacao: [] },
  };
}

async function ler(route: Route, servidor: ServidorDasBancas, caminho: string): Promise<void> {
  const corpo = caminho.endsWith(ID_DO_PROCESSO_COMPLETO)
    ? detalheDoProcesso(servidor)
    : leituraDoProcessoCompleto(caminho);
  if (corpo === undefined) await route.fulfill({ status: 404, headers: CORS });
  else await responderCom(route, corpo, CORS);
}

async function escrever(route: Route, servidor: ServidorDasBancas, caminho: string): Promise<void> {
  const corpo = route.request().postDataJSON();
  if (caminho.endsWith('/cronograma-fases')) return gravarFases(route, servidor, corpo);
  if (caminho.endsWith('/etapas')) return gravarEtapas(route, servidor, corpo);
  if (caminho.endsWith('/publicacao')) return publicar(route, servidor);
  if (caminho.endsWith('/distribuicao-vagas/simulacao')) {
    return responderCom(route, PROCESSO_PUBLICADO_COMPLETO.distribuicaoVagas, CORS);
  }
  return route.fulfill(SEM_CONTEUDO);
}

async function atender(route: Route, servidor: ServidorDasBancas): Promise<void> {
  const requisicao = route.request();
  const caminho = new URL(requisicao.url()).pathname;
  if (requisicao.method() === 'OPTIONS') return route.fulfill(SEM_CONTEUDO);
  if (requisicao.method() === 'GET') return ler(route, servidor, caminho);
  return escrever(route, servidor, caminho);
}

/**
 * Serve o processo, o cadastro de tipos de banca e as categorias de documento, e guarda o que a
 * tela grava, devolvendo-o nas leituras seguintes como a API: por código do tipo e posição.
 */
export async function mockarServidorDasBancas(
  page: Page,
  servidor: ServidorDasBancas,
): Promise<void> {
  await mockarCatalogos(page);
  await responder(page, ROTA_DOS_TIPOS_DE_BANCA, () => servidor.catalogo, CORS);
  await responderCatalogos(
    page,
    [['configuracao/categorias-documento', CATEGORIAS_DE_DOCUMENTO], ...VOCABULARIOS_DA_REGRA],
    CORS,
  );
  await page.route(ROTA_DO_PROCESSO, (route: Route) => atender(route, servidor));
}
