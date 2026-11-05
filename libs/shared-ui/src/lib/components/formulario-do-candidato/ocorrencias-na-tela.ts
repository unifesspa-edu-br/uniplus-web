import type { CampoRenderizavel } from './formulario-do-candidato.model';
import {
  FATO_PARENTESCO,
  PROPRIO_CANDIDATO,
  titulosDasOcorrencias,
} from './interpretador/ocorrencia-do-candidato';
import type {
  CampoAvaliado,
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
  const titulos = titulosDasOcorrencias(
    noPasso.grupo.incluiCandidato,
    lista.map((o) => o.respostas),
  );
  return lista.map((ocorrencia, i) => ({
    id: ocorrencia.id,
    titulo: titulos[i],
    doCandidato: i === indiceDoCandidato,
    respostas: ocorrencia.respostas ?? {},
    campos: camposDaOcorrencia(noPasso, i, indiceDoCandidato),
  }));
}

function camposDaOcorrencia(
  { grupo, avaliado, regras }: GrupoNoPasso,
  indice: number,
  indiceDoCandidato: number | null,
): CampoNoPasso[] {
  const avaliados = new Map(
    (avaliado.ocorrencias[indice]?.campos ?? []).map((c) => [c.fatoCodigo, c]),
  );
  return [...grupo.subitens]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((campo) => {
      const noCampo = campoDaOcorrencia(campo, avaliados.get(campo.fatoCodigo), {
        doCandidato: indice === indiceDoCandidato,
        comCandidatoNaLista: indiceDoCandidato !== null,
      });
      return noCampo === null ? [] : [{ ...noCampo, regra: regras.get(campo.fatoCodigo) ?? null }];
    });
}

function campoDaOcorrencia(
  campo: CampoRenderizavel,
  avaliado: CampoAvaliado | undefined,
  contexto: { doCandidato: boolean; comCandidatoNaLista: boolean },
): Pick<CampoNoPasso, 'campo' | 'avaliado'> | null {
  // O parentesco da ocorrência do candidato é fixo: não se pergunta.
  if (contexto.doCandidato && campo.fatoCodigo === FATO_PARENTESCO) return null;
  if (!avaliado || avaliado.visivel !== 'VERDADEIRO') return null;
  // Com o candidato já na lista, o parentesco dos outros integrantes não oferece o próprio candidato.
  if (!contexto.comCandidatoNaLista || campo.fatoCodigo !== FATO_PARENTESCO)
    return { campo, avaliado };
  return {
    campo: {
      ...campo,
      valoresSelecionaveis: campo.valoresSelecionaveis?.filter(
        (v) => v.codigo !== PROPRIO_CANDIDATO,
      ),
    },
    avaliado: avaliado.opcoes
      ? {
          ...avaliado,
          opcoes: {
            ...avaliado.opcoes,
            codigos: avaliado.opcoes.codigos?.filter((c) => c !== PROPRIO_CANDIDATO),
          },
        }
      : avaliado,
  };
}
