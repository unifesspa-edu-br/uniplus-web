/** Uma edição do exame que a condição pode apontar. */
export interface OpcaoDeEdicaoDoExame {
  /** O ano como a condição o guarda. */
  readonly valor: number;
  readonly rotulo: string;
  /** Falso quando o processo já não declara a edição que a condição aponta. */
  readonly declarada: boolean;
}

function comoOpcao(
  ano: string,
  declarada: boolean,
  rotulo: (ano: string) => string,
): OpcaoDeEdicaoDoExame {
  return { valor: Number(ano), rotulo: rotulo(ano), declarada };
}

/**
 * As edições que a condição oferece: as declaradas pelo processo, na ordem declarada, e a edição
 * já escolhida que deixou de estar declarada, ao fim e marcada, para a pessoa vê-la e trocá-la em
 * vez de a lista omiti-la em silêncio. O ano que não é número não vira opção.
 */
export function opcoesDaEdicao(
  declaradas: readonly string[],
  escolhida: number | null,
  rotulo: (ano: string) => string,
): readonly OpcaoDeEdicaoDoExame[] {
  const opcoes = declaradas
    .map((ano) => comoOpcao(ano, true, rotulo))
    .filter((opcao) => Number.isInteger(opcao.valor));
  const jaOferecida = opcoes.some((opcao) => opcao.valor === escolhida);
  if (escolhida === null || jaOferecida) return opcoes;
  return [...opcoes, comoOpcao(String(escolhida), false, rotulo)];
}
