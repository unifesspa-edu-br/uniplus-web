import { Injectable, Injector, afterNextRender, inject, signal } from '@angular/core';

/**
 * O que o leitor de tela ouve na região viva da inscrição: o resultado de salvar e enviar, a recusa e
 * o aviso de que a 2ª opção foi limpa. Provido pela página, porque a região é uma só.
 */
@Injectable()
export class AnuncioDaInscricao {
  private readonly injector = inject(Injector);

  private readonly texto = signal('');
  readonly aviso = this.texto.asReadonly();

  /** Troca o texto da região viva. */
  definir(mensagem: string): void {
    this.texto.set(mensagem);
  }

  /** Repete o aviso para o leitor de tela mesmo quando o texto é o mesmo da tentativa anterior. */
  repetir(mensagem: string): void {
    this.texto.set('');
    afterNextRender(() => this.texto.set(mensagem), { injector: this.injector });
  }
}
