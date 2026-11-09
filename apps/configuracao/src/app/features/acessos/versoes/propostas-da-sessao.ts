import { Injectable, signal } from '@angular/core';

/**
 * As versões que esta sessão propôs. A fila não recebe de quem é a proposta, então a tela não
 * oferece aprovar a que a própria pessoa acabou de criar; a API recusa as demais.
 */
@Injectable({ providedIn: 'root' })
export class PropostasDaSessao {
  private readonly ids = signal<ReadonlySet<string>>(new Set());

  registrar(versaoId: string): void {
    this.ids.update((atuais) => new Set(atuais).add(versaoId));
  }

  propos(versaoId: string): boolean {
    return this.ids().has(versaoId);
  }
}
