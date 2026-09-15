import { Injectable, Signal, signal } from '@angular/core';

/**
 * Registro do contêiner de rolagem principal de uma rota.
 *
 * O padrão do shell é `main.page` (PR #671). Uma rota cujo conteúdo rola num
 * contêiner interno — como `.wiz-content` no editor de Processo Seletivo —
 * registra-o aqui pela diretiva `uiBackToTopContainer`; enquanto essa diretiva
 * está montada, o `ui-back-to-top` do shell observa o contêiner registrado no
 * lugar de `main.page`. Ao ser destruída, o botão volta ao contêiner padrão.
 *
 * A pilha cobre registros aninhados: vence sempre o mais recente, e remover um
 * intermediário não desfaz os demais. A publicação do valor é adiada para um
 * microtask porque `registrar`/`remover` são chamados de `constructor` e
 * `DestroyRef.onDestroy` de diretivas — dentro do ciclo de detecção de
 * mudanças, onde gravar um signal dispara `ExpressionChangedAfterItHasBeenChecked`.
 */
@Injectable({ providedIn: 'root' })
export class BackToTopScrollService {
  private readonly pilha: HTMLElement[] = [];
  private readonly principal = signal<HTMLElement | null>(null);

  /** O contêiner registrado mais recentemente, ou `null` se nenhum. */
  readonly containerPrincipal: Signal<HTMLElement | null> = this.principal.asReadonly();

  registrar(elemento: HTMLElement): void {
    this.pilha.push(elemento);
    this.sincronizar();
  }

  remover(elemento: HTMLElement): void {
    const indice = this.pilha.lastIndexOf(elemento);
    if (indice !== -1) this.pilha.splice(indice, 1);
    this.sincronizar();
  }

  private sincronizar(): void {
    queueMicrotask(() => this.principal.set(this.pilha.at(-1) ?? null));
  }
}
