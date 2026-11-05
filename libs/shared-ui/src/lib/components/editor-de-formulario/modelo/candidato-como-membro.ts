import {
  FATO_PARENTESCO,
  PROPRIO_CANDIDATO,
} from '../../formulario-do-candidato/interpretador/ocorrencia-do-candidato';
import { ehColetavel } from './catalogo-de-campos';
import { todosOsCampos } from './citacoes';
import { OBRIGATORIEDADE_SEMPRE } from './constantes';
import { campoDeMembro, camposDoGrupo, comCamposEmOrdem, recusaDoTeto } from './grupos';
import { RESTRICAO_OPCOES_DAS_RESPOSTAS, RESTRICAO_OPCOES_PERMITIDAS } from './restricoes-de-valor';
import {
  ConteudoDoFormulario,
  ESCOPO_MEMBRO,
  FatoDoFormulario,
  GrupoDoFormulario,
  ItemDoFormulario,
  RestricaoDeValor,
  ResultadoDoGrupo,
} from './tipos';

/**
 * Liga ou desliga o próprio candidato como membro do grupo (UNI-REQ-0146). Ligado, o grupo tem ao
 * menos uma ocorrência — a do candidato — e o parentesco como primeiro campo, sempre exibido e
 * obrigatório, com o próprio candidato entre as opções que valem sempre: é a resposta que
 * identifica a ocorrência dele (`CandidatoComoMembro`).
 */
export function comCandidatoComoMembro(
  conteudo: ConteudoDoFormulario,
  grupo: GrupoDoFormulario,
  ligado: boolean,
  contexto: ContextoDoParentesco,
): ResultadoDoGrupo {
  if (!ligado) return { ok: true, grupo: { ...grupo, incluiCandidato: false } };
  const atual = grupo.subitens.find((campo) => campo.fatoCodigo === FATO_PARENTESCO);
  if (atual === undefined) {
    const recusa = recusaDoParentescoNovo(conteudo, grupo, contexto);
    if (recusa !== null) return { ok: false, recusa };
  }
  const base = atual ?? campoDeMembro(fatoDeParentesco(contexto.catalogo) as FatoDoFormulario, -1);
  const parentesco: ItemDoFormulario = {
    ...base,
    precondicao: null,
    obrigatoriedade: OBRIGATORIEDADE_SEMPRE,
    predicadoObrigatoriedade: null,
    restricoes: comOProprioCandidato(base.restricoes ?? null),
  };
  const demais = camposDoGrupo(grupo).filter((campo) => campo.fatoCodigo !== FATO_PARENTESCO);
  return comCamposEmOrdem(
    { ...grupo, incluiCandidato: true, minimo: Math.max(1, Number(grupo.minimo) || 0) },
    [parentesco, ...demais],
    contexto.nomes,
  );
}

/** O que o parentesco precisa para entrar no grupo: o catálogo, os nomes e os fatos já respondidos fora dele. */
export interface ContextoDoParentesco {
  readonly catalogo: readonly FatoDoFormulario[];
  readonly nomes: ReadonlyMap<string, string>;
  readonly indisponiveis?: readonly string[];
}

function fatoDeParentesco(catalogo: readonly FatoDoFormulario[]): FatoDoFormulario | undefined {
  return catalogo.find((fato) => fato.codigo === FATO_PARENTESCO);
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
  if (todosOsCampos(conteudo).some((campo) => campo.fatoCodigo === FATO_PARENTESCO)) {
    return 'O parentesco já é campo de outro grupo deste formulário, e um fato aparece uma vez só: o candidato só pode ser membro daquele grupo.';
  }
  const conhecidosFora = [...(conteudo.pressupostos ?? []), ...(contexto.indisponiveis ?? [])];
  if (conhecidosFora.includes(FATO_PARENTESCO)) {
    return 'O parentesco é respondido em outro formulário — o anterior ou outra finalidade do processo — e por isso não pode ser coletado aqui.';
  }
  const fato = fatoDeParentesco(contexto.catalogo);
  if (fato === undefined || !ehColetavel(fato, ESCOPO_MEMBRO)) {
    return 'O catálogo não tem o fato de parentesco do membro, que identifica a ocorrência do candidato.';
  }
  // Fato desativado não entra em vínculo novo (ADR-0136): reative o parentesco no catálogo antes.
  if (!fato.ativo) {
    return 'O fato de parentesco está desativado no catálogo: reative-o antes de incluir o candidato como membro.';
  }
  return recusaDoTeto(conteudo, grupo);
}

/** As opções do parentesco admitem sempre o próprio candidato; as formadas por respostas não o garantem e saem. */
function comOProprioCandidato(
  restricoes: readonly RestricaoDeValor[] | null,
): readonly RestricaoDeValor[] | null {
  const ajustadas = (restricoes ?? [])
    .filter((restricao) => restricao.tipo !== RESTRICAO_OPCOES_DAS_RESPOSTAS)
    .map((restricao) => {
      if (restricao.tipo !== RESTRICAO_OPCOES_PERMITIDAS) return restricao;
      const entradas = restricao.entradas ?? [];
      if (
        entradas.some(
          (entrada) =>
            (entrada.quando ?? []).length === 0 && entrada.valores.includes(PROPRIO_CANDIDATO),
        )
      )
        return restricao;
      const fixa = entradas.findIndex((entrada) => (entrada.quando ?? []).length === 0);
      return {
        ...restricao,
        entradas:
          fixa < 0
            ? [...entradas, { quando: null, valores: [PROPRIO_CANDIDATO] }]
            : entradas.map((entrada, indice) =>
                indice === fixa
                  ? { ...entrada, valores: [...entrada.valores, PROPRIO_CANDIDATO] }
                  : entrada,
              ),
      };
    });
  return ajustadas.length === 0 ? null : ajustadas;
}
