import { ElementRef, Injector, Signal, afterNextRender, effect, inject } from '@angular/core';
import { focoEstaLivre } from '../../shared/foco';

export interface OpcoesDaDevolucaoDeFoco {
  /** Há escrita em curso, inclusive a espera pela recarga que a segue. */
  readonly gravando: Signal<boolean>;
  /** A lista está sendo lida. */
  readonly carregando: Signal<boolean>;
  /** `id` do título da lista (com `tabindex="-1"`), destino quando o acionador saiu da tela. */
  readonly idDoTitulo: string;
}

export interface DevolucaoDeFoco {
  /** Anota o seletor do acionador; vale até a próxima anotação. `null` leva ao título. */
  registrar(seletor: string | null): void;
}

/** O valor como literal entre aspas duplas de um seletor de atributo. */
export const entreAspas = (valor: string): string => valor.replace(/["\\]/g, '\\$&');

class DevolucaoDeFocoDaPagina implements DevolucaoDeFoco {
  private ultimo: string | null = null;
  private daGravacao: { readonly seletor: string | null } | undefined;

  constructor(
    private readonly raiz: HTMLElement,
    private readonly injector: Injector,
    private readonly opcoes: OpcoesDaDevolucaoDeFoco,
  ) {}

  registrar(seletor: string | null): void {
    this.ultimo = seletor;
  }

  /** Lê os sinais da página; roda dentro de um `effect`. */
  acompanhar(): void {
    if (this.opcoes.gravando()) {
      this.daGravacao = { seletor: this.ultimo };
      return;
    }
    if (this.opcoes.carregando() || this.daGravacao === undefined) return;
    const { seletor } = this.daGravacao;
    this.daGravacao = undefined;
    afterNextRender(() => this.devolver(seletor), { injector: this.injector });
  }

  private devolver(seletor: string | null): void {
    if (!focoEstaLivre()) return;
    const acionador = seletor === null ? null : this.raiz.querySelector<HTMLElement>(seletor);
    const titulo = this.raiz.querySelector<HTMLElement>(`#${this.opcoes.idDoTitulo}`);
    (acionador ?? titulo)?.focus();
  }
}

/**
 * Os botões da lista ficam indisponíveis enquanto ela é gravada e recarregada, e um botão
 * indisponível não recebe o foco que a sobreposição fechada tenta devolver. Terminadas a escrita e a
 * recarga, o foco volta ao acionador, se ele ainda existir e se ninguém tomou o foco nesse
 * intervalo; sem ele (item que saiu da lista, recarga que falhou), vai ao título da lista.
 *
 * Chamar em contexto de injeção, no componente da página.
 */
export function devolverFocoAoAcionador(opcoes: OpcoesDaDevolucaoDeFoco): DevolucaoDeFoco {
  const raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const devolucao = new DevolucaoDeFocoDaPagina(raiz, inject(Injector), opcoes);
  effect(() => devolucao.acompanhar());
  return devolucao;
}
