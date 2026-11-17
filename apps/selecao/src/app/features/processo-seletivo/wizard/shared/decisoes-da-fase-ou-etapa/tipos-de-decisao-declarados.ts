import { TIPOS_DE_DECISAO, type TipoDeDecisao } from '@uniplus/shared-data/selecao';

/**
 * Os tipos que a tela oferece: o vocabulário inteiro, mais o código já declarado que ele não
 * conhece, para a pessoa poder vê-lo e retirá-lo. O código desconhecido aparece com ele mesmo
 * como rótulo.
 */
export function tiposOferecidos(declarados: readonly string[]): readonly TipoDeDecisao[] {
  const conhecidos = new Set(TIPOS_DE_DECISAO.map((tipo) => tipo.codigo));
  const desconhecidos = [...new Set(declarados)].filter((codigo) => !conhecidos.has(codigo));
  return [...TIPOS_DE_DECISAO, ...desconhecidos.map((codigo) => ({ codigo, rotulo: codigo }))];
}

/** Os tipos declarados com o código acrescentado, sem repetição e em ordem alfabética do código. */
export function comTipoDeclarado(declarados: readonly string[], codigo: string): readonly string[] {
  return emOrdemAlfabetica([...declarados, codigo]);
}

/** Os tipos declarados sem o código, sem repetição e em ordem alfabética do código. */
export function semTipoDeclarado(declarados: readonly string[], codigo: string): readonly string[] {
  return emOrdemAlfabetica(declarados.filter((declarado) => declarado !== codigo));
}

/**
 * Cópia dos códigos, sem repetição, na ordem em que o servidor guarda e devolve os tipos; igual a
 * ela, o rascunho não muda sem alteração real. O código que o vocabulário não conhece segue na lista.
 */
export function emOrdemAlfabetica(codigos: readonly string[]): readonly string[] {
  return [...new Set(codigos)].sort();
}
