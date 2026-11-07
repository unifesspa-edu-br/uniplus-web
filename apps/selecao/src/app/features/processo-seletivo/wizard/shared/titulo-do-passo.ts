/**
 * O título do passo corrente do wizard, que recebe o foco quando uma leitura pedida de novo dá
 * certo: é o único destino que todo passo tem. Há um só, no cabeçalho do wizard, fora dos painéis
 * `[hidden]` que guardam os passos.
 */
export function tituloDoPasso(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.step-head h1');
}
