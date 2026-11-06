import type { AbstractControl } from '@angular/forms';
import type { EdicaoDoPedidoDeAcesso } from './edicao-do-pedido-de-acesso';

export type FormDoPedido = EdicaoDoPedidoDeAcesso['form'];

/** O erro do campo só aparece depois de a pessoa tocar nele ou alterá-lo. */
export function campoInvalido(controle: AbstractControl): boolean {
  return controle.invalid && (controle.touched || controle.dirty);
}

/** A recusa do servidor, quando houver; senão a mensagem do campo. */
export function mensagemDoCampo(controle: AbstractControl, padrao: string): string {
  return (controle.getError('backend') as { message: string } | null)?.message ?? padrao;
}
