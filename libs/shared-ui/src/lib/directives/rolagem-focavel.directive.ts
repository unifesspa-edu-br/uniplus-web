import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';

/**
 * Deixa a caixa que rola alcançável pelo teclado, e só enquanto ela rola (WCAG 2.1.1): sem
 * foco, quem não usa mouse não tem como ver o que ficou fora da caixa. Parada de tabulação
 * numa caixa que cabe inteira seria um passo a mais sem ação nenhuma.
 *
 * A região leva o nome do texto indicado, que diz o que há dentro dela. A medida é refeita
 * quando a caixa ou o conteúdo dela mudam de tamanho, e a cada redimensionamento da janela.
 *
 * ```html
 * <p id="legenda">…</p>
 * <div class="table-responsive" uiRolagemFocavel="legenda"><table>…</table></div>
 * ```
 */
@Directive({
  selector: '[uiRolagemFocavel]',
  standalone: true,
  host: {
    '[attr.tabindex]': 'rola() ? 0 : null',
    '[attr.role]': "rola() ? 'region' : null",
    '[attr.aria-labelledby]': 'rola() ? uiRolagemFocavel() : null',
  },
})
export class RolagemFocavelDirective {
  /** `id` do texto que nomeia a região. */
  readonly uiRolagemFocavel = input.required<string>();

  protected readonly rola = signal(false);

  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      this.medir();

      const remedir = (): void => this.medir();
      window.addEventListener('resize', remedir);
      destroyRef.onDestroy(() => window.removeEventListener('resize', remedir));

      if (typeof ResizeObserver === 'undefined') return;
      const observador = new ResizeObserver(remedir);
      observador.observe(this.elemento);
      for (const filho of Array.from(this.elemento.children)) {
        observador.observe(filho);
      }
      destroyRef.onDestroy(() => observador.disconnect());
    });
  }

  private medir(): void {
    const { scrollWidth, clientWidth, scrollHeight, clientHeight } = this.elemento;
    this.rola.set(scrollWidth > clientWidth || scrollHeight > clientHeight);
  }
}
