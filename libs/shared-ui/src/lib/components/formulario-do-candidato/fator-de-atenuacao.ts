import type { NomesDeMunicipios } from '../editor-de-condicoes/valor-de-municipio';

import type {
  CampoRenderizavel,
  DependenciasDaAvaliacao,
  PassoDoFormulario,
} from './formulario-do-candidato.model';
import { titulosDasOcorrencias } from './interpretador/ocorrencia-do-candidato';
import type { OcorrenciaSimulada, ValorJson } from './interpretador/regras-do-formulario';
import { respostaExibida } from './resposta-exibida';

export interface LinhaDoFator {
  readonly rotulo: string;
  readonly valor: string;
}

/** O resumo do Fator na Revisão: o que foi respondido e a seção em que o candidato responde. */
export interface ResumoDoFator {
  readonly linhas: readonly LinhaDoFator[];
  readonly secao: { readonly chave: string; readonly titulo: string };
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
  respostas: Readonly<Record<string, ValorJson | undefined>>,
  municipios: NomesDeMunicipios,
  dependencias: DependenciasDaAvaliacao | null | undefined,
  ocorrencias: Readonly<Record<string, readonly OcorrenciaSimulada[]>> = {},
): ResumoDoFator | null {
  if (!dependencias || (dependencias.fatos.length === 0 && dependencias.grupos.length === 0))
    return null;
  const fatos = new Set(dependencias.fatos);
  const linhas: LinhaDoFator[] = [];
  let secao: ResumoDoFator['secao'] | null = null;
  for (const passo of passos) {
    const antes = linhas.length;
    for (const campo of passo.campos) {
      if (!fatos.has(campo.campo.fatoCodigo)) continue;
      const valor = textoDa(campo.campo, respostas[campo.campo.fatoCodigo], municipios);
      if (valor !== null) linhas.push({ rotulo: campo.campo.rotulo, valor });
    }
    for (const { grupo, avaliado } of passo.grupos) {
      const lista = ocorrencias[grupo.codigo] ?? [];
      const titulos = titulosDasOcorrencias(
        grupo.incluiCandidato,
        lista.map((o) => o.respostas),
      );
      for (const ocorrencia of avaliado.ocorrencias) {
        const indice = lista.findIndex((o) => o.id === ocorrencia.id);
        if (indice < 0) continue;
        for (const avaliadoDoSubitem of ocorrencia.campos) {
          if (avaliadoDoSubitem.visivel !== 'VERDADEIRO') continue;
          const subitem = grupo.subitens.find((s) => s.fatoCodigo === avaliadoDoSubitem.fatoCodigo);
          if (!subitem || !fatos.has(`${grupo.codigo}.${subitem.fatoCodigo}`)) continue;
          const valor = textoDa(subitem, lista[indice].respostas?.[subitem.fatoCodigo], municipios);
          if (valor !== null)
            linhas.push({
              rotulo: `${grupo.rotulo} (${titulos[indice]}): ${subitem.rotulo}`,
              valor,
            });
        }
      }
    }
    if (linhas.length > antes) secao ??= { chave: passo.chave, titulo: passo.titulo };
  }
  return secao ? { linhas, secao } : null;
}

function textoDa(
  campo: CampoRenderizavel,
  valor: ValorJson | undefined,
  municipios: NomesDeMunicipios,
): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  if (Array.isArray(valor) && valor.length === 0) return null;
  if (typeof valor === 'string' && campo.tipoRenderizacao === 'MUNICIPIO')
    return municipios.rotulo(valor);
  return respostaExibida(campo, valor);
}
