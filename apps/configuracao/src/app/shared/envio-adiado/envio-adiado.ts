import { Signal, computed, linkedSignal } from '@angular/core';

/** O aviso de que o envio pedido ainda não pôde sair, e o pedido que o originou. */
export interface EnvioAdiado {
  /** O texto do aviso; vazio quando não há envio à espera. Vai a uma região de status. */
  readonly mensagem: Signal<string>;
  /** Registra o pedido de envio; `true` quando ele deve esperar porque a leitura ainda corre. */
  adiarSePendente(): boolean;
}

/**
 * Faz o envio pedido durante uma leitura pendente dizer por que não saiu. O pedido vale só para a
 * leitura que corria quando foi feito: o aviso some quando ela termina e só volta a aparecer se a
 * pessoa pedir o envio de novo.
 */
export function adiarEnvioEnquantoPendente(
  pendente: Signal<boolean>,
  mensagem: string,
): EnvioAdiado {
  const pedido = linkedSignal({ source: pendente, computation: () => false });
  const adiarSePendente = (): boolean => {
    pedido.set(pendente());
    return pedido();
  };
  return { mensagem: computed(() => (pedido() && pendente() ? mensagem : '')), adiarSePendente };
}
