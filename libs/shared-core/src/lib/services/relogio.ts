import { InjectionToken } from '@angular/core';

/**
 * O relógio da aplicação: devolve o instante atual. Quem precisa da hora a injeta, em vez de chamar
 * `new Date()`, para o teste poder fixá-la e para as regras não lerem relógio por conta própria.
 */
export const RELOGIO = new InjectionToken<() => Date>('RELOGIO', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
