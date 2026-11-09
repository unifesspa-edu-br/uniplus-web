import type { Signal } from '@angular/core';

/**
 * A leitura que a tela de perfis mostra e que cada escrita relê ao terminar: a lista de perfis ou o
 * perfil aberto. Quem escreve espera a releitura acabar antes de aceitar nova ação.
 */
export abstract class LeituraDosPerfis {
  abstract readonly carregando: Signal<boolean>;
  abstract readonly mensagemDeErro: Signal<string | null>;
  abstract recarregar(): void;
}
