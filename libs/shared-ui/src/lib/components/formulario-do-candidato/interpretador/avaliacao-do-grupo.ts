import type {
  EntradaDaAvaliacao,
  GrupoAvaliadoInterno,
  ItemAvaliado,
  OcorrenciaAvaliadaInterna,
  OcorrenciaRespondida,
} from './avaliacao-interna';
import {
  avaliarItem,
  type ContextoDaPagina,
  type ContextoDoItem,
  obrigatorioSeVisivel,
  opcionalEmPaginaConcluida,
} from './avaliacao-do-item';
import type { DefinicaoPagina, DefinicaoGrupo, DefinicaoItem } from './definicao-do-formulario';
import {
  e,
  type EstadoDoFato,
  FALSO,
  type FatoResolvido,
  type Fatos,
  INDETERMINADO,
  NAO_APLICAVEL,
  NAO_INFORMADO,
  RESOLVIDO,
  type Ternario,
  VERDADEIRO,
} from './logica';
import { ehParentescoDoCandidato, FATO_PARENTESCO } from './ocorrencia-do-candidato';
import { avaliarOuVerdadeiro } from './predicado';

type FabricaDoGrupo = (
  estado: EstadoDoFato,
  ocorrencias: readonly OcorrenciaAvaliadaInterna[],
  contagemValida?: boolean,
  ocorrenciaDoCandidatoValida?: boolean,
) => GrupoAvaliadoInterno;

type ContextoDosSubitens = ContextoDoItem & { fatos: Map<string, FatoResolvido> };

interface ContextoDoGrupo {
  readonly pagina: DefinicaoPagina;
  readonly grupo: DefinicaoGrupo;
  readonly entrada: EntradaDaAvaliacao;
  readonly fatos: Fatos;
  readonly obrigatorio: Ternario;
  readonly avaliacao: FabricaDoGrupo;
}

/**
 * O grupo e, se aparece e foi respondido, cada ocorrência com os fatos do candidato e os subitens
 * anteriores dela. A contagem fora do mínimo e do máximo, e a lista do grupo que inclui o candidato
 * sem exatamente uma ocorrência dele, não valem como resposta.
 */
export function avaliarGrupo(
  pagina: DefinicaoPagina,
  grupo: DefinicaoGrupo,
  entrada: EntradaDaAvaliacao,
  fatos: Fatos,
): GrupoAvaliadoInterno {
  const visivel = visibilidadeDoGrupo(pagina, grupo, fatos);
  const obrigatorio = obrigatorioSeVisivel(visivel, grupo.obrigatoriedade, fatos);
  const avaliacao = fabricaDoGrupo(pagina, grupo, { visivel, obrigatorio });

  if (visivel === FALSO) return avaliacao(NAO_APLICAVEL, []);
  if (visivel === INDETERMINADO) return avaliacao(INDETERMINADO, []);
  return avaliarOcorrenciasDoGrupo({ pagina, grupo, entrada, fatos, obrigatorio, avaliacao });
}

function visibilidadeDoGrupo(
  pagina: DefinicaoPagina,
  grupo: DefinicaoGrupo,
  fatos: Fatos,
): Ternario {
  return e(avaliarOuVerdadeiro(pagina.exibicao, fatos), avaliarOuVerdadeiro(grupo.exibicao, fatos));
}

interface AparenciaDoGrupo {
  visivel: Ternario;
  obrigatorio: Ternario;
}

/** O grupo avaliado, com o que já se sabe dele; falta dizer o estado e as ocorrências. */
function fabricaDoGrupo(
  pagina: DefinicaoPagina,
  grupo: DefinicaoGrupo,
  aparencia: AparenciaDoGrupo,
): FabricaDoGrupo {
  return (estado, ocorrencias, contagemValida = true, ocorrenciaDoCandidatoValida = true) => ({
    codigo: grupo.codigo,
    paginaCodigo: pagina.codigo,
    ...aparencia,
    estado,
    contagemValida,
    ocorrenciaDoCandidatoValida,
    ocorrencias,
  });
}

function avaliarOcorrenciasDoGrupo(contexto: ContextoDoGrupo): GrupoAvaliadoInterno {
  const { grupo, entrada, obrigatorio, avaliacao } = contexto;
  const daPagina = contextoDaPagina(contexto);
  const semResposta = opcionalEmPaginaConcluida(obrigatorio, daPagina.paginaConcluida)
    ? NAO_INFORMADO
    : INDETERMINADO;
  const respondidas = entrada.grupos.get(grupo.codigo);
  if (!respondidas) return avaliacao(semResposta, []);
  const ocorrencias = respondidas.map((o) => avaliarOcorrencia(grupo, o, daPagina));
  const contagemValida = contagemDeOcorrenciasValida(grupo, obrigatorio, ocorrencias.length);
  const candidatoValido = ocorrenciaDoCandidatoValida(grupo, respondidas);
  if (!contagemValida || !candidatoValido)
    return avaliacao(semResposta, ocorrencias, contagemValida, candidatoValido);
  return avaliacao(estadoDoGrupoRespondido(obrigatorio, ocorrencias), ocorrencias);
}

function contextoDaPagina({ pagina, entrada, fatos }: ContextoDoGrupo): ContextoDaPagina {
  return {
    paginaCodigo: pagina.codigo,
    paginaConcluida: entrada.paginasConcluidas.has(pagina.codigo),
    diaDoEnvio: entrada.diaDoEnvio,
    fatos,
  };
}

function ocorrenciaDoCandidatoValida(
  grupo: DefinicaoGrupo,
  respondidas: readonly OcorrenciaRespondida[],
): boolean {
  // A lista vazia, que só vale no grupo opcional, não tem ocorrência do candidato a conferir.
  return (
    !grupo.incluiCandidato || respondidas.length === 0 || temUmaOcorrenciaDoCandidato(respondidas)
  );
}

function contagemDeOcorrenciasValida(
  grupo: DefinicaoGrupo,
  obrigatorio: Ternario,
  quantas: number,
): boolean {
  return (
    (grupo.maximo === null || quantas <= grupo.maximo) &&
    (quantas >= grupo.minimo || (quantas === 0 && obrigatorio === FALSO))
  );
}

/**
 * A lista vazia é resposta: no opcional, não informado; no obrigatório de mínimo zero, a declaração
 * de que não há ocorrência.
 */
function estadoDoGrupoRespondido(
  obrigatorio: Ternario,
  ocorrencias: readonly OcorrenciaAvaliadaInterna[],
): EstadoDoFato {
  if (ocorrencias.length === 0) {
    if (obrigatorio === FALSO) return NAO_INFORMADO;
    return obrigatorio === VERDADEIRO ? RESOLVIDO : INDETERMINADO;
  }
  return ocorrencias.every((o) => o.estado === RESOLVIDO) ? RESOLVIDO : INDETERMINADO;
}

function temUmaOcorrenciaDoCandidato(ocorrencias: readonly OcorrenciaRespondida[]): boolean {
  return (
    ocorrencias.filter((o) => ehParentescoDoCandidato(o.respostas.get(FATO_PARENTESCO))).length ===
    1
  );
}

/** Os subitens em ordem, cada um com os fatos do candidato e os subitens anteriores da mesma ocorrência. */
function avaliarOcorrencia(
  grupo: DefinicaoGrupo,
  ocorrencia: OcorrenciaRespondida,
  contextoDaPagina: ContextoDaPagina,
): OcorrenciaAvaliadaInterna {
  const { itens, fatos } = avaliarSubitensEmOrdem(grupo, ocorrencia, contextoDaPagina);
  const estado = estadoDaOcorrencia(fatos);
  return { id: ocorrencia.id, itens, fatos, estado };
}

function avaliarSubitensEmOrdem(
  grupo: DefinicaoGrupo,
  ocorrencia: OcorrenciaRespondida,
  contextoDaPagina: ContextoDaPagina,
): { itens: ItemAvaliado[]; fatos: Map<string, FatoResolvido> } {
  const fatos = new Map<string, FatoResolvido>();
  const contextoDoItem = contextoDosSubitens(contextoDaPagina);
  const itens: ItemAvaliado[] = [];
  for (const subitem of grupo.subitens) {
    itens.push(avaliarSubitem(subitem, ocorrencia, contextoDoItem, fatos));
  }
  return { itens, fatos };
}

function contextoDosSubitens(pagina: ContextoDaPagina): ContextoDosSubitens {
  return { ...pagina, visivelDoContentor: VERDADEIRO, fatos: new Map(pagina.fatos) };
}

function avaliarSubitem(
  subitem: DefinicaoItem,
  ocorrencia: OcorrenciaRespondida,
  contexto: ContextoDosSubitens,
  fatos: Map<string, FatoResolvido>,
): ItemAvaliado {
  const { fato, avaliacao } = avaliarItem(
    subitem,
    ocorrencia.respostas.get(subitem.fatoCodigo),
    contexto,
  );
  contexto.fatos.set(subitem.fatoCodigo, fato);
  fatos.set(subitem.fatoCodigo, fato);
  return avaliacao;
}

function estadoDaOcorrencia(fatos: Fatos): EstadoDoFato {
  return [...fatos.values()].some((f) => f.estado === INDETERMINADO) ? INDETERMINADO : RESOLVIDO;
}
