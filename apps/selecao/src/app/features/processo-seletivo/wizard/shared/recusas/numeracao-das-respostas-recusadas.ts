import { Injectable } from '@angular/core';

/**
 * Numera, na ordem em que chegam, as respostas recusadas da gravação e da publicação. É da
 * página do assistente, e não de um passo, porque a página mantém todos os passos montados e a
 * ordem entre respostas vale para o assistente inteiro.
 */
@Injectable()
export class NumeracaoDasRespostasRecusadas {
  private ultima = 0;

  proxima(): number {
    this.ultima += 1;
    return this.ultima;
  }
}
