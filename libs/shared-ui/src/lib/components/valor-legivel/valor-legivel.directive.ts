import {
  afterNextRender,
  DestroyRef,
  Directive,
  DoCheck,
  ElementRef,
  inject,
  Renderer2,
} from '@angular/core';

type Campo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Deixa o valor de um campo em edição legível inteiro (web#905, CA-04). Um `input` ou `select`
 * não quebra linha: o que passa da largura do campo fica cortado. Enquanto o valor não cabe, o
 * `title` repete o texto completo — no select, o rótulo da opção escolhida, não o `value`.
 *
 * O `title` só existe enquanto há corte: num campo que cabe, ele só faria o leitor de tela
 * repetir o valor como descrição. Um `title` que o template declara é respeitado.
 *
 * ```html
 * <input class="input" formControlName="nome" />
 * ```
 */
@Directive({
  selector: 'input.input:not([title]), select.input:not([title]), textarea.input:not([title])',
  standalone: true,
})
export class ValorLegivelDirective implements DoCheck {
  private readonly campo = inject<ElementRef<Campo>>(ElementRef).nativeElement;
  private readonly renderer = inject(Renderer2);

  private ultimoTexto: string | null = null;
  private ultimaLargura = -1;
  private pronto = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      this.pronto = true;
      this.atualizar();

      if (typeof ResizeObserver === 'undefined') return;
      const observador = new ResizeObserver(() => this.atualizar());
      observador.observe(this.campo);
      destroyRef.onDestroy(() => observador.disconnect());
    });
  }

  /** O valor muda por `patchValue` e por catálogo que chega, sem evento algum do campo. */
  ngDoCheck(): void {
    if (this.pronto) this.atualizar();
  }

  private atualizar(): void {
    const texto = this.textoDoValor();
    const largura = this.campo.clientWidth;
    if (texto === this.ultimoTexto && largura === this.ultimaLargura) return;
    this.ultimoTexto = texto;
    this.ultimaLargura = largura;

    const cortado = texto !== '' && this.campo.scrollWidth > this.campo.clientWidth;
    if (cortado) {
      this.renderer.setAttribute(this.campo, 'title', texto);
    } else {
      this.renderer.removeAttribute(this.campo, 'title');
    }
  }

  private textoDoValor(): string {
    if (this.campo instanceof HTMLSelectElement) {
      return (this.campo.selectedOptions[0]?.textContent ?? '').trim();
    }
    return this.campo.value;
  }
}
