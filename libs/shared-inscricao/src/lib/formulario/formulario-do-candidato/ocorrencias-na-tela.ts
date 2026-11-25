import type { CampoApresentado } from './formulario-do-candidato.model';
import {
  FATO_PARENTESCO,
  PROPRIO_CANDIDATO,
  titulosDasOcorrencias,
} from './interpretador/ocorrencia-do-candidato';
import type {
  CampoAvaliado,
  GrupoAvaliado,
  ItemDasRegras,
  OcorrenciaSimulada,
  ValorJson,
} from './interpretador/regras-do-formulario';
import type { CampoNoPasso, GrupoNoPasso } from './passos-do-formulario';

/** Uma ocorrência do grupo como a tela a mostra: o título, os campos que aparecem e as respostas dela. */
export interface OcorrenciaNaTela {
  readonly id: string;
  readonly titulo: string;
  readonly doCandidato: boolean;
  readonly campos: readonly CampoNoPasso[];
  readonly respostas: Readonly<Record<string, ValorJson>>;
}

/** Cada ocorrência com os campos que aparecem nela, na ordem do grupo. */
export function ocorrenciasNaTela(
  noPasso: GrupoNoPasso,
  lista: readonly OcorrenciaSimulada[],
  indiceDoCandidato: number | null,
): readonly OcorrenciaNaTela[] {
  const respostas = lista.map((o) => o.respostas);
  const titulos = titulosDasOcorrencias(noPasso.grupo.ocorrencias.incluiCandidato, respostas);
  return lista.map((ocorrencia, i) => ({
    id: ocorrencia.id,
    titulo: titulos[i],
    doCandidato: i === indiceDoCandidato,
    respostas: ocorrencia.respostas ?? {},
    campos: camposDaOcorrencia(noPasso, i, indiceDoCandidato),
  }));
}

interface ContextoDaOcorrencia {
  readonly doCandidato: boolean;
  readonly comCandidatoNaLista: boolean;
}

function camposDaOcorrencia(
  { grupo, avaliado, regras }: GrupoNoPasso,
  indice: number,
  indiceDoCandidato: number | null,
): CampoNoPasso[] {
  const avaliados = avaliadosDaOcorrencia(avaliado, indice);
  const contexto = {
    doCandidato: indice === indiceDoCandidato,
    comCandidatoNaLista: indiceDoCandidato !== null,
  };
  return [...grupo.subitens]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((campo) => campoComRegra(campo, avaliados.get(campo.fatoCodigo), contexto, regras));
}

function avaliadosDaOcorrencia(
  avaliado: GrupoAvaliado,
  indice: number,
): ReadonlyMap<string, CampoAvaliado> {
  const campos = avaliado.ocorrencias.lista[indice]?.campos ?? [];
  return new Map(campos.map((c) => [c.fatoCodigo, c]));
}

function campoComRegra(
  campo: CampoApresentado,
  avaliado: CampoAvaliado | undefined,
  contexto: ContextoDaOcorrencia,
  regras: ReadonlyMap<string, ItemDasRegras>,
): CampoNoPasso[] {
  const noCampo = campoDaOcorrencia(campo, avaliado, contexto);
  return noCampo === null ? [] : [{ ...noCampo, regra: regras.get(campo.fatoCodigo) ?? null }];
}

function campoDaOcorrencia(
  campo: CampoApresentado,
  avaliado: CampoAvaliado | undefined,
  contexto: ContextoDaOcorrencia,
): Pick<CampoNoPasso, 'campo' | 'avaliado'> | null {
  // O parentesco da ocorrência do candidato é fixo: não se pergunta.
  if (contexto.doCandidato && campo.fatoCodigo === FATO_PARENTESCO) return null;
  if (!avaliado || avaliado.regras.visivel !== 'VERDADEIRO') return null;
  // Com o candidato já na lista, o parentesco dos outros integrantes não oferece o próprio candidato.
  if (!contexto.comCandidatoNaLista || campo.fatoCodigo !== FATO_PARENTESCO)
    return { campo, avaliado };
  return { campo: semOProprioCandidato(campo), avaliado: semOProprioCandidatoNasOpcoes(avaliado) };
}

function semOProprioCandidato(campo: CampoApresentado): CampoApresentado {
  return {
    ...campo,
    valoresSelecionaveis: campo.valoresSelecionaveis?.filter((v) => v.codigo !== PROPRIO_CANDIDATO),
  };
}

function semOProprioCandidatoNasOpcoes(avaliado: CampoAvaliado): CampoAvaliado {
  const { opcoes } = avaliado;
  if (!opcoes) return avaliado;
  return {
    ...avaliado,
    opcoes: { ...opcoes, codigos: opcoes.codigos?.filter((c) => c !== PROPRIO_CANDIDATO) },
  };
}
