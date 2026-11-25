import type {
  EntradaDaAvaliacao,
  GrupoAvaliadoInterno,
  ItemAvaliado,
  OcorrenciaAvaliadaInterna,
  OcorrenciaRespondida,
} from './avaliacao-interna';
import { avaliarItem, type ContextoDaPagina, obrigatorioSeVisivel } from './avaliacao-do-item';
import type { DefinicaoPagina, DefinicaoGrupo } from './definicao-do-formulario';
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
  const visivel = e(
    avaliarOuVerdadeiro(pagina.exibicao, fatos),
    avaliarOuVerdadeiro(grupo.exibicao, fatos),
  );
  const obrigatorio = obrigatorioSeVisivel(visivel, grupo.obrigatoriedade, fatos);
  const avaliacao = fabricaDoGrupo(pagina, grupo, { visivel, obrigatorio });

  if (visivel === FALSO) return avaliacao(NAO_APLICAVEL, []);
  if (visivel === INDETERMINADO) return avaliacao(INDETERMINADO, []);
  return avaliarOcorrenciasDoGrupo({ pagina, grupo, entrada, fatos, obrigatorio, avaliacao });
}

/** O grupo avaliado, com o que já se sabe dele; falta dizer o estado e as ocorrências. */
function fabricaDoGrupo(
  pagina: DefinicaoPagina,
  grupo: DefinicaoGrupo,
  { visivel, obrigatorio }: { visivel: Ternario; obrigatorio: Ternario },
): FabricaDoGrupo {
  return (estado, ocorrencias, contagemValida = true, ocorrenciaDoCandidatoValida = true) => ({
    codigo: grupo.codigo,
    paginaCodigo: pagina.codigo,
    visivel,
    obrigatorio,
    estado,
    contagemValida,
    ocorrenciaDoCandidatoValida,
    ocorrencias,
  });
}

function avaliarOcorrenciasDoGrupo(contexto: ContextoDoGrupo): GrupoAvaliadoInterno {
  const { pagina, grupo, entrada, fatos, obrigatorio, avaliacao } = contexto;
  const paginaConcluida = entrada.paginasConcluidas.has(pagina.codigo);
  const semResposta: EstadoDoFato =
    obrigatorio === FALSO && paginaConcluida ? NAO_INFORMADO : INDETERMINADO;
  const respondidas = entrada.grupos.get(grupo.codigo);
  if (!respondidas) return avaliacao(semResposta, []);

  const daPagina = {
    paginaCodigo: pagina.codigo,
    paginaConcluida,
    diaDoEnvio: entrada.diaDoEnvio,
    fatos,
  };
  const ocorrencias = respondidas.map((o) => avaliarOcorrencia(grupo, o, daPagina));
  const contagemValida = contagemDeOcorrenciasValida(grupo, obrigatorio, ocorrencias.length);
  // A lista vazia, que só vale no grupo opcional, não tem ocorrência do candidato a conferir.
  const candidatoValido =
    !grupo.incluiCandidato || ocorrencias.length === 0 || temUmaOcorrenciaDoCandidato(respondidas);
  if (!contagemValida || !candidatoValido)
    return avaliacao(semResposta, ocorrencias, contagemValida, candidatoValido);
  return avaliacao(estadoDoGrupoRespondido(obrigatorio, ocorrencias), ocorrencias);
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
  const contexto = new Map(contextoDaPagina.fatos);
  const daOcorrencia = new Map<string, FatoResolvido>();
  const itens: ItemAvaliado[] = [];
  for (const subitem of grupo.subitens) {
    const { fato, avaliacao } = avaliarItem(subitem, ocorrencia.respostas.get(subitem.fatoCodigo), {
      ...contextoDaPagina,
      visivelDoContentor: VERDADEIRO,
      fatos: contexto,
    });
    contexto.set(subitem.fatoCodigo, fato);
    daOcorrencia.set(subitem.fatoCodigo, fato);
    itens.push(avaliacao);
  }
  const estado = [...daOcorrencia.values()].some((f) => f.estado === INDETERMINADO)
    ? INDETERMINADO
    : RESOLVIDO;
  return { id: ocorrencia.id, itens, fatos: daOcorrencia, estado };
}
