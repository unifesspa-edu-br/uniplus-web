import { type TipoDeCampoDoVocabulario } from './tipos';

/** O texto que o vocabulário da API dá ao código do tipo de campo; o código que ele não traz volta como veio. */
export function rotuloDoTipoDeCampo(
  tipos: readonly TipoDeCampoDoVocabulario[],
  codigo: string,
): string {
  return tipos.find((tipo) => tipo.codigo === codigo)?.rotulo ?? codigo;
}
