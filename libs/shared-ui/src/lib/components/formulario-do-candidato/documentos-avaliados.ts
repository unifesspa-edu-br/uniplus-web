import type { DocumentoExigido } from '../lista-de-documentos/lista-de-documentos';
import { comoInteiro, type GrupoRenderizavel, type Inteiro } from './formulario-do-candidato.model';
import { titulosDasOcorrencias } from './interpretador/ocorrencia-do-candidato';
import type { OcorrenciaSimulada } from './interpretador/regras-do-formulario';
import {
  type ArquivoEnviado,
  formatosDaExigencia,
  type SituacaoDaExigencia,
} from './envio-de-documentos';
import type { PendenciaDaAvaliacao } from './modalidades-avaliadas';

/** As respostas dadas já pedem o documento e falta enviar. */
export const PENDENTE = 'PENDENTE';
/** As respostas dadas já pedem o documento e os arquivos enviados o atendem. */
export const SATISFEITA = 'SATISFEITA';
/** As respostas dadas já pedem o documento, pendente ou satisfeito: a lista não distingue os dois. */
export const EXIGIDO = 'EXIGIDO';

/** A situação como a lista a agrupa: pendente e satisfeita são ambas o que já é exigido. */
function classeDaSituacao(situacao: string): string {
  return situacao === PENDENTE || situacao === SATISFEITA ? EXIGIDO : situacao;
}
/** Uma resposta que ainda falta decide se o documento é pedido. */
export const PODE_SER_EXIGIDO = 'PODE_SER_EXIGIDO';
/** Decide um fato que só se conhece numa fase posterior, como a modalidade da convocação. */
export const DEPENDE_DE_FASE_POSTERIOR = 'DEPENDE_DE_FASE_POSTERIOR';

/** Todos os itens do grupo são pedidos juntos. */
export const GRUPO_E = 'E';
/** Basta apresentar `minimo` dos itens do grupo — um, se o mínimo não vier. */
export const GRUPO_OU = 'OU';

/** Um grupo da árvore de exigências que contém o documento. */
export interface GrupoDoDocumento {
  readonly grupoId: string;
  /** `E` ou `OU`. */
  readonly tipo: string;
  /** Quantos itens do `OU` bastam; nulo no `E`. */
  readonly minimo: Inteiro | null;
  /** O grupo de integrantes pelo qual este nó se repete: a escolha dele é feita integrante a integrante. */
  readonly repetePorEntidade: string | null;
}

/** Um arquivo já confirmado para a exigência, como a avaliação o devolve. */
export interface ArquivoDoDocumento {
  readonly arquivoId: string;
  readonly tipoDeMidia: string;
  readonly tamanhoBytes: number | string;
}

/** Uma exigência documental diante das respostas do candidato, como a API a calcula (ADR-0143). */
export interface DocumentoAvaliado {
  readonly exigenciaId: string;
  readonly nome: string;
  readonly obrigatorio: boolean;
  /** O formulário em que o documento é apresentado, como `INSCRICAO` ou `ISENCAO_TAXA`. */
  readonly finalidade: string | null;
  readonly formatos: DocumentoExigido['formatos'];
  readonly modelo: DocumentoExigido['modelo'];
  /** Os formatos que o envio aceita para a exigência (PDF, JPEG, PNG). */
  readonly formatosAceitos: readonly string[];
  /** O menor limite de tamanho efetivo entre os formatos aceitos. */
  readonly tamanhoMaximoBytes: number | string;
  /** Quantas apresentações a exigência pede, no mínimo. */
  readonly quantidadeMinima: number | string;
  /** Os arquivos confirmados desta exigência e ocorrência. */
  readonly arquivos: readonly ArquivoDoDocumento[];
  readonly situacao: string;
  /** O grupo pelo qual a exigência se repete, uma vez por integrante; nulo fora de repetição. */
  readonly grupoCodigo: string | null;
  /** A ocorrência do grupo a que a exigência se liga; nula enquanto não se sabe quais integrantes há. */
  readonly ocorrenciaId: string | null;
  /**
   * Os grupos da árvore que contêm a exigência, do mais externo ao mais interno. Documentos com o mesmo
   * grupo estão nele juntos.
   */
  readonly grupos: readonly GrupoDoDocumento[];
  /** O grupo de integrantes pelo qual a própria exigência se repete, quando a repetição começa nela. */
  readonly repetePorEntidade: string | null;
}

/** Uma fase do cronograma: os documentos dela e o que falta responder para decidir os que podem ser pedidos. */
export interface FaseDosDocumentosAvaliados {
  readonly faseId: string;
  readonly codigo: string;
  readonly ordem: Inteiro;
  readonly documentos: readonly DocumentoAvaliado[];
  readonly pendencias: readonly PendenciaDaAvaliacao[];
}

export interface DocumentosAvaliados {
  readonly fases: readonly FaseDosDocumentosAvaliados[];
}

/** O que o formulário mostra da avaliação dos documentos: os da fase e finalidade dele. */
export interface DocumentosDoFormulario {
  readonly documentos: readonly DocumentoAvaliado[];
  readonly pendencias: readonly PendenciaDaAvaliacao[];
}

/**
 * Os documentos que se apresentam no próprio formulário: os da fase dele e, nela, os da finalidade
 * dele — a isenção na mesma fase tem formulário próprio. As pendências são as da fase. Sem a fase do
 * formulário, nada se mostra.
 */
export function documentosDoFormulario(
  documentos: DocumentosAvaliados,
  faseId: string | null | undefined,
  finalidade: string,
): DocumentosDoFormulario {
  const fase = faseId ? documentos.fases.find((f) => f.faseId === faseId) : undefined;
  return {
    documentos: fase?.documentos.filter((d) => d.finalidade === finalidade) ?? [],
    pendencias: fase?.pendencias ?? [],
  };
}

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

type GrupoEmMontagem = {
  tipo: typeof GRUPO_E | typeof GRUPO_OU;
  chave: string;
  minimo: number;
  integrante: string | null;
  deCadaIntegrante: boolean;
  itens: NoEmMontagem[];
};
type NoEmMontagem = { tipo: 'DOCUMENTO'; documento: DocumentoNaTela } | GrupoEmMontagem;

type Ocorrencias = Readonly<Record<string, readonly OcorrenciaSimulada[]>>;

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
    const repeteDesde = documento.grupos.findIndex((g) => g.repetePorEntidade !== null);
    const deTodos =
      documento.repetePorEntidade !== null && documento.grupos.length > 0 && repeteDesde < 0;
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
    if (deTodos) {
      incluirDeTodos(itens, documento, grupo, integrante, integrantesDeTodos);
    } else {
      const rotulo = integrante === null ? documento.nome : `${documento.nome} — ${integrante}`;
      itens.push({ tipo: 'DOCUMENTO', documento: paraALista(documento, rotulo) });
    }
  }
  return raiz;
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
    minimo: grupo.minimo === null ? 1 : comoInteiro(grupo.minimo),
    integrante: identidade.integrante,
    deCadaIntegrante: identidade.deCadaIntegrante,
    itens: [],
  };
  itens.push(novo);
  return novo;
}

/** Um integrante de quem a avaliação pede o documento que se repete, e como pede. */
interface IntegranteDoItem {
  readonly titulo: string | null;
  readonly ocorrenciaId: string | null;
  readonly situacao: string;
}

/**
 * A folha que se repete sob um grupo escolhido uma vez: um item só, com os integrantes de quem as
 * respostas o pedem — o integrante a quem a exigência não se aplica não vem na avaliação — e a situação
 * de cada um.
 */
function incluirDeTodos(
  itens: NoEmMontagem[],
  documento: DocumentoAvaliado,
  grupo: GrupoRenderizavel | undefined,
  integrante: string | null,
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
  const situacoes = new Set(integrantes.map((i) => i.situacao));
  const unica = situacoes.size === 1 ? classeDaSituacao(documento.situacao) : null;
  const item: NoEmMontagem = {
    tipo: 'DOCUMENTO',
    documento: {
      ...paraALista(documento, `${documento.nome} — ${deQuem(integrantes, unica !== null, grupo)}`),
      ...(unica === null
        ? {
            situacao: 'Conforme o integrante, como indicado no nome',
            exigido: situacoes.has(EXIGIDO),
          }
        : situacaoNaLista(unica)),
      chave,
      juntado: true,
      exigidas: integrantes
        .filter((i) => i.situacao === EXIGIDO)
        .map((i) => ({
          chave: chaveDaExigencia({
            exigenciaId: documento.exigenciaId,
            ocorrenciaId: i.ocorrenciaId,
          }),
          exigenciaId: documento.exigenciaId,
          ocorrenciaId: i.ocorrenciaId,
          enviavel: i.ocorrenciaId !== null,
          texto: i.titulo === null ? documento.nome : `${documento.nome} — ${i.titulo}`,
        })),
    },
  };
  const indice = itens.findIndex((n) => n.tipo === 'DOCUMENTO' && n.documento.chave === chave);
  if (indice < 0) itens.push(item);
  else itens[indice] = item;
}

/** Como a situação de parte dos integrantes entra no nome do documento, quando ela varia entre eles. */
const PREFIXO_DA_SITUACAO: Readonly<Record<string, string>> = {
  [EXIGIDO]: '',
  [PODE_SER_EXIGIDO]: 'pode ser exigido ',
  [DEPENDE_DE_FASE_POSTERIOR]: 'pode ser exigido, conforme uma fase posterior, ',
};

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
  if (integrantes.some((i) => i.ocorrenciaId === null || i.titulo === null)) {
    const doGrupo = grupo ? ` (${grupo.rotulo.toLocaleLowerCase('pt-BR')})` : '';
    return `de cada integrante${doGrupo}`;
  }
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
    exigidas:
      classeDaSituacao(documento.situacao) === EXIGIDO
        ? [
            {
              chave,
              exigenciaId: documento.exigenciaId,
              ocorrenciaId: documento.ocorrenciaId,
              enviavel:
                documento.ocorrenciaId !== null ||
                (documento.grupoCodigo === null && documento.repetePorEntidade === null),
              texto: rotulo,
            },
          ]
        : [],
    ...situacaoNaLista(classeDaSituacao(documento.situacao)),
    obrigatorio: documento.obrigatorio,
    formatos: formatosDaExigencia(documento.formatosAceitos),
    modelo: documento.modelo,
    formatosAceitos: documento.formatosAceitos,
    tamanhoMaximoBytes: Number(documento.tamanhoMaximoBytes),
    quantidadeMinima: Number(documento.quantidadeMinima),
  };
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
  if (documento.ocorrenciaId === null) {
    const doGrupo = grupo ? ` (${grupo.rotulo.toLocaleLowerCase('pt-BR')})` : '';
    return `de cada integrante${doGrupo}`;
  }
  const lista = ocorrencias[codigo] ?? [];
  const indice = lista.findIndex((o) => o.id === documento.ocorrenciaId);
  if (indice < 0) return undefined;
  return titulosDasOcorrencias(
    grupo?.incluiCandidato ?? false,
    lista.map((o) => o.respostas),
  )[indice];
}

/**
 * O que dizer quando os documentos exigidos mudam, uma frase por unidade: cada documento fora de
 * escolha, por integrante quando se repete, e cada escolha inteira. A escolha que continua só é
 * anunciada quando o conteúdo dela muda — as exigências e os integrantes, não o nome que eles têm na
 * tela, que muda quando outro integrante sai. O que sai porque o candidato tirou o integrante do
 * formulário não é anunciado: foi ele quem tirou, e o título antigo já pode ser o de outro integrante.
 * A primeira avaliação não é mudança.
 *
 * @param integrantesNoFormulario As ocorrências que os grupos do formulário têm agora.
 */
export function anunciarMudancaDosDocumentos(
  anteriores: readonly NoDeDocumentos[] | null,
  atuais: readonly NoDeDocumentos[] | null,
  integrantesNoFormulario: ReadonlySet<string>,
): string {
  if (anteriores === null || atuais === null) return '';
  const antes = new Map(anteriores.flatMap(unidades).map((u) => [u.id, u]));
  const depois = new Map(atuais.flatMap(unidades).map((u) => [u.id, u]));
  const frases: string[] = [];
  for (const [id, atual] of depois) {
    const anterior = antes.get(id);
    if (!anterior) {
      frases.push(`Passou a ser exigido${atual.escolha ? ', à sua escolha' : ''}: ${atual.texto}.`);
    } else if (atual.escolha && anterior.conteudo !== atual.conteudo) {
      frases.push(`Mudou a escolha: ${atual.texto}.`);
    }
  }
  for (const [id, anterior] of antes) {
    const integranteRemovido =
      anterior.integrantes.length > 0 &&
      anterior.integrantes.every((o) => !integrantesNoFormulario.has(o));
    if (!depois.has(id) && !integranteRemovido) {
      frases.push(`Deixou de ser exigido: ${anterior.texto}.`);
    }
  }
  return frases.join(' ');
}

/**
 * O que se anuncia: um documento pedido, ou uma escolha em que algo já é pedido. O conteúdo identifica
 * a estrutura e as exigências de cada integrante, sem o texto.
 */
interface Unidade {
  readonly id: string;
  readonly escolha: boolean;
  readonly texto: string;
  readonly conteudo: string;
  /** As ocorrências dos integrantes a que a unidade se liga; vazia fora de repetição. */
  readonly integrantes: readonly string[];
}

function unidades(no: NoDeDocumentos): readonly Unidade[] {
  if (no.tipo === 'DOCUMENTO') {
    return no.documento.exigidas.map((e) => ({
      id: e.chave,
      escolha: false,
      texto: e.texto,
      conteudo: e.chave,
      integrantes: integrantesDe([e.chave]),
    }));
  }
  if (!ehEscolha(no)) return no.itens.flatMap(unidades);
  if (!algoPedido(no)) return [];
  return [
    {
      id: no.chave,
      escolha: true,
      texto: textoDaUnidade(no).texto,
      conteudo: conteudoDe(no),
      integrantes: integrantesDe(chavesDe(no)),
    },
  ];
}

/** A estrutura do nó com as exigências de cada folha — as do item juntado, uma por integrante. */
function conteudoDe(no: NoDeDocumentos): string {
  if (no.tipo === 'DOCUMENTO') return chavesDaFolha(no.documento).join('+');
  return `${no.tipo}${no.minimo}(${no.itens.map(conteudoDe).join(',')})`;
}

function chavesDe(no: NoDeDocumentos): readonly string[] {
  return no.tipo === 'DOCUMENTO' ? chavesDaFolha(no.documento) : no.itens.flatMap(chavesDe);
}

/** As chaves `exigência:ocorrência` da folha: as do item juntado, ou a dela. */
function chavesDaFolha(documento: DocumentoNaTela): readonly string[] {
  return documento.juntado ? documento.exigidas.map((e) => e.chave) : [documento.chave];
}

/** As ocorrências de integrante nas chaves `exigência:ocorrência`. */
function integrantesDe(chaves: readonly string[]): readonly string[] {
  return [...new Set(chaves.map((c) => c.slice(c.indexOf(':') + 1)).filter((o) => o !== ''))];
}

/** O grupo em que bastam algumas das alternativas. */
function ehEscolha(no: Exclude<NoDeDocumentos, { tipo: 'DOCUMENTO' }>): boolean {
  return no.tipo === GRUPO_OU && no.minimo < no.itens.length;
}

function algoPedido(no: NoDeDocumentos): boolean {
  return no.tipo === 'DOCUMENTO' ? no.documento.exigido : no.itens.some(algoPedido);
}

interface TextoDaUnidade {
  readonly texto: string;
  /** Junta mais de um item: entre outros, pede delimitação. */
  readonly composto: boolean;
}

/**
 * Como a unidade se diz: o documento pelo nome, o conjunto com "e", a escolha com "ou" — "2 entre A, B
 * e C" no N-de —, com a parte aninhada delimitada: "RG ou CNH, ou Passaporte".
 */
function textoDaUnidade(no: NoDeDocumentos): TextoDaUnidade {
  if (no.tipo === 'DOCUMENTO') return { texto: no.documento.rotulo, composto: false };
  const partes = no.itens.map(textoDaUnidade);
  if (partes.length === 1) return partes[0];
  const algumComposto = partes.some((p) => p.composto);
  if (!ehEscolha(no)) {
    const ultimo = algumComposto ? '; e ' : ' e ';
    return { texto: juntar(partes, algumComposto ? '; ' : ', ', ultimo), composto: true };
  }
  if (no.minimo > 1) {
    const lista = juntar(partes, algumComposto ? '; ' : ', ', algumComposto ? '; e ' : ' e ');
    return { texto: `${no.minimo} entre ${lista}`, composto: true };
  }
  const texto = partes.reduce(
    (dito, parte, i) =>
      i === 0
        ? parte.texto
        : `${dito}${parte.composto || partes[i - 1].composto ? ', ou ' : ' ou '}${parte.texto}`,
    '',
  );
  return { texto, composto: true };
}

function juntar(partes: readonly TextoDaUnidade[], separador: string, ultimo: string): string {
  const textos = partes.map((p) => p.texto);
  return textos.length === 1
    ? textos[0]
    : `${textos.slice(0, -1).join(separador)}${ultimo}${textos.at(-1)}`;
}

/** O que a escolha de um grupo diz ao candidato. */
export function textoDoGrupo(no: Exclude<NoDeDocumentos, { tipo: 'DOCUMENTO' }>): string {
  if (no.deCadaIntegrante) return 'De cada integrante:';
  const texto = textoDaEscolha(no);
  return no.integrante === null ? texto : `${no.integrante}: ${texto}`;
}

function textoDaEscolha(no: Exclude<NoDeDocumentos, { tipo: 'DOCUMENTO' }>): string {
  const total = no.itens.length;
  if (no.tipo === GRUPO_E || no.minimo >= total) {
    return total === 1 ? 'Envie o documento abaixo:' : 'Envie todos estes documentos, juntos:';
  }
  const soDocumentos = no.itens.every((i) => i.tipo === 'DOCUMENTO');
  if (no.minimo === 1) {
    return soDocumentos
      ? 'Envie um dos documentos abaixo, à sua escolha:'
      : 'Envie uma das opções abaixo, à sua escolha:';
  }
  return soDocumentos
    ? `Envie ${no.minimo} dos documentos abaixo, à sua escolha:`
    : `Envie ${no.minimo} das opções abaixo, à sua escolha:`;
}

/** A chave da exigência e da ocorrência, que liga o envio, a situação e os arquivos dela. */
export function chaveDaExigencia(
  documento: Pick<DocumentoAvaliado, 'exigenciaId' | 'ocorrenciaId'>,
): string {
  return `${documento.exigenciaId}:${documento.ocorrenciaId ?? ''}`;
}

/**
 * Da avaliação da API, a situação de cada exigência que já se aplica (pendente ou satisfeita) e os
 * arquivos já confirmados, ambos pela chave da exigência e da ocorrência.
 */
export function situacoesEArquivosDosDocumentos(documentos: readonly DocumentoAvaliado[]): {
  readonly situacoes: Readonly<Record<string, SituacaoDaExigencia>>;
  readonly arquivos: readonly ArquivoEnviado[];
} {
  const situacoes: Record<string, SituacaoDaExigencia> = {};
  const arquivos: ArquivoEnviado[] = [];
  for (const documento of documentos) {
    const chave = chaveDaExigencia(documento);
    if (documento.situacao === PENDENTE || documento.situacao === SATISFEITA) {
      situacoes[chave] = documento.situacao;
    }
    for (const arquivo of documento.arquivos) {
      arquivos.push({
        arquivoId: arquivo.arquivoId,
        chave,
        tipoDeMidia: arquivo.tipoDeMidia,
        tamanhoBytes: Number(arquivo.tamanhoBytes),
      });
    }
  }
  return { situacoes, arquivos };
}

/**
 * Se a exigência está atendida, dado o conjunto das exigências que a avaliação deu por satisfeitas. Num
 * grupo "um ou outro", a exigência está atendida quando o grupo está: bastam as alternativas que o
 * `minimo` pede, e cada alternativa que junta documentos pede todos eles.
 */
export function exigenciaAtendida(
  chave: string,
  arvore: readonly NoDeDocumentos[],
  atendidas: ReadonlySet<string>,
): boolean {
  const chavesDo = (documento: DocumentoNaTela): readonly string[] =>
    documento.exigidas.length > 0 ? documento.exigidas.map((e) => e.chave) : [documento.chave];
  const documentoAtendido = (documento: DocumentoNaTela): boolean =>
    chavesDo(documento).every((c) => atendidas.has(c));
  const atendido = (no: NoDeDocumentos): boolean => {
    if (no.tipo === 'DOCUMENTO') return documentoAtendido(no.documento);
    return no.tipo === GRUPO_OU
      ? no.itens.filter(atendido).length >= no.minimo
      : no.itens.every(atendido);
  };
  // Os grupos "um ou outro" que contêm a exigência, do mais interno ao mais externo; nulo quando a
  // árvore atual não a pede mais.
  const ancestrais = (nos: readonly NoDeDocumentos[]): readonly NoDeDocumentos[] | null => {
    for (const no of nos) {
      if (no.tipo === 'DOCUMENTO') {
        if (no.documento.exigidas.some((e) => e.chave === chave)) return [];
        continue;
      }
      const dentro = ancestrais(no.itens);
      if (dentro) return no.tipo === GRUPO_OU ? [...dentro, no] : dentro;
    }
    return null;
  };
  const grupos = ancestrais(arvore);
  // Exigência que as respostas atuais já não pedem está fora da recusa antiga.
  if (grupos === null) return true;
  return atendidas.has(chave) || grupos.some(atendido);
}
