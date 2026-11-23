import { Injectable, signal } from '@angular/core';
import type { UiShellBreadcrumbItem } from '@uniplus/shared-ui/shell';

/**
 * Trilha que uma página contextual dá ao shell quando o nome de um item da trilha vem da API.
 * Ausente (`null`), o shell usa a trilha declarada na rota. A página a limpa ao sair.
 */
@Injectable({ providedIn: 'root' })
export class TrilhaContextual {
  private readonly _itens = signal<readonly UiShellBreadcrumbItem[] | null>(null);
  readonly itens = this._itens.asReadonly();

  definir(itens: readonly UiShellBreadcrumbItem[]): void {
    this._itens.set(itens);
  }

  limpar(): void {
    this._itens.set(null);
  }
}
