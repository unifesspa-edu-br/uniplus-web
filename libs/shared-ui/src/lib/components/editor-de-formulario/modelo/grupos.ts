import {
  FATO_PARENTESCO,
  PROPRIO_CANDIDATO,
} from '../../formulario-do-candidato/interpretador/ocorrencia-do-candidato';
import { renderizacaoDe } from './catalogo-de-campos';
import { citaveisAntesDe, fatosCitadosPeloCampo, todosOsCampos } from './citacoes';
import { codigoDoNome, codigoLivre, nomeDoFato } from './codigos';
import { LIMITES_DO_FORMULARIO, OBRIGATORIEDADE_SEMPRE } from './constantes';
import { ordemNoFimDaSecao, renumerar } from './ordem-das-entradas';
import {
  ConteudoDoFormulario,
  FatoDoFormulario,
  GrupoDoFormulario,
  ItemDoFormulario,
  ResultadoDaEdicao,
  ResultadoDoGrupo,
} from './tipos';

/** Quantos campos o formulário tem no teto da API: itens, grupos e campos de grupo (`QuantidadeNoTeto`). */
export function quantidadeNoTeto(conteudo: ConteudoDoFormulario): number {
  return (
    (conteudo.itens ?? []).length +
    (conteudo.grupos ?? []).reduce((total, grupo) => total + 1 + grupo.subitens.length, 0)
  );
}

export { FATO_PARENTESCO, PROPRIO_CANDIDATO };

/** O teto de campos de cada ocorrência de um grupo (`FormaDoGrupo.MaximoDeSubitens`). */
export const MAXIMO_DE_CAMPOS_DO_GRUPO = 30;

/** O campo de membro, sem seção própria: aparece onde o grupo aparece. Nasce obrigatório, como o item. */
export function campoDeMembro(fato: FatoDoFormulario, ordem: number): ItemDoFormulario {
  return {
    fatoCodigo: fato.codigo,
    ordem,
    rotulo: fato.nome.slice(0, LIMITES_DO_FORMULARIO.rotulo),
    tipoRenderizacao: renderizacaoDe(fato) ?? '',
    obrigatoriedade: OBRIGATORIEDADE_SEMPRE,
    precondicao: null,
    etapaCodigo: null,
    predicadoObrigatoriedade: null,
    ajuda: null,
    pedirConfirmacao: false,
  };
}

/**
 * Um grupo repetível novo no fim da seção, já com o primeiro campo — a API recusa grupo sem campo —,
 * obrigatório e sem limite de ocorrências. O código vem do rótulo e não repete nenhum código do
 * catálogo nem do formulário: o grafo recusa grupo com o código de um fato.
 */
export interface NovoGrupo {
  readonly rotulo: string;
  readonly etapaCodigo: string;
  readonly primeiroCampo: FatoDoFormulario;
}

export function acrescentarGrupo(
  conteudo: ConteudoDoFormulario,
  novo: NovoGrupo,
  catalogo: readonly FatoDoFormulario[],
): ResultadoDaEdicao {
  const recusa = recusaDoNovoGrupo(conteudo, novo.rotulo);
  if (recusa !== null) return { ok: false, recusa };
  const grupo = grupoNovo(conteudo, novo, codigosEmUso(conteudo, catalogo));
  return {
    ok: true,
    conteudo: renumerar({ ...conteudo, grupos: [...(conteudo.grupos ?? []), grupo] }),
  };
}

function recusaDoNovoGrupo(conteudo: ConteudoDoFormulario, rotulo: string): string | null {
  if (rotulo.trim() === '') return 'Dê um rótulo ao grupo antes de acrescentá-lo.';
  return quantidadeNoTeto(conteudo) + 2 > LIMITES_DO_FORMULARIO.itens
    ? `O formulário chegou ao máximo de ${LIMITES_DO_FORMULARIO.itens} campos, contando grupos e campos de grupo.`
    : null;
}

function codigosEmUso(
  conteudo: ConteudoDoFormulario,
  catalogo: readonly FatoDoFormulario[],
): ReadonlySet<string> {
  return new Set([
    ...catalogo.map((fato) => fato.codigo),
    ...todosOsCampos(conteudo).map((campo) => campo.fatoCodigo),
    ...(conteudo.grupos ?? []).map((grupo) => grupo.codigo),
    ...(conteudo.pressupostos ?? []),
  ]);
}

function grupoNovo(
  conteudo: ConteudoDoFormulario,
  novo: NovoGrupo,
  usados: ReadonlySet<string>,
): GrupoDoFormulario {
  return {
    codigo: codigoLivre(codigoDoNome(novo.rotulo, 'GRUPO'), usados),
    ordem: ordemNoFimDaSecao(conteudo, novo.etapaCodigo),
    rotulo: novo.rotulo.trim().slice(0, LIMITES_DO_FORMULARIO.rotulo),
    etapaCodigo: novo.etapaCodigo,
    minimo: 0,
    maximo: null,
    exibicao: null,
    obrigatoriedade: OBRIGATORIEDADE_SEMPRE,
    predicadoObrigatoriedade: null,
    subitens: [campoDeMembro(novo.primeiroCampo, 0)],
    incluiCandidato: false,
  };
}

/** Troca o grupo pelo editado, sem mexer na posição dele. */
export function comGrupo(
  conteudo: ConteudoDoFormulario,
  editado: GrupoDoFormulario,
): ConteudoDoFormulario {
  return {
    ...conteudo,
    grupos: (conteudo.grupos ?? []).map((grupo) =>
      grupo.codigo === editado.codigo ? editado : grupo,
    ),
  };
}

/** Remove o grupo. Nada fora dele cita o grupo nem os campos dele — o grafo da API recusa —, então não há a quem recusar. */
export function removerGrupo(conteudo: ConteudoDoFormulario, codigo: string): ConteudoDoFormulario {
  return renumerar({
    ...conteudo,
    grupos: (conteudo.grupos ?? []).filter((grupo) => grupo.codigo !== codigo),
  });
}

/** Os campos do grupo em ordem. */
export function camposDoGrupo(grupo: GrupoDoFormulario): readonly ItemDoFormulario[] {
  return [...grupo.subitens].sort((a, b) => a.ordem - b.ordem);
}

/** A recusa do campo a mais quando o grupo ou o formulário chegou ao teto; nula quando cabe. */
export function recusaDoTeto(
  conteudo: ConteudoDoFormulario,
  grupo: GrupoDoFormulario,
): string | null {
  if (grupo.subitens.length >= MAXIMO_DE_CAMPOS_DO_GRUPO)
    return `O grupo chegou ao máximo de ${MAXIMO_DE_CAMPOS_DO_GRUPO} campos por ocorrência.`;
  return quantidadeNoTeto(conteudo) + 1 > LIMITES_DO_FORMULARIO.itens
    ? `O formulário chegou ao máximo de ${LIMITES_DO_FORMULARIO.itens} campos, contando grupos e campos de grupo.`
    : null;
}

/** O campo de membro no fim do grupo, se cabem mais um no grupo (trinta) e no formulário (o teto global). */
export function acrescentarCampoAoGrupo(
  conteudo: ConteudoDoFormulario,
  grupo: GrupoDoFormulario,
  fato: FatoDoFormulario,
): ResultadoDoGrupo {
  const teto = recusaDoTeto(conteudo, grupo);
  if (teto !== null) return { ok: false, recusa: teto };
  // Renumera o grupo inteiro: a ordem gravada pode começar acima de zero ou ter buraco.
  return {
    ok: true,
    grupo: {
      ...grupo,
      subitens: [...camposDoGrupo(grupo), campoDeMembro(fato, 0)].map((campo, ordem) => ({
        ...campo,
        ordem,
      })),
    },
  };
}

/** Troca o campo do grupo pelo editado. */
export function comCampoDoGrupo(
  grupo: GrupoDoFormulario,
  editado: ItemDoFormulario,
): GrupoDoFormulario {
  return {
    ...grupo,
    subitens: grupo.subitens.map((campo) =>
      campo.fatoCodigo === editado.fatoCodigo ? editado : campo,
    ),
  };
}

/**
 * Remove o campo do grupo. Recusa o último — o grupo tem ao menos um campo —, o parentesco do
 * grupo que inclui o candidato e o campo que outro campo do grupo cita.
 */
export function removerCampoDoGrupo(
  grupo: GrupoDoFormulario,
  fatoCodigo: string,
  nomes: ReadonlyMap<string, string>,
): ResultadoDoGrupo {
  const recusa = recusaDaRemocaoDoCampo(grupo, fatoCodigo, nomes);
  if (recusa !== null) return { ok: false, recusa };
  return {
    ok: true,
    grupo: {
      ...grupo,
      subitens: camposDoGrupo(grupo)
        .filter((campo) => campo.fatoCodigo !== fatoCodigo)
        .map((campo, ordem) => ({ ...campo, ordem })),
    },
  };
}

function recusaDaRemocaoDoCampo(
  grupo: GrupoDoFormulario,
  fatoCodigo: string,
  nomes: ReadonlyMap<string, string>,
): string | null {
  if (grupo.subitens.length <= 1) {
    return 'O grupo precisa de ao menos um campo: remova o grupo inteiro se não precisar dele.';
  }
  if (grupo.incluiCandidato && fatoCodigo === FATO_PARENTESCO) {
    return 'O grupo inclui o candidato e precisa do parentesco: é por ele que se reconhece a ocorrência do candidato.';
  }
  const quem = grupo.subitens.find(
    (campo) => campo.fatoCodigo !== fatoCodigo && fatosCitadosPeloCampo(campo).includes(fatoCodigo),
  );
  return quem === undefined
    ? null
    : `Não é possível remover “${nomeDoFato(nomes, fatoCodigo)}”: o campo “${quem.rotulo}” cita esse campo.`;
}

/**
 * Troca o campo do grupo de lugar com o vizinho. Recusa quando um campo passaria a citar outro do
 * grupo que vem nele ou depois dele: a ocorrência ainda não teria a resposta.
 */
export function moverCampoNoGrupo(
  grupo: GrupoDoFormulario,
  fatoCodigo: string,
  direcao: -1 | 1,
  nomes: ReadonlyMap<string, string>,
): ResultadoDoGrupo {
  const campos = [...camposDoGrupo(grupo)];
  const indice = campos.findIndex((campo) => campo.fatoCodigo === fatoCodigo);
  const alvo = indice + direcao;
  if (indice < 0 || alvo < 0 || alvo >= campos.length)
    return { ok: false, recusa: 'Não é possível mover nessa direção.' };
  [campos[indice], campos[alvo]] = [campos[alvo], campos[indice]];
  return comCamposEmOrdem(grupo, campos, nomes);
}

/**
 * O grupo com os campos na ordem dada, renumerados — ou a recusa, quando um campo citaria outro do
 * grupo que vem nele ou depois dele: a ocorrência ainda não teria a resposta (`CitaFatoPosterior`).
 */
export function comCamposEmOrdem(
  grupo: GrupoDoFormulario,
  campos: readonly ItemDoFormulario[],
  nomes: ReadonlyMap<string, string>,
): ResultadoDoGrupo {
  const posicao = new Map(campos.map((campo, ordem) => [campo.fatoCodigo, ordem]));
  for (const [ordem, campo] of campos.entries()) {
    const posterior = fatosCitadosPeloCampo(campo).find(
      (citado) => (posicao.get(citado) ?? -Infinity) >= ordem && citado !== campo.fatoCodigo,
    );
    if (posterior !== undefined) {
      return {
        ok: false,
        recusa: `“${campo.rotulo}” cita “${nomeDoFato(nomes, posterior)}”, que ficaria depois. Mova primeiro o campo citado.`,
      };
    }
  }
  return {
    ok: true,
    grupo: { ...grupo, subitens: campos.map((campo, ordem) => ({ ...campo, ordem })) },
  };
}

/**
 * Os fatos que um campo do grupo pode citar: os conhecidos antes do grupo e os campos anteriores
 * da mesma ocorrência, que ela já respondeu — nunca o próprio.
 */
export function fatosCitaveisPeloCampoDoGrupo(
  conteudo: ConteudoDoFormulario,
  grupo: GrupoDoFormulario,
  fatoCodigo: string,
): ReadonlySet<string> {
  const campos = camposDoGrupo(grupo);
  const posicao = campos.findIndex((campo) => campo.fatoCodigo === fatoCodigo);
  return new Set([
    ...citaveisAntesDe(conteudo, grupo.ordem, null),
    ...campos.slice(0, Math.max(posicao, 0)).map((campo) => campo.fatoCodigo),
  ]);
}

/** Os fatos que a exibição e a obrigatoriedade do grupo podem citar: os conhecidos antes dele. */
export function fatosCitaveisPeloGrupo(
  conteudo: ConteudoDoFormulario,
  grupo: GrupoDoFormulario,
): ReadonlySet<string> {
  return citaveisAntesDe(conteudo, grupo.ordem, null);
}

/** Por que o grupo não pode ser removido: remover o grupo leva os campos dele, e um campo travado trava o grupo. */
export function motivoDaRemocaoTravadaDoGrupo(
  grupo: GrupoDoFormulario,
  remocoesTravadas: ReadonlyMap<string, string>,
): string | null {
  return (
    grupo.subitens
      .map((campo) => remocoesTravadas.get(campo.fatoCodigo))
      .find((motivo) => motivo !== undefined) ?? null
  );
}
