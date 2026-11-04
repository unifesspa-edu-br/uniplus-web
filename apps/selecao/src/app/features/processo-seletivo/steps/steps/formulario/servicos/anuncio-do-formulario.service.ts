import { Injectable, signal } from '@angular/core';

/** O que o leitor de tela ouve depois de acrescentar ou remover um formulário, ou de aplicar um modelo. */
@Injectable()
export class AnuncioDoFormularioService {
  readonly texto = signal('');

  anunciar(mensagem: string): void {
    this.texto.set(mensagem);
  }
}
