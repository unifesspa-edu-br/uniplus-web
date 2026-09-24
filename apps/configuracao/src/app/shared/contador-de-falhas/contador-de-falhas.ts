import { Signal, signal } from '@angular/core';

/** Falhas seguidas de uma carga, para o alerta anunciar de novo uma falha repetida. */
export interface ContadorDeFalhas {
  /** 1 na falha que abre o alerta, mais uma a cada nova tentativa do operador que falha
   *  com o alerta ainda na tela; 0 depois de uma carga que deu certo. */
  readonly valor: Signal<number>;
  /** `repetida`: a tentativa foi pedida pelo operador com a falha anterior na tela. Uma
   *  falha que não é repetida (recarga automática) recomeça em 1. */
  registrarFalha(repetida: boolean): void;
  registrarSucesso(): void;
}

export function contadorDeFalhas(): ContadorDeFalhas {
  const valor = signal(0);
  return {
    valor: valor.asReadonly(),
    registrarFalha: (repetida) => valor.update((n) => (repetida ? n + 1 : 1)),
    registrarSucesso: () => valor.set(0),
  };
}
