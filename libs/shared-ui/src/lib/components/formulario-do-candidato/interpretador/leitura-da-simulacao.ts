import { deslocarDia, diaNoFuso } from '@uniplus/shared-utils';

import type { EntradaDaAvaliacao, OcorrenciaRespondida } from './avaliacao-interna';
import type { RegrasInvalidas } from './definicao-do-formulario';
import {
  codigosDa,
  estaVazia,
  FATO_NAO_INFORMADO,
  type FatoResolvido,
  type Fatos,
  resolvido,
} from './logica';
import type {
  EnvioDasRespostas,
  OcorrenciaSimulada,
  SimulacaoDoFormulario,
  ValorJson,
} from './regras-do-formulario';
import { TETO_DE_ANOS, TETO_DE_DIAS } from './restricoes';
import type { DefinicaoFormulario } from './definicao-do-formulario';

/**
 * As ocorrências de cada grupo, pela identidade própria de cada uma, que não se repete no grupo: é por
 * ela que o documento exigido por membro fica ligado ao membro.
 */
function lerOcorrencias(
  grupos: Readonly<Record<string, readonly OcorrenciaSimulada[] | null>> | null | undefined,
): Map<string, OcorrenciaRespondida[]> | RegrasInvalidas {
  const lidas = new Map<string, OcorrenciaRespondida[]>();
  for (const [grupo, recebidas] of Object.entries(grupos ?? {})) {
    const respondidas = lerOcorrenciasDoGrupo(grupo, recebidas);
    if ('caminho' in respondidas) return respondidas;
    lidas.set(grupo, respondidas);
  }
  return lidas;
}

function identidadeValida(id: unknown, anteriores: readonly OcorrenciaRespondida[]): id is string {
  return typeof id === 'string' && id.trim() !== '' && !anteriores.some((o) => o.id === id);
}

function lerOcorrenciasDoGrupo(
  grupo: string,
  recebidas: readonly OcorrenciaSimulada[] | null | undefined,
): OcorrenciaRespondida[] | RegrasInvalidas {
  if (recebidas !== null && recebidas !== undefined && !Array.isArray(recebidas)) {
    return { caminho: `grupos.${grupo}`, mensagem: 'As ocorrências do grupo são uma lista.' };
  }
  const respondidas: OcorrenciaRespondida[] = [];
  for (const [i, ocorrencia] of (recebidas ?? []).entries()) {
    const id = ocorrencia?.id;
    if (!identidadeValida(id, respondidas)) return ocorrenciaSemIdentidade(grupo, i);
    respondidas.push({ id, respostas: new Map(Object.entries(ocorrencia.respostas ?? {})) });
  }
  return respondidas;
}

function ocorrenciaSemIdentidade(grupo: string, indice: number): RegrasInvalidas {
  return {
    caminho: `grupos.${grupo}[${indice}].id`,
    mensagem:
      'Cada ocorrência do grupo precisa de uma identidade própria, que não se repita no grupo.',
  };
}

const INSTANTE_COM_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * O dia do envio no fuso do envio, com as mesmas recusas da API: o instante com zona, o fuso
 * reconhecido e um dia que ainda comporta os maiores deslocamentos da faixa de data. Sem envio, nulo.
 */
export function lerEnvio(
  envio: EnvioDasRespostas | null | undefined,
): string | null | RegrasInvalidas {
  if (envio === null || envio === undefined) return null;
  const instante = lerInstante(envio.instante);
  if (instante === null)
    return {
      caminho: 'envio.instante',
      mensagem: 'O instante do envio é uma data e hora com fuso.',
    };
  const dia = diaNoFusoDoEnvio(instante, envio.fuso);
  if (typeof dia !== 'string') return dia;
  return comportaOsDeslocamentos(dia) ? dia : diaForaDoCalendario();
}

function lerInstante(instante: string): Date | null {
  if (typeof instante !== 'string' || !INSTANTE_COM_ZONA.test(instante)) return null;
  const lido = new Date(instante);
  return Number.isNaN(lido.getTime()) ? null : lido;
}

function diaNoFusoDoEnvio(instante: Date, fuso: string): string | RegrasInvalidas {
  try {
    return diaNoFuso(instante, fuso);
  } catch {
    return { caminho: 'envio.fuso', mensagem: 'A zona do envio simulado não é reconhecida.' };
  }
}

function diaForaDoCalendario(): RegrasInvalidas {
  return {
    caminho: 'envio.instante',
    mensagem: 'O dia do envio não comporta os deslocamentos da faixa de data.',
  };
}

/** O dia do qual o maior deslocamento, para os dois lados, ainda cai no calendário, como na API. */
function comportaOsDeslocamentos(dia: string): boolean {
  const primeiro = deslocarDia('0001-01-01', TETO_DE_ANOS, TETO_DE_DIAS);
  const ultimo = deslocarDia('9999-12-31', -TETO_DE_ANOS, -TETO_DE_DIAS);
  return primeiro !== null && ultimo !== null && dia >= primeiro && dia <= ultimo;
}

/** Os pressupostos: o valor dado resolve o fato, e o valor em branco é não informado. */
function comoFatosConhecidos(
  pressupostos: Readonly<Record<string, ValorJson>> | null | undefined,
): Fatos {
  return new Map<string, FatoResolvido>(
    Object.entries(pressupostos ?? {}).map(([fato, valor]) => [
      fato,
      estaVazia(valor) ? FATO_NAO_INFORMADO : resolvido(valor),
    ]),
  );
}

/** As respostas dentro da oferta do campo; a fora dela não vale e é descartada. */
function dentroDaOferta(
  definicao: DefinicaoFormulario,
  respostas: Iterable<readonly [string, ValorJson]>,
): Map<string, ValorJson> {
  return new Map(
    [...respostas].filter(([fato, resposta]) => {
      const oferta = definicao.ofertas.get(fato);
      const codigos = codigosDa(resposta);
      return (
        !oferta || estaVazia(resposta) || (codigos !== null && codigos.every((c) => oferta.has(c)))
      );
    }),
  );
}

/** As ocorrências de cada grupo e o dia do envio, já lidos; ou a recusa que a leitura deu. */
export interface SimulacaoLida {
  readonly grupos: ReadonlyMap<string, readonly OcorrenciaRespondida[]>;
  readonly diaDoEnvio: string | null;
}

export function lerSimulacao(simulacao: SimulacaoDoFormulario): SimulacaoLida | RegrasInvalidas {
  const grupos = lerOcorrencias(simulacao.grupos);
  if ('caminho' in grupos) return grupos;
  const diaDoEnvio = lerEnvio(simulacao.envio);
  if (diaDoEnvio !== null && typeof diaDoEnvio !== 'string') return diaDoEnvio;
  return { grupos, diaDoEnvio };
}

/** A entrada da avaliação: as respostas dentro da oferta, as seções concluídas e os fatos conhecidos de fora. */
export function entradaDaAvaliacao(
  definicao: DefinicaoFormulario,
  simulacao: SimulacaoDoFormulario,
  { grupos, diaDoEnvio }: SimulacaoLida,
  fatosFixos: ReadonlySet<string>,
): EntradaDaAvaliacao {
  return {
    respostas: dentroDaOferta(definicao, Object.entries(simulacao.respostas ?? {})),
    grupos: ocorrenciasDentroDaOferta(definicao, grupos),
    paginasConcluidas: new Set(simulacao.paginasConcluidas ?? []),
    fatosConhecidos: comoFatosConhecidos(simulacao.pressupostos),
    diaDoEnvio,
    fatosFixos,
  };
}

function ocorrenciasDentroDaOferta(
  definicao: DefinicaoFormulario,
  grupos: ReadonlyMap<string, readonly OcorrenciaRespondida[]>,
): Map<string, OcorrenciaRespondida[]> {
  return new Map(
    [...grupos].map(([grupo, ocorrencias]) => [
      grupo,
      ocorrencias.map((o) => ({ id: o.id, respostas: dentroDaOferta(definicao, o.respostas) })),
    ]),
  );
}
