/**
 * A resposta de uma pergunta de sim ou não, como o comando de envio a exige. Quem ainda não
 * respondeu (`null`) não vira "não": o comando só é montado depois da resposta, e a tela confere
 * a pergunta em aberto antes de chegar aqui.
 */
export function respostaExigida(resposta: boolean | null, pergunta: string): boolean {
  if (resposta === null) {
    throw new Error(`O comando só é montado depois de responder ${pergunta}.`);
  }
  return resposta;
}
