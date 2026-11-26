import { signal, type Signal } from '@angular/core';

/** A opção apontada na lista e a navegação entre as opções alcançáveis. */
export class OpcaoDestacada {
  private readonly atual = signal<string | null>(null);
  readonly valor = this.atual.asReadonly();

  constructor(private readonly navegaveis: Signal<readonly string[]>) {}

  apontar(value: string): void {
    this.atual.set(value);
  }

  limpar(): void {
    this.atual.set(null);
  }

  andar(passo: number): void {
    const lista = this.navegaveis();
    if (lista.length === 0) return;
    const atual = lista.indexOf(this.valor() ?? '');
    const proximo =
      atual === -1
        ? passo > 0
          ? 0
          : lista.length - 1
        : (atual + passo + lista.length) % lista.length;
    this.apontar(lista[proximo]);
  }

  irAoInicio(): void {
    this.atual.set(this.navegaveis()[0] ?? null);
  }

  irAoFim(): void {
    const lista = this.navegaveis();
    this.atual.set(lista[lista.length - 1] ?? null);
  }
}
