import type { NomesDeMunicipios } from '../editor-de-condicoes/valor-de-municipio';

import {
  type CampoRenderizavel,
  type DependenciasDaAvaliacao,
  type GrupoRenderizavel,
  type RespostaFixa,
} from './formulario-do-candidato.model';
import { type PassoDoFormulario } from './passos-do-formulario';
import { titulosDasOcorrencias } from './interpretador/ocorrencia-do-candidato';
import type {
  CampoAvaliado,
  OcorrenciaSimulada,
  ValorJson,
} from './interpretador/regras-do-formulario';
import { respostaExibida } from './resposta-exibida';
import {
  chaveDaResposta,
  rotuloGravadoDa,
  type MunicipiosGravados,
} from './valor-de-municipio-gravado';

export interface LinhaDoFator {
  readonly rotulo: string;
  readonly valor: string;
}

/** O resumo do Fator na Revisão: o que foi respondido e a seção em que o candidato responde. */
export interface ResumoDoFator {
  readonly linhas: readonly LinhaDoFator[];
  readonly secao: { readonly chave: string; readonly titulo: string };
}

/** O que o resumo do Fator lê do formulário. */
export interface EntradaDoResumoDoFator {
  readonly respostas: Readonly<Record<string, ValorJson | undefined>>;
  readonly municipios: NomesDeMunicipios;
  readonly gravados: MunicipiosGravados;
  readonly dependencias: DependenciasDaAvaliacao | null | undefined;
  readonly ocorrencias?: Readonly<Record<string, readonly OcorrenciaSimulada[]>>;
  readonly fixas?: Readonly<Partial<Record<string, RespostaFixa>>>;
}

/**
 * O que o candidato respondeu sobre o Fator, com os rótulos do formulário. Os campos são os que a API
 * publica em `dependenciasDoFator`, sem código algum aqui: os do candidato pelo fato e os de grupo por
 * `GRUPO.FATO`, uma linha por ocorrência respondida. Entram só os que a seção mostra com as respostas
 * dadas, na ordem do formulário: o que deixou de valer por uma resposta anterior não aparece.
 * Nulo sem dependências, ou sem nenhuma respondida.
 */
export function resumoDoFator(
  passos: readonly PassoDoFormulario[],
  entrada: EntradaDoResumoDoFator,
): ResumoDoFator | null {
  const { dependencias } = entrada;
  if (!dependencias || (dependencias.fatos.length === 0 && dependencias.grupos.length === 0))
    return null;
  const fatos = new Set(dependencias.fatos);
  const linhas: LinhaDoFator[] = [];
  let secao: ResumoDoFator['secao'] | null = null;
  for (const passo of passos) {
    const doPasso = [
      ...linhasDosCampos(passo, fatos, entrada),
      ...linhasDosGrupos(passo, fatos, entrada),
    ];
    linhas.push(...doPasso);
    if (doPasso.length > 0) secao ??= { chave: passo.chave, titulo: passo.titulo };
  }
  return secao ? { linhas, secao } : null;
}

function linhasDosCampos(
  passo: PassoDoFormulario,
  fatos: ReadonlySet<string>,
  entrada: EntradaDoResumoDoFator,
): LinhaDoFator[] {
  return passo.campos.flatMap(({ campo }) => {
    if (!fatos.has(campo.fatoCodigo)) return [];
    const fixa = entrada.fixas?.[campo.fatoCodigo];
    // A resposta fixa aparece como o campo a mostra (o CPF mascarado), nunca pelo valor.
    const valor = fixa
      ? fixa.exibicao || null
      : textoDa(
          campo,
          entrada.respostas[campo.fatoCodigo],
          chaveDaResposta(campo.fatoCodigo),
          entrada,
        );
    return valor === null ? [] : [{ rotulo: campo.rotulo, valor }];
  });
}

function linhasDosGrupos(
  passo: PassoDoFormulario,
  fatos: ReadonlySet<string>,
  entrada: EntradaDoResumoDoFator,
): LinhaDoFator[] {
  return passo.grupos.flatMap(({ grupo, avaliado }) => {
    const lista = entrada.ocorrencias?.[grupo.codigo] ?? [];
    const titulos = titulosDasOcorrencias(
      grupo.incluiCandidato,
      lista.map((o) => o.respostas),
    );
    return avaliado.ocorrencias.flatMap((ocorrencia) => {
      const indice = lista.findIndex((o) => o.id === ocorrencia.id);
      return indice < 0
        ? []
        : linhasDaOcorrencia(
            { grupo, ocorrencia, titulo: titulos[indice], resposta: lista[indice] },
            fatos,
            entrada,
          );
    });
  });
}

/** Uma ocorrência do grupo: o título dela e as respostas, para rotular cada linha. */
interface OcorrenciaDoFator {
  readonly grupo: GrupoRenderizavel;
  readonly ocorrencia: { readonly id: string; readonly campos: readonly CampoAvaliado[] };
  readonly titulo: string;
  readonly resposta: OcorrenciaSimulada;
}

function linhasDaOcorrencia(
  { grupo, ocorrencia, titulo, resposta }: OcorrenciaDoFator,
  fatos: ReadonlySet<string>,
  entrada: EntradaDoResumoDoFator,
): LinhaDoFator[] {
  const visiveis = new Set(
    ocorrencia.campos.filter((c) => c.visivel === 'VERDADEIRO').map((c) => c.fatoCodigo),
  );
  return [...grupo.subitens]
    .sort((a, b) => a.ordem - b.ordem)
    .filter((s) => visiveis.has(s.fatoCodigo) && fatos.has(`${grupo.codigo}.${s.fatoCodigo}`))
    .flatMap((subitem) => {
      const chave = chaveDaResposta(subitem.fatoCodigo, { grupo: grupo.codigo, id: ocorrencia.id });
      const valor = textoDa(subitem, resposta.respostas?.[subitem.fatoCodigo], chave, entrada);
      const rotulo = `${grupo.rotulo} (${titulo}): ${subitem.rotulo}`;
      return valor === null ? [] : [{ rotulo, valor }];
    });
}

function textoDa(
  campo: CampoRenderizavel,
  valor: ValorJson | undefined,
  chave: string,
  { municipios, gravados }: EntradaDoResumoDoFator,
): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  if (Array.isArray(valor) && valor.length === 0) return null;
  if (typeof valor === 'string' && campo.tipoRenderizacao === 'MUNICIPIO')
    return rotuloGravadoDa(gravados, chave, valor) ?? municipios.rotulo(valor);
  return respostaExibida(campo, valor);
}
