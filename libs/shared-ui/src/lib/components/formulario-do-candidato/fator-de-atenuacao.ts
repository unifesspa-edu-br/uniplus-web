import type { NomesDeMunicipios } from '../editor-de-condicoes/valor-de-municipio';

import type {
  CampoNoPasso,
  DependenciasDaAvaliacao,
  PassoDoFormulario,
} from './formulario-do-candidato.model';
import type { ValorJson } from './interpretador/regras-do-formulario';

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
 * publica em `dependenciasDoFator`, sem código algum aqui. Entram só os que a seção mostra com as
 * respostas dadas, na ordem do formulário: o que deixou de valer por uma resposta anterior não aparece.
 * Nulo sem dependências, ou sem nenhuma respondida.
 */
export function resumoDoFator(
  passos: readonly PassoDoFormulario[],
  respostas: Readonly<Record<string, ValorJson | undefined>>,
  municipios: NomesDeMunicipios,
  dependencias: DependenciasDaAvaliacao | null | undefined,
): ResumoDoFator | null {
  if (!dependencias || dependencias.fatos.length === 0) return null;
  const fatos = new Set(dependencias.fatos);
  const linhas: LinhaDoFator[] = [];
  let secao: ResumoDoFator['secao'] | null = null;
  for (const passo of passos) {
    for (const campo of passo.campos) {
      if (!fatos.has(campo.campo.fatoCodigo)) continue;
      const valor = textoDa(campo, respostas[campo.campo.fatoCodigo], municipios);
      if (valor === null) continue;
      linhas.push({ rotulo: campo.campo.rotulo, valor });
      secao ??= { chave: passo.chave, titulo: passo.titulo };
    }
  }
  return secao ? { linhas, secao } : null;
}

function textoDa(
  campo: CampoNoPasso,
  valor: ValorJson | undefined,
  municipios: NomesDeMunicipios,
): string | null {
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor !== 'string' || valor === '') return null;
  if (campo.campo.tipoRenderizacao === 'MUNICIPIO') return municipios.rotulo(valor);
  const opcao = campo.campo.valoresSelecionaveis?.find((v) => v.codigo === valor);
  return opcao?.descricao?.trim() || valor;
}
