/**
 * O nome que o leitor de tela diz para o botão "Ir ao campo" de uma causa: começa pelo texto que
 * aparece no botão, traz a posição da causa na lista, para duas causas iguais não terem o mesmo
 * nome, e a mensagem dela, que diz a que campo o botão leva. Nunca traz o código técnico.
 */
export function nomeDoIrAoCampo(posicao: number, mensagem: string): string {
  return `Ir ao campo da causa ${posicao}: ${mensagem}`;
}
