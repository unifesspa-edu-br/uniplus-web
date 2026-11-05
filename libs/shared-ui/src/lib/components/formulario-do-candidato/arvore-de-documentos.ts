import type { DocumentoExigido } from '../lista-de-documentos/lista-de-documentos';
import {
  chaveDaExigencia,
  classeDaSituacao,
  DEPENDE_DE_FASE_POSTERIOR,
  type DocumentoAvaliado,
  EXIGIDO,
  GRUPO_E,
  GRUPO_OU,
  type GrupoDoDocumento,
  PODE_SER_EXIGIDO,
} from './documentos-avaliados';
import { formatosDaExigencia } from './envio-de-documentos';
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
export type GrupoDeDocumentos = Exclude<NoDeDocumentos, { tipo: 'DOCUMENTO' }>;

/** Um nó da escolha na tela: um documento, ou um grupo deles. */
export type NoDeDocumentos =
  | { readonly tipo: 'DOCUMENTO'; readonly documento: DocumentoNaTela }
  | {
      readonly tipo: typeof GRUPO_E | typeof GRUPO_OU;
      /** O grupo e, quando a escolha é feita integrante a integrante, o integrante: único na árvore. */
      readonly chave: string;
      /** Quantos itens do `OU` bastam. */
      readonly minimo: number;
      /** O integrante cuja escolha é esta, quando o grupo se repete por integrante. */
      readonly integrante: string | null;
      /** Junta as escolhas de cada integrante de um grupo que se repete: todas são pedidas. */
      readonly deCadaIntegrante: boolean;
      readonly itens: readonly NoDeDocumentos[];
    };

interface GrupoEmMontagem {
  tipo: typeof GRUPO_E | typeof GRUPO_OU;
  chave: string;
  minimo: number;
  integrante: string | null;
  deCadaIntegrante: boolean;
  itens: NoEmMontagem[];
}
type NoEmMontagem = { tipo: 'DOCUMENTO'; documento: DocumentoNaTela } | GrupoEmMontagem;

type Ocorrencias = Readonly<Record<string, readonly OcorrenciaSimulada[]>>;

/** Um integrante de quem a avaliação pede o documento que se repete, e como pede. */
interface IntegranteDoItem {
  readonly titulo: string | null;
  readonly ocorrenciaId: string | null;
  readonly situacao: string;
}

/** O documento que se repete sob um grupo escolhido uma vez, com o integrante desta avaliação. */
interface FolhaQueSeRepete {
  readonly documento: DocumentoAvaliado;
  readonly grupo: GrupoRenderizavel | undefined;
  readonly integrante: string | null;
}

/**
 * A árvore da escolha dos documentos, montada pelos grupos de cada um, na ordem em que aparecem. A
 * repetição por integrante vale do nó que a declara para baixo:
 *
 * - no grupo, a escolha dele e a de tudo abaixo é feita integrante a integrante. Sob um grupo que não
 *   se repete, as escolhas dos integrantes ficam juntas num item só, porque todas são pedidas;
 * - na folha sob um grupo que não se repete, a escolha é uma só, e o documento escolhido vale para
 *   todos os integrantes.
 *
 * O documento do integrante que já não está no formulário não entra: a avaliação dele está atrasada.
 */
export function arvoreDeDocumentos(
  documentos: readonly DocumentoAvaliado[],
  gruposDoFormulario: readonly GrupoRenderizavel[],
  ocorrencias: Ocorrencias,
): readonly NoDeDocumentos[] {
  const raiz: NoEmMontagem[] = [];
  const integrantesDeTodos = new Map<string, IntegranteDoItem[]>();
  for (const documento of documentos) {
    const grupo = gruposDoFormulario.find((g) => g.codigo === documento.grupoCodigo);
    const integrante = tituloDoIntegrante(documento, grupo, ocorrencias);
    if (integrante === undefined) continue;
    const itens = descerAoGrupoDoDocumento(raiz, documento, integrante);
    if (repeteParaTodos(documento)) {
      incluirDeTodos(itens, { documento, grupo, integrante }, integrantesDeTodos);
    } else {
      const rotulo = integrante === null ? documento.nome : `${documento.nome} — ${integrante}`;
      itens.push({ tipo: 'DOCUMENTO', documento: paraALista(documento, rotulo) });
    }
  }
  return raiz;
}

/** O nível do primeiro grupo da árvore que se repete por integrante; negativo quando nenhum se repete. */
function nivelDaRepeticao(documento: DocumentoAvaliado): number {
  return documento.grupos.findIndex((g) => g.repetePorEntidade !== null);
}

function repeteParaTodos(documento: DocumentoAvaliado): boolean {
  return (
    documento.repetePorEntidade !== null &&
    documento.grupos.length > 0 &&
    nivelDaRepeticao(documento) < 0
  );
}

/** Os itens do último grupo da árvore do documento, criando os grupos que ainda não existem. */
function descerAoGrupoDoDocumento(
  raiz: NoEmMontagem[],
  documento: DocumentoAvaliado,
  integrante: string | null,
): NoEmMontagem[] {
  const repeteDesde = nivelDaRepeticao(documento);
  let itens = raiz;
  documento.grupos.forEach((g, nivel) => {
    if (nivel === repeteDesde && nivel > 0) {
      itens = grupoEm(itens, JUNTOS, {
        chave: `${g.grupoId}:todos`,
        integrante: null,
        deCadaIntegrante: true,
      }).itens;
    }
    const porIntegrante = repeteDesde >= 0 && nivel >= repeteDesde;
    itens = grupoEm(itens, g, {
      chave: porIntegrante ? `${g.grupoId}:${documento.ocorrenciaId ?? ''}` : g.grupoId,
      integrante: nivel === repeteDesde ? integrante : null,
      deCadaIntegrante: false,
    }).itens;
  });
  return itens;
}

/** O nó que junta as escolhas de cada integrante: todas são pedidas. */
const JUNTOS: GrupoDoDocumento = {
  grupoId: '',
  tipo: GRUPO_E,
  minimo: null,
  repetePorEntidade: null,
};

/** O grupo do nível em que o documento entra: o já montado com a mesma identidade, ou um novo. */
function grupoEm(
  itens: NoEmMontagem[],
  grupo: GrupoDoDocumento,
  identidade: Pick<GrupoEmMontagem, 'chave' | 'integrante' | 'deCadaIntegrante'>,
): GrupoEmMontagem {
  const existente = itens.find(
    (n): n is GrupoEmMontagem => n.tipo !== 'DOCUMENTO' && n.chave === identidade.chave,
  );
  if (existente) return existente;
  const novo: GrupoEmMontagem = {
    tipo: grupo.tipo === GRUPO_OU ? GRUPO_OU : GRUPO_E,
    chave: identidade.chave,
    minimo: grupo.minimo ?? 1,
    integrante: identidade.integrante,
    deCadaIntegrante: identidade.deCadaIntegrante,
    itens: [],
  };
  itens.push(novo);
  return novo;
}

/**
 * A folha que se repete sob um grupo escolhido uma vez: um item só, com os integrantes de quem as
 * respostas o pedem — o integrante a quem a exigência não se aplica não vem na avaliação — e a situação
 * de cada um.
 */
function incluirDeTodos(
  itens: NoEmMontagem[],
  { documento, grupo, integrante }: FolhaQueSeRepete,
  integrantesDeTodos: Map<string, IntegranteDoItem[]>,
): void {
  const chave = `${documento.exigenciaId}:todos`;
  const integrantes = [
    ...(integrantesDeTodos.get(chave) ?? []),
    {
      titulo: integrante,
      ocorrenciaId: documento.ocorrenciaId,
      situacao: classeDaSituacao(documento.situacao),
    },
  ];
  integrantesDeTodos.set(chave, integrantes);
  const item: NoEmMontagem = {
    tipo: 'DOCUMENTO',
    documento: documentoJuntado(chave, documento, grupo, integrantes),
  };
  const indice = itens.findIndex((n) => n.tipo === 'DOCUMENTO' && n.documento.chave === chave);
  if (indice < 0) itens.push(item);
  else itens[indice] = item;
}

function documentoJuntado(
  chave: string,
  documento: DocumentoAvaliado,
  grupo: GrupoRenderizavel | undefined,
  integrantes: readonly IntegranteDoItem[],
): DocumentoNaTela {
  const situacoes = new Set(integrantes.map((i) => i.situacao));
  const unica = situacoes.size === 1 ? classeDaSituacao(documento.situacao) : null;
  const rotulo = `${documento.nome} — ${deQuem(integrantes, unica !== null, grupo)}`;
  return {
    ...paraALista(documento, rotulo),
    ...(unica === null
      ? {
          situacao: 'Conforme o integrante, como indicado no nome',
          exigido: situacoes.has(EXIGIDO),
        }
      : situacaoNaLista(unica)),
    chave,
    juntado: true,
    exigidas: exigidasDosIntegrantes(documento, integrantes),
  };
}

function exigidasDosIntegrantes(
  documento: DocumentoAvaliado,
  integrantes: readonly IntegranteDoItem[],
): ExigenciaPedida[] {
  return integrantes
    .filter((i) => i.situacao === EXIGIDO)
    .map((i) => ({
      chave: chaveDaExigencia({ exigenciaId: documento.exigenciaId, ocorrenciaId: i.ocorrenciaId }),
      exigenciaId: documento.exigenciaId,
      ocorrenciaId: i.ocorrenciaId,
      enviavel: i.ocorrenciaId !== null,
      texto: i.titulo === null ? documento.nome : `${documento.nome} — ${i.titulo}`,
    }));
}

/** Como a situação de parte dos integrantes entra no nome do documento, quando ela varia entre eles. */
const PREFIXO_DA_SITUACAO: Readonly<Record<string, string>> = {
  [EXIGIDO]: '',
  [PODE_SER_EXIGIDO]: 'pode ser exigido ',
  [DEPENDE_DE_FASE_POSTERIOR]: 'pode ser exigido, conforme uma fase posterior, ',
};

/** "de cada integrante (familiares)", para quando não se sabe quais integrantes há. */
function deCadaIntegrante(grupo: GrupoRenderizavel | undefined): string {
  const doGrupo = grupo ? ` (${grupo.rotulo.toLocaleLowerCase('pt-BR')})` : '';
  return `de cada integrante${doGrupo}`;
}

/**
 * A quem o documento se aplica, pelos títulos dos integrantes: "de Você (candidato) e do Integrante 1".
 * Quando a situação varia, cada uma diz os seus: "de Você (candidato); pode ser exigido do Integrante 1".
 * Sem saber quais integrantes há, vale para cada um.
 */
function deQuem(
  integrantes: readonly IntegranteDoItem[],
  situacaoUnica: boolean,
  grupo: GrupoRenderizavel | undefined,
): string {
  if (integrantes.some((i) => i.ocorrenciaId === null || i.titulo === null))
    return deCadaIntegrante(grupo);
  const porSituacao = new Map<string, string[]>();
  for (const { titulo, situacao } of integrantes) {
    porSituacao.set(situacao, [...(porSituacao.get(situacao) ?? []), titulo as string]);
  }
  return [EXIGIDO, PODE_SER_EXIGIDO, DEPENDE_DE_FASE_POSTERIOR, ...porSituacao.keys()]
    .filter((situacao, i, todas) => porSituacao.has(situacao) && todas.indexOf(situacao) === i)
    .map((situacao) => {
      const prefixo = situacaoUnica ? '' : (PREFIXO_DA_SITUACAO[situacao] ?? '');
      return `${prefixo}${comPreposicao(porSituacao.get(situacao) ?? [])}`;
    })
    .join('; ');
}

function comPreposicao(titulos: readonly string[]): string {
  const comDe = titulos.map((t) => (t.startsWith('Integrante') ? `do ${t}` : `de ${t}`));
  return comDe.length === 1 ? comDe[0] : `${comDe.slice(0, -1).join(', ')} e ${comDe.at(-1)}`;
}

/** O que a lista diz da situação do documento, no lugar de a quem a exigência se aplica. */
const TEXTO_DA_SITUACAO: Readonly<Record<string, string>> = {
  [EXIGIDO]: 'Exigido pelas suas respostas',
  [PODE_SER_EXIGIDO]: 'Pode ser exigido, conforme as respostas',
  [DEPENDE_DE_FASE_POSTERIOR]: 'Pode ser exigido, conforme uma fase posterior do processo',
};

function situacaoNaLista(situacao: string): Pick<DocumentoNaTela, 'exigido' | 'situacao'> {
  return {
    exigido: situacao === EXIGIDO,
    situacao: TEXTO_DA_SITUACAO[situacao] ?? TEXTO_DA_SITUACAO[PODE_SER_EXIGIDO],
  };
}

function paraALista(documento: DocumentoAvaliado, rotulo: string): DocumentoNaTela {
  const chave = chaveDaExigencia(documento);
  return {
    chave,
    juntado: false,
    rotulo,
    exigidas: exigidasDoDocumento(documento, chave, rotulo),
    ...situacaoNaLista(classeDaSituacao(documento.situacao)),
    obrigatorio: documento.obrigatorio,
    formatos: formatosDaExigencia(documento.formatosAceitos),
    modelo: documento.modelo,
    formatosAceitos: documento.formatosAceitos,
    tamanhoMaximoBytes: documento.tamanhoMaximoBytes,
    quantidadeMinima: documento.quantidadeMinima,
  };
}

function exigidasDoDocumento(
  documento: DocumentoAvaliado,
  chave: string,
  rotulo: string,
): ExigenciaPedida[] {
  if (classeDaSituacao(documento.situacao) !== EXIGIDO) return [];
  const enviavel =
    documento.ocorrenciaId !== null ||
    (documento.grupoCodigo === null && documento.repetePorEntidade === null);
  return [
    {
      chave,
      exigenciaId: documento.exigenciaId,
      ocorrenciaId: documento.ocorrenciaId,
      enviavel,
      texto: rotulo,
    },
  ];
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
  const lista = ocorrencias[codigo] ?? [];
  const indice = lista.findIndex((o) => o.id === documento.ocorrenciaId);
  if (indice < 0) return undefined;
  return titulosDasOcorrencias(
    grupo?.incluiCandidato ?? false,
    lista.map((o) => o.respostas),
  )[indice];
}
