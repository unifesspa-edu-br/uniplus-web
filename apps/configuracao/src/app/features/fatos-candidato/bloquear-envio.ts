/** Enquanto há escrita em curso o botão de enviar segue na tela, indisponível: o clique não envia de novo. */
export function bloquearEnvio(evento: Event, bloqueado: boolean): void {
  if (bloqueado) evento.preventDefault();
}
