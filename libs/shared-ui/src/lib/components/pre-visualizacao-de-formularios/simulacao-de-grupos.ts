import { FATO_PARENTESCO, PROPRIO_CANDIDATO, camposDoGrupo, type ConteudoDoFormulario, type FatoDoFormulario } from '../editor-de-formulario/formulario-editavel';
import { comResposta, simulado, type FatoSimulado } from './simulacao-de-respostas';

/** Um grupo repetível que a simulação pergunta, com os campos que cada ocorrência responde. */
export interface GrupoSimulavel {
  readonly codigo: string;
  readonly rotulo: string;
  readonly finalidade: string;
  readonly minimo: number;
  /** Nulo quando o grupo aceita quantas ocorrências o candidato informar. */
  readonly maximo: number | null;
  readonly incluiCandidato: boolean;
  readonly campos: readonly FatoSimulado[];
}

/** Uma ocorrência simulada: a sequência que a identifica no grupo e as respostas dos campos dela. */
export interface OcorrenciaEmSimulacao {
  readonly sequencia: number;
  readonly respostas: ReadonlyMap<string, unknown>;
  /** Os campos com valor escrito que o domínio não reconhece. */
  readonly invalidos: ReadonlySet<string>;
}

/** O grupo na simulação. */
export interface GrupoEmSimulacao {
  /** A próxima sequência. Só cresce: a identidade de uma ocorrência removida não volta noutra. */
  readonly proxima: number;
  /** Nulo: o grupo não foi respondido. Lista vazia: o candidato declarou que não há ocorrência. */
  readonly ocorrencias: readonly OcorrenciaEmSimulacao[] | null;
}

/** Os grupos simulados, por código; o grupo ausente não foi respondido. */
export type SimulacaoDosGrupos = ReadonlyMap<string, GrupoEmSimulacao>;

/** Uma ocorrência como a API a recebe: a identidade e as respostas dos campos, por fato. */
export interface OcorrenciaSimulada {
  readonly id: string;
  readonly respostas: Readonly<Record<string, unknown>>;
}

const SEM_RESPOSTA: GrupoEmSimulacao = { proxima: 1, ocorrencias: null };

/**
 * Os grupos repetíveis dos formulários, com os campos que cada ocorrência responde. O endereço fica
 * de fora, como nas respostas do candidato: é valor estruturado, que nenhuma regra cita.
 */
export function gruposSimulaveis(
  formularios: readonly { readonly finalidade: string; readonly conteudo: ConteudoDoFormulario }[],
  catalogo: readonly FatoDoFormulario[],
): readonly GrupoSimulavel[] {
  const porCodigo = new Map(catalogo.map((fato) => [fato.codigo, fato]));
  return formularios.flatMap(({ finalidade, conteudo }) =>
    (conteudo.grupos ?? []).map((grupo) => ({
      codigo: grupo.codigo,
      rotulo: grupo.rotulo,
      finalidade,
      // O conteúdo lido do servidor pode trazer os números como texto.
      minimo: Number(grupo.minimo),
      maximo: grupo.maximo === null ? null : Number(grupo.maximo),
      incluiCandidato: grupo.incluiCandidato,
      campos: camposDoGrupo(grupo).flatMap((campo) => {
        const fato = porCodigo.get(campo.fatoCodigo);
        return fato === undefined || fato.dominio === 'ENDERECO' ? [] : [simulado(fato, 'resposta')];
      }),
    })),
  );
}

export function estadoDoGrupo(estado: SimulacaoDosGrupos, codigo: string): GrupoEmSimulacao {
  return estado.get(codigo) ?? SEM_RESPOSTA;
}

/** A identidade da ocorrência no envio. Prefixada pelo grupo, não se repete no processo. */
export function idDaOcorrencia(codigo: string, sequencia: number): string {
  return `${codigo}#${sequencia}`;
}

/** Se o grupo já tem todas as ocorrências que admite. Sem máximo, nunca: a simulação aceita quantas o candidato informaria. */
export function noLimite(estado: SimulacaoDosGrupos, grupo: GrupoSimulavel): boolean {
  return grupo.maximo !== null && (estadoDoGrupo(estado, grupo.codigo).ocorrencias?.length ?? 0) >= grupo.maximo;
}

/** Acrescenta uma ocorrência sem resposta no fim; no limite do grupo, devolve o mesmo estado. */
export function acrescentarOcorrencia(estado: SimulacaoDosGrupos, grupo: GrupoSimulavel): SimulacaoDosGrupos {
  if (noLimite(estado, grupo)) return estado;
  const atual = estadoDoGrupo(estado, grupo.codigo);
  const nova: OcorrenciaEmSimulacao = { sequencia: atual.proxima, respostas: new Map(), invalidos: new Set() };
  return comGrupo(estado, grupo.codigo, { proxima: atual.proxima + 1, ocorrencias: [...(atual.ocorrencias ?? []), nova] });
}

/** Remove a ocorrência. Sem nenhuma, o grupo volta a não respondido: a declaração de que não há ocorrência é escolha à parte. */
export function removerOcorrencia(estado: SimulacaoDosGrupos, codigo: string, sequencia: number): SimulacaoDosGrupos {
  const atual = estadoDoGrupo(estado, codigo);
  const restantes = (atual.ocorrencias ?? []).filter((ocorrencia) => ocorrencia.sequencia !== sequencia);
  return comGrupo(estado, codigo, { ...atual, ocorrencias: restantes.length === 0 ? null : restantes });
}

/** Alterna, no grupo sem ocorrência, entre não respondido e a declaração de que não há ocorrência. */
export function declararSemOcorrencia(estado: SimulacaoDosGrupos, codigo: string, declarado: boolean): SimulacaoDosGrupos {
  const atual = estadoDoGrupo(estado, codigo);
  if ((atual.ocorrencias?.length ?? 0) > 0) return estado;
  return comGrupo(estado, codigo, { ...atual, ocorrencias: declarado ? [] : null });
}

/** Grava a resposta de um campo da ocorrência; o valor não reconhecido fica marcado e sem resposta. */
export function comRespostaNaOcorrencia(
  estado: SimulacaoDosGrupos,
  codigo: string,
  sequencia: number,
  fato: string,
  resposta: { readonly valor: unknown; readonly invalido: boolean },
): SimulacaoDosGrupos {
  const atual = estadoDoGrupo(estado, codigo);
  return comGrupo(estado, codigo, {
    ...atual,
    ocorrencias: (atual.ocorrencias ?? []).map((ocorrencia) => {
      if (ocorrencia.sequencia !== sequencia) return ocorrencia;
      const invalidos = new Set(ocorrencia.invalidos);
      if (resposta.invalido) invalidos.add(fato);
      else invalidos.delete(fato);
      return { ...ocorrencia, respostas: comResposta(ocorrencia.respostas, fato, resposta.valor), invalidos };
    }),
  });
}

/** Se alguma ocorrência tem valor não reconhecido: não se simula o que não foi informado. */
export function haValorNaoReconhecido(estado: SimulacaoDosGrupos): boolean {
  return [...estado.values()].some((grupo) => (grupo.ocorrencias ?? []).some((ocorrencia) => ocorrencia.invalidos.size > 0));
}

/**
 * Os grupos do envio. O grupo não respondido fica sem a chave, e o declarado sem ocorrência vai com
 * a lista vazia: a API distingue os dois. Nulo quando nenhum foi respondido.
 */
export function gruposDoEnvio(estado: SimulacaoDosGrupos): Readonly<Record<string, readonly OcorrenciaSimulada[]>> | null {
  const respondidos = [...estado].filter(([, grupo]) => grupo.ocorrencias !== null);
  if (respondidos.length === 0) return null;
  return Object.fromEntries(
    respondidos.map(([codigo, grupo]) => [
      codigo,
      (grupo.ocorrencias ?? []).map((ocorrencia) => ({
        id: idDaOcorrencia(codigo, ocorrencia.sequencia),
        respostas: Object.fromEntries(ocorrencia.respostas),
      })),
    ]),
  );
}

/**
 * Como a tela nomeia a ocorrência que um documento cita: pela posição atual no grupo, e não pela
 * identidade, que é interna; e como a do próprio candidato, quando o parentesco simulado o diz.
 * Nula quando o grupo já não tem a ocorrência.
 */
export function rotuloDaOcorrencia(estado: SimulacaoDosGrupos, codigo: string, rotuloDoGrupo: string, id: string): string | null {
  const ocorrencias = estadoDoGrupo(estado, codigo).ocorrencias ?? [];
  const posicao = ocorrencias.findIndex((ocorrencia) => idDaOcorrencia(codigo, ocorrencia.sequencia) === id);
  if (posicao < 0) return null;
  return `${rotuloDoGrupo}, ocorrência ${posicao + 1}${ehDoCandidato(ocorrencias[posicao]) ? ' (o próprio candidato)' : ''}`;
}

/** Se a resposta simulada diz que a ocorrência é a do próprio candidato. */
export function ehDoCandidato(ocorrencia: OcorrenciaEmSimulacao): boolean {
  return ocorrencia.respostas.get(FATO_PARENTESCO) === PROPRIO_CANDIDATO;
}

function comGrupo(estado: SimulacaoDosGrupos, codigo: string, grupo: GrupoEmSimulacao): SimulacaoDosGrupos {
  const novo = new Map(estado);
  novo.set(codigo, grupo);
  return novo;
}
