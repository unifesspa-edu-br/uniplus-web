import type {
  EntradaDaAvaliacao,
  GrupoAvaliadoInterno,
  ItemAvaliado,
  OcorrenciaAvaliadaInterna,
  OcorrenciaRespondida,
} from './avaliacao-interna';
import { avaliarItem, type ContextoDaEtapa, obrigatorioSeVisivel } from './avaliacao-do-item';
import type { DefinicaoEtapa, DefinicaoGrupo } from './definicao-do-formulario';
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
  readonly etapa: DefinicaoEtapa;
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
  etapa: DefinicaoEtapa,
  grupo: DefinicaoGrupo,
  entrada: EntradaDaAvaliacao,
  fatos: Fatos,
): GrupoAvaliadoInterno {
  const visivel = e(
    avaliarOuVerdadeiro(etapa.exibicao, fatos),
    avaliarOuVerdadeiro(grupo.exibicao, fatos),
  );
  const obrigatorio = obrigatorioSeVisivel(visivel, grupo.obrigatoriedade, fatos);
  const avaliacao: FabricaDoGrupo = (
    estado,
    ocorrencias,
    contagemValida = true,
    ocorrenciaDoCandidatoValida = true,
  ) => ({
    codigo: grupo.codigo,
    etapaCodigo: etapa.codigo,
    visivel,
    obrigatorio,
    estado,
    contagemValida,
    ocorrenciaDoCandidatoValida,
    ocorrencias,
  });

  if (visivel === FALSO) return avaliacao(NAO_APLICAVEL, []);
  if (visivel === INDETERMINADO) return avaliacao(INDETERMINADO, []);
  return avaliarOcorrenciasDoGrupo({ etapa, grupo, entrada, fatos, obrigatorio, avaliacao });
}

function avaliarOcorrenciasDoGrupo(contexto: ContextoDoGrupo): GrupoAvaliadoInterno {
  const { etapa, grupo, entrada, fatos, obrigatorio, avaliacao } = contexto;
  const etapaConcluida = entrada.etapasConcluidas.has(etapa.codigo);
  const semResposta: EstadoDoFato =
    obrigatorio === FALSO && etapaConcluida ? NAO_INFORMADO : INDETERMINADO;
  const respondidas = entrada.grupos.get(grupo.codigo);
  if (!respondidas) return avaliacao(semResposta, []);

  const daEtapa = {
    etapaCodigo: etapa.codigo,
    etapaConcluida,
    diaDoEnvio: entrada.diaDoEnvio,
    fatos,
  };
  const ocorrencias = respondidas.map((o) => avaliarOcorrencia(grupo, o, daEtapa));
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
  contextoDaEtapa: ContextoDaEtapa,
): OcorrenciaAvaliadaInterna {
  const contexto = new Map(contextoDaEtapa.fatos);
  const daOcorrencia = new Map<string, FatoResolvido>();
  const itens: ItemAvaliado[] = [];
  for (const subitem of grupo.subitens) {
    const { fato, avaliacao } = avaliarItem(subitem, ocorrencia.respostas.get(subitem.fatoCodigo), {
      ...contextoDaEtapa,
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
