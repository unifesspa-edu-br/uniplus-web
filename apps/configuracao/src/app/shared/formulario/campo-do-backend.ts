/**
 * Resolve o `field` de um erro de validação da API para o nome do FormControl
 * correspondente.
 *
 * O servidor nomeia o campo em PascalCase e pode qualificá-lo pelo caminho no
 * comando (`Endereco.Cep`, `Itens[2].Codigo`); o formulário nomeia em camelCase
 * e sem caminho. Campo fora do conjunto declarado devolve `null`, e cabe a quem
 * chama apresentar o erro de forma geral em vez de marcar o controle errado.
 */
export function controlNameFromBackendField<TControlName extends string>(
  field: string,
  controlNames: ReadonlySet<string>,
): TControlName | null {
  const ultimoSegmento =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = ultimoSegmento.charAt(0).toLocaleLowerCase('pt-BR') + ultimoSegmento.slice(1);

  return controlNames.has(camelCase) ? (camelCase as TControlName) : null;
}

/** Converte campo de texto opcional deixado em branco na ausência que a API espera. */
export function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
