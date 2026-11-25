import {
  FATO_PARENTESCO,
  PROPRIO_CANDIDATO,
} from '../../formulario-do-candidato/interpretador/ocorrencia-do-candidato';
import { campoNovo, ehColetavel } from './catalogo-de-campos';
import { todosOsCampos } from './citacoes';
import { OBRIGATORIEDADE_INICIAL } from './constantes';
import { camposDoGrupo, comCamposEmOrdem, recusaDoTeto } from './grupos';
import { RESTRICAO_OPCOES_DAS_RESPOSTAS, RESTRICAO_OPCOES_PERMITIDAS } from './restricoes-de-valor';
import {
  ConteudoDoFormulario,
  ESCOPO_MEMBRO,
  FatoDoFormulario,
  GrupoDoFormulario,
  ItemDoFormulario,
  OcorrenciasDoGrupo,
  OpcoesCondicionadas,
  RestricaoDeValor,
  ResultadoDoGrupo,
} from './tipos';

/**
 * Inclui o próprio candidato como membro do grupo (UNI-REQ-0146). O grupo tem ao menos uma
 * ocorrência — a do candidato — e o parentesco como primeiro campo, sempre exibido e obrigatório,
 * com o próprio candidato entre as opções que valem sempre: é a resposta que identifica a
 * ocorrência dele (`CandidatoComoMembro`).
 */
export function incluirCandidatoComoMembro(
  conteudo: ConteudoDoFormulario,
  grupo: GrupoDoFormulario,
  contexto: ContextoDoParentesco,
): ResultadoDoGrupo {
  const parentesco = parentescoDoGrupo(conteudo, grupo, contexto);
  if (!parentesco.ok) return parentesco;
  const demais = camposDoGrupo(grupo).filter((campo) => campo.fatoCodigo !== FATO_PARENTESCO);
  return comCamposEmOrdem(
    { ...grupo, ocorrencias: comOcorrenciaDoCandidato(grupo.ocorrencias) },
    [comoParentescoDoCandidato(parentesco.campo), ...demais],
    contexto.nomes,
  );
}

/** O que o parentesco precisa para entrar no grupo: o catálogo, os nomes e os fatos já respondidos fora dele. */
export interface ContextoDoParentesco {
  readonly catalogo: readonly FatoDoFormulario[];
  readonly nomes: ReadonlyMap<string, string>;
  readonly indisponiveis?: readonly string[];
}

type ParentescoDoGrupo =
  | { readonly ok: true; readonly campo: ItemDoFormulario }
  | { readonly ok: false; readonly recusa: string };

function fatoDeParentesco(catalogo: readonly FatoDoFormulario[]): FatoDoFormulario | undefined {
  return catalogo.find((fato) => fato.codigo === FATO_PARENTESCO);
}

/** O parentesco que o grupo já tem, ou o novo que o catálogo oferece; a recusa quando ele não pode entrar. */
function parentescoDoGrupo(
  conteudo: ConteudoDoFormulario,
  grupo: GrupoDoFormulario,
  contexto: ContextoDoParentesco,
): ParentescoDoGrupo {
  const atual = grupo.subitens.find((campo) => campo.fatoCodigo === FATO_PARENTESCO);
  if (atual !== undefined) return { ok: true, campo: atual };
  const recusa = recusaDoParentescoNovo(conteudo, grupo, contexto);
  if (recusa !== null) return { ok: false, recusa };
  const fato = fatoDeParentesco(contexto.catalogo) as FatoDoFormulario;
  return { ok: true, campo: campoNovo(fato, -1, null) };
}

/** O parentesco sempre exibido, obrigatório e com o próprio candidato entre as opções. */
function comoParentescoDoCandidato(base: ItemDoFormulario): ItemDoFormulario {
  return {
    ...base,
    regras: {
      ...base.regras,
      exibicao: null,
      obrigatoriedade: OBRIGATORIEDADE_INICIAL,
      restricoes: comOProprioCandidato(base.regras.restricoes ?? null),
    },
  };
}

/** A ocorrência do candidato conta no mínimo: o grupo tem ao menos uma. */
function comOcorrenciaDoCandidato(ocorrencias: OcorrenciasDoGrupo): OcorrenciasDoGrupo {
  return {
    ...ocorrencias,
    minimo: Math.max(1, Number(ocorrencias.minimo) || 0),
    incluiCandidato: true,
  };
}

/**
 * Por que o parentesco não pode virar campo do grupo; nulo quando pode. O fato aparece uma vez por
 * formulário — e, no processo, num formulário só: o parentesco coletado em outro lugar, ou por
 * outra finalidade, não se repete aqui.
 */
function recusaDoParentescoNovo(
  conteudo: ConteudoDoFormulario,
  grupo: GrupoDoFormulario,
  contexto: ContextoDoParentesco,
): string | null {
  return (
    recusaDoParentescoJaRespondido(conteudo, contexto) ??
    recusaDoParentescoNoCatalogo(fatoDeParentesco(contexto.catalogo)) ??
    recusaDoTeto(conteudo, grupo)
  );
}

function recusaDoParentescoJaRespondido(
  conteudo: ConteudoDoFormulario,
  contexto: ContextoDoParentesco,
): string | null {
  if (todosOsCampos(conteudo).some((campo) => campo.fatoCodigo === FATO_PARENTESCO)) {
    return 'O parentesco já é campo de outro grupo deste formulário, e um fato aparece uma vez só: o candidato só pode ser membro daquele grupo.';
  }
  const conhecidosFora = [...(conteudo.pressupostos ?? []), ...(contexto.indisponiveis ?? [])];
  return conhecidosFora.includes(FATO_PARENTESCO)
    ? 'O parentesco é respondido em outro formulário — o anterior ou outra finalidade do processo — e por isso não pode ser coletado aqui.'
    : null;
}

function recusaDoParentescoNoCatalogo(fato: FatoDoFormulario | undefined): string | null {
  if (fato === undefined || !ehColetavel(fato, ESCOPO_MEMBRO)) {
    return 'O catálogo não tem o fato de parentesco do membro, que identifica a ocorrência do candidato.';
  }
  // Fato desativado não entra em vínculo novo (ADR-0136): reative o parentesco no catálogo antes.
  return fato.ativo
    ? null
    : 'O fato de parentesco está desativado no catálogo: reative-o antes de incluir o candidato como membro.';
}

/** As opções do parentesco admitem sempre o próprio candidato; as formadas por respostas não o garantem e saem. */
function comOProprioCandidato(
  restricoes: readonly RestricaoDeValor[] | null,
): readonly RestricaoDeValor[] | null {
  const ajustadas = (restricoes ?? [])
    .filter((restricao) => restricao.tipo !== RESTRICAO_OPCOES_DAS_RESPOSTAS)
    .map((restricao) =>
      restricao.tipo === RESTRICAO_OPCOES_PERMITIDAS
        ? { ...restricao, entradas: entradasComOProprioCandidato(restricao.entradas ?? []) }
        : restricao,
    );
  return ajustadas.length === 0 ? null : ajustadas;
}

function entradasComOProprioCandidato(
  entradas: readonly OpcoesCondicionadas[],
): readonly OpcoesCondicionadas[] {
  if (
    entradas.some((entrada) => valeSempre(entrada) && entrada.valores.includes(PROPRIO_CANDIDATO))
  )
    return entradas;
  const fixa = entradas.findIndex(valeSempre);
  if (fixa < 0) return [...entradas, { quando: null, valores: [PROPRIO_CANDIDATO] }];
  return entradas.map((entrada, indice) =>
    indice === fixa ? { ...entrada, valores: [...entrada.valores, PROPRIO_CANDIDATO] } : entrada,
  );
}

function valeSempre(entrada: OpcoesCondicionadas): boolean {
  return (entrada.quando ?? []).length === 0;
}
