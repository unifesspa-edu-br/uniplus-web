/**
 * Compara conteúdo, não a ordem em que os campos foram escritos.
 *
 * A projeção da leitura e a do formulário montam os mesmos objetos em ordens
 * diferentes, e `JSON.stringify` preserva a ordem de inserção — comparar assim
 * daria "diferente" para dado igual. O efeito seria reconstruir os controles a
 * cada tecla, tirando o foco do campo em que se está digitando: um sintoma que
 * não se parece nem um pouco com a causa.
 */
export function mesmoConteudo(umLado: unknown, outroLado: unknown): boolean {
  return canonico(umLado) === canonico(outroLado);
}

function canonico(valor: unknown): string {
  return JSON.stringify(valor, (_chave, conteudo: unknown) =>
    conteudo !== null && typeof conteudo === 'object' && !Array.isArray(conteudo)
      ? Object.fromEntries(
          Object.entries(conteudo as Record<string, unknown>).sort(([um], [outro]) =>
            um.localeCompare(outro),
          ),
        )
      : conteudo,
  );
}
