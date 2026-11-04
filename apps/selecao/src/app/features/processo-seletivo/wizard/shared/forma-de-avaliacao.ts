export const FORMA_OBJETIVA = 'OBJETIVA';
export const FORMA_HUMANA = 'HUMANA';

/** As formas de avaliação do contrato (token fechado), com o texto que a tela mostra. */
export const FORMAS_DE_AVALIACAO: readonly { readonly valor: string; readonly rotulo: string }[] = [
  { valor: FORMA_OBJETIVA, rotulo: 'Objetiva — gabarito ou leitora' },
  { valor: FORMA_HUMANA, rotulo: 'Humana — banca' },
];

/** O texto da forma gravada, ou o próprio token quando o contrato acrescentar uma que a tela não conhece. */
export function rotuloDaFormaDeAvaliacao(forma: string): string {
  return FORMAS_DE_AVALIACAO.find((opcao) => opcao.valor === forma)?.rotulo ?? forma;
}
