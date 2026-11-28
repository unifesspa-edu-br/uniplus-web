const CEP_SO_DIGITOS = /^\d{8}$/;
const CEP_COM_HIFEN = /^\d{5}-\d{3}$/;

/**
 * O CEP para leitura: "68900-000". O texto que não tem a forma de um CEP (oito dígitos, com ou sem
 * hífen) volta como chegou, sem máscara parcial.
 */
export function formatarCep(texto: string | null | undefined): string {
  if (texto === null || texto === undefined) return '';
  if (CEP_COM_HIFEN.test(texto)) return texto;
  return CEP_SO_DIGITOS.test(texto) ? `${texto.slice(0, 5)}-${texto.slice(5)}` : texto;
}
