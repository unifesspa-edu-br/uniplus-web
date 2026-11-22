import type { DocumentoExigido } from '../lista-de-documentos/lista-de-documentos';
import {
  classeDaSituacao,
  type DocumentoAvaliado,
  TODOS_OS_ITENS,
  QUANTIDADE_MINIMA_DE_ITENS,
  type GrupoDoDocumento,
} from './documentos-avaliados';
import {
  deCadaIntegrante,
  documentoJuntado,
  type IntegranteDoItem,
  paraALista,
} from './documento-na-lista';
import type { GrupoRenderizavel } from './formulario-do-candidato.model';
import { titulosDasOcorrencias } from './interpretador/ocorrencia-do-candidato';
import type { OcorrenciaSimulada } from './interpretador/regras-do-formulario';

/** Um documento na forma da lista, com o que as respostas já decidiram dele. */
export interface DocumentoNaTela extends DocumentoExigido {
  /** A exigência e o integrante a que ela se liga: identifica o documento entre duas avaliações. */
  readonly chave: string;
  /** O item junta os integrantes de um documento que se repete: as exigências deles estão em `exigidas`. */
  readonly juntado: boolean;
  /** As respostas dadas já pedem o documento, de ao menos um integrante. */
  readonly exigido: boolean;
  /**
   * Cada exigência que as respostas já pedem, pela exigência e pelo integrante, com o nome a anunciar:
   * o item que junta os integrantes tem uma por integrante.
   */
  readonly exigidas: readonly ExigenciaPedida[];
}

/** Uma exigência que as respostas já pedem, de um integrante, com o nome a anunciar. */
export interface ExigenciaPedida {
  readonly chave: string;
  readonly exigenciaId: string;
  /** A ocorrência do grupo a que a exigência se liga; nula fora de repetição. */
  readonly ocorrenciaId: string | null;
  /** Se já se sabe a que se anexa o arquivo: enquanto os integrantes não são conhecidos, não há envio. */
  readonly enviavel: boolean;
  readonly texto: string;
}

/** Um grupo da escolha na tela. */
export type GrupoDeDocumentos = Exclude<ItemDeComprovacao, { forma: 'DOCUMENTO' }>;

/** Um regra da escolha na tela: um documento, ou um grupo deles. */
export type ItemDeComprovacao =
  | { readonly forma: 'DOCUMENTO'; readonly documento: DocumentoNaTela }
  | {
      readonly forma: typeof TODOS_OS_ITENS | typeof QUANTIDADE_MINIMA_DE_ITENS;
      /** O grupo e, quando a escolha é feita integrante a integrante, o integrante: único na estrutura de regras. */
      readonly chave: string;
      /** Quantos itens do `OU` bastam. */
      readonly minimo: number;
      /** O integrante cuja escolha é esta, quando o grupo se repete por integrante. */
      readonly integrante: string | null;
      /** Junta as escolhas de cada integrante de um grupo que se repete: todas são pedidas. */
      readonly deCadaIntegrante: boolean;
      readonly itens: readonly ItemDeComprovacao[];
    };

interface GrupoEmMontagem {
  forma: typeof TODOS_OS_ITENS | typeof QUANTIDADE_MINIMA_DE_ITENS;
  chave: string;
  minimo: number;
  integrante: string | null;
  deCadaIntegrante: boolean;
  itens: ItemEmMontagem[];
}
type ItemEmMontagem = { forma: 'DOCUMENTO'; documento: DocumentoNaTela } | GrupoEmMontagem;

type Ocorrencias = Readonly<Record<string, readonly OcorrenciaSimulada[]>>;

/** A estrutura de regras em montagem e os integrantes já juntados de cada documento que se repete para todos. */
interface Montagem {
  readonly itensPrincipais: ItemEmMontagem[];
  readonly integrantesDeTodos: Map<string, IntegranteDoItem[]>;
}

/** O documento que se repete sob um grupo escolhido uma vez, com o integrante desta avaliação. */
interface DocumentoQueSeRepete {
  readonly documento: DocumentoAvaliado;
  readonly grupo: GrupoRenderizavel | undefined;
  readonly integrante: string | null;
}

/**
 * A estrutura de regras da escolha dos documentos, montada pelos grupos de cada um, na ordem em que aparecem. A
 * repetição por integrante vale da regra que a declara para baixo:
 *
 * - no grupo, a escolha dele e a de tudo abaixo é feita integrante a integrante. Sob um grupo que não
 *   se repete, as escolhas dos integrantes ficam juntas num item só, porque todas são pedidas;
 * - na regra de documento sob um grupo que não se repete, a escolha é uma só, e o documento escolhido vale para
 *   todos os integrantes.
 *
 * O documento do integrante que já não está no formulário não entra: a avaliação dele está atrasada.
 */
export function regrasDeDocumentos(
  documentos: readonly DocumentoAvaliado[],
  gruposDoFormulario: readonly GrupoRenderizavel[],
  ocorrencias: Ocorrencias,
): readonly ItemDeComprovacao[] {
  const montagem: Montagem = { itensPrincipais: [], integrantesDeTodos: new Map() };
  for (const documento of documentos) {
    const grupo = gruposDoFormulario.find((g) => g.codigo === documento.grupoCodigo);
    const integrante = tituloDoIntegrante(documento, grupo, ocorrencias);
    if (integrante !== undefined) incluirDocumento(montagem, { documento, grupo, integrante });
  }
  return montagem.itensPrincipais;
}

function incluirDocumento(montagem: Montagem, itemDeDocumento: DocumentoQueSeRepete): void {
  const { documento, integrante } = itemDeDocumento;
  const itens = descerAoGrupoDoDocumento(montagem.itensPrincipais, documento, integrante);
  if (repeteParaTodos(documento)) {
    incluirDeTodos(itens, itemDeDocumento, montagem.integrantesDeTodos);
    return;
  }
  const rotulo = integrante === null ? documento.nome : `${documento.nome} — ${integrante}`;
  itens.push({ forma: 'DOCUMENTO', documento: paraALista(documento, rotulo) });
}

/** O nível do primeiro grupo da estrutura de regras que se repete por integrante; negativo quando nenhum se repete. */
function nivelDaRepeticao(documento: DocumentoAvaliado): number {
  return documento.grupos.findIndex((g) => g.grupoDoFormularioParaRepeticao !== null);
}

function repeteParaTodos(documento: DocumentoAvaliado): boolean {
  return (
    documento.grupoDoFormularioParaRepeticao !== null &&
    documento.grupos.length > 0 &&
    nivelDaRepeticao(documento) < 0
  );
}

/** Os itens do último grupo da estrutura de regras do documento, criando os grupos que ainda não existem. */
function descerAoGrupoDoDocumento(
  itensPrincipais: ItemEmMontagem[],
  documento: DocumentoAvaliado,
  integrante: string | null,
): ItemEmMontagem[] {
  return passosDaDescida(documento, integrante).reduce(
    (itens, { grupo, identidade }) => grupoEm(itens, grupo, identidade).itens,
    itensPrincipais,
  );
}

interface PassoDaDescida {
  readonly grupo: GrupoDoDocumento;
  readonly identidade: IdentidadeDoGrupo;
}

/** Cada grupo por onde o documento desce, com a identidade que ele tem na estrutura de regras. */
function passosDaDescida(
  documento: DocumentoAvaliado,
  integrante: string | null,
): readonly PassoDaDescida[] {
  const repeteDesde = nivelDaRepeticao(documento);
  return documento.grupos.flatMap((g, nivel) => {
    const passo = passoDoNivel(documento, nivel, integrante);
    const juntos = { grupo: JUNTOS, identidade: identidadeDeTodos(g) };
    return nivel === repeteDesde && nivel > 0 ? [juntos, passo] : [passo];
  });
}

function passoDoNivel(
  documento: DocumentoAvaliado,
  nivel: number,
  integrante: string | null,
): PassoDaDescida {
  const repeteDesde = nivelDaRepeticao(documento);
  const grupo = documento.grupos[nivel];
  const porIntegrante = repeteDesde >= 0 && nivel >= repeteDesde;
  const identidade = {
    ...identidadeDoNivel(grupo, documento, porIntegrante),
    integrante: nivel === repeteDesde ? integrante : null,
  };
  return { grupo, identidade };
}

function identidadeDoNivel(
  grupo: GrupoDoDocumento,
  documento: DocumentoAvaliado,
  porIntegrante: boolean,
): IdentidadeDoGrupo {
  const chave = porIntegrante ? `${grupo.grupoId}:${documento.ocorrenciaId ?? ''}` : grupo.grupoId;
  return { chave, integrante: null, deCadaIntegrante: false };
}

function identidadeDeTodos(grupo: GrupoDoDocumento): IdentidadeDoGrupo {
  return { chave: `${grupo.grupoId}:todos`, integrante: null, deCadaIntegrante: true };
}

/** A regra que junta as escolhas de cada integrante: todas são pedidas. */
const JUNTOS: GrupoDoDocumento = {
  grupoId: '',
  forma: { codigo: TODOS_OS_ITENS, rotulo: 'Todos estes itens' },
  minimo: null,
  grupoDoFormularioParaRepeticao: null,
};

type IdentidadeDoGrupo = Pick<GrupoEmMontagem, 'chave' | 'integrante' | 'deCadaIntegrante'>;

/** O grupo do nível em que o documento entra: o já montado com a mesma identidade, ou um novo. */
function grupoEm(
  itens: ItemEmMontagem[],
  grupo: GrupoDoDocumento,
  identidade: IdentidadeDoGrupo,
): GrupoEmMontagem {
  const existente = itens.find(
    (n): n is GrupoEmMontagem => n.forma !== 'DOCUMENTO' && n.chave === identidade.chave,
  );
  if (existente) return existente;
  const novo = novoGrupo(grupo, identidade);
  itens.push(novo);
  return novo;
}

function novoGrupo(grupo: GrupoDoDocumento, identidade: IdentidadeDoGrupo): GrupoEmMontagem {
  return {
    forma:
      grupo.forma.codigo === QUANTIDADE_MINIMA_DE_ITENS
        ? QUANTIDADE_MINIMA_DE_ITENS
        : TODOS_OS_ITENS,
    minimo: grupo.minimo ?? 1,
    itens: [],
    ...identidade,
  };
}

/**
 * A regra de documento que se repete sob um grupo escolhido uma vez: um item só, com os integrantes de quem as
 * respostas o pedem — o integrante a quem a exigência não se aplica não vem na avaliação — e a situação
 * de cada um.
 */
function incluirDeTodos(
  itens: ItemEmMontagem[],
  { documento, grupo, integrante }: DocumentoQueSeRepete,
  integrantesDeTodos: Map<string, IntegranteDoItem[]>,
): void {
  const chave = `${documento.exigenciaId}:todos`;
  const integrantes = [
    ...(integrantesDeTodos.get(chave) ?? []),
    integranteDoItem(documento, integrante),
  ];
  integrantesDeTodos.set(chave, integrantes);
  const juntado = documentoJuntado(chave, documento, grupo, integrantes);
  substituirOuAcrescentar(itens, { forma: 'DOCUMENTO', documento: juntado });
}

function integranteDoItem(documento: DocumentoAvaliado, titulo: string | null): IntegranteDoItem {
  const { ocorrenciaId } = documento;
  return { titulo, ocorrenciaId, situacao: classeDaSituacao(documento.situacao) };
}

function substituirOuAcrescentar(
  itens: ItemEmMontagem[],
  item: ItemEmMontagem & { forma: 'DOCUMENTO' },
): void {
  const indice = itens.findIndex(
    (n) => n.forma === 'DOCUMENTO' && n.documento.chave === item.documento.chave,
  );
  if (indice < 0) itens.push(item);
  else itens[indice] = item;
}

/**
 * O integrante a que o documento se liga, pelo título que ele tem no formulário, que não coleta nome.
 * Nulo fora de repetição; "de cada integrante" enquanto não se sabe quais integrantes há; indefinido
 * quando a ocorrência já não está no formulário.
 */
function tituloDoIntegrante(
  documento: DocumentoAvaliado,
  grupo: GrupoRenderizavel | undefined,
  ocorrencias: Ocorrencias,
): string | null | undefined {
  const codigo = documento.grupoCodigo;
  if (codigo === null) return null;
  if (documento.ocorrenciaId === null) return deCadaIntegrante(grupo);
  return tituloDaOcorrencia(documento.ocorrenciaId, grupo, ocorrencias[codigo] ?? []);
}

function tituloDaOcorrencia(
  ocorrenciaId: string,
  grupo: GrupoRenderizavel | undefined,
  lista: readonly OcorrenciaSimulada[],
): string | undefined {
  const indice = lista.findIndex((o) => o.id === ocorrenciaId);
  if (indice < 0) return undefined;
  const titulos = titulosDasOcorrencias(
    grupo?.ocorrencias.incluiCandidato ?? false,
    lista.map((o) => o.respostas),
  );
  return titulos[indice];
}
