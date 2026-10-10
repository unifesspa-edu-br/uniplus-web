import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { type DadoRevelavel, textoMascarado } from '@uniplus/shared-utils';

let dadoRevelavelIdSeed = 0;

/**
 * Um dado sensível que abre mascarado e o titular revela para conferir. O botão tem nome fixo e
 * diz o estado por `aria-pressed`; a mudança é anunciada sem ler os dígitos. Volta a mascarar
 * quando o dado muda e sai sempre mascarado na impressão (`.u-no-print`/`.u-print-only`).
 *
 * Na aparência `campo`, é o `input` somente leitura de um formulário: o `id` liga o rótulo a ele.
 */
@Component({
  selector: 'ui-dado-revelavel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dado-revelavel' },
  template: `
    @if (aparencia() === 'campo') {
      <input
        class="input dado-revelavel__tela u-no-print"
        readonly
        [id]="idDoValor()"
        [value]="visivel() ? dado().revelado : mascarado()"
        [attr.aria-describedby]="descricaoDoCampo()"
      />
      @if (!visivel()) {
        <span class="sr-only" [id]="idDoValor() + '-leitura'">{{ leituraMascarada() }}</span>
      }
    } @else {
      <span class="dado-revelavel__tela u-no-print" [id]="idDoValor()">
        @if (visivel()) {
          {{ dado().revelado }}
        } @else {
          <span aria-hidden="true">
            @for (trecho of dado().mascarado; track $index) {
              <span [class.dado-revelavel__oculto]="trecho.oculto">{{ trecho.texto }}</span>
            }
          </span>
          <span class="sr-only">{{ leituraMascarada() }}</span>
        }
      </span>
    }
    <span class="dado-revelavel__papel u-print-only" aria-hidden="true">{{ mascarado() }}</span>
    @if (dado().revelado) {
      <button
        type="button"
        class="btn btn--tertiary btn--icon-only btn--rect u-no-print"
        [attr.aria-label]="'Mostrar ' + rotulo()"
        [attr.aria-pressed]="visivel()"
        [attr.aria-controls]="idDoValor()"
        (click)="alternar()"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          @if (visivel()) {
            <path
              d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24M1 1l22 22"
            />
          } @else {
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          }
        </svg>
      </button>
      <span class="sr-only" role="status">{{ anuncio() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .dado-revelavel__tela {
      overflow-wrap: anywhere;
    }
    input.dado-revelavel__tela {
      flex: 1;
      min-width: 0;
    }
    /* O asterisco fica no topo da linha na maioria das fontes; desce até a altura dos dígitos. */
    .dado-revelavel__oculto {
      display: inline-block;
      transform: translateY(0.3em);
    }
  `,
})
export class DadoRevelavelComponent {
  /** O nome do dado, como entra no botão e no anúncio: "CPF". */
  readonly rotulo = input.required<string>();
  readonly dado = input.required<DadoRevelavel>();
  readonly aparencia = input<'texto' | 'campo'>('texto');
  /** O id do valor; na aparência `campo`, é o do `input` que o rótulo cita. */
  readonly id = input<string | null>(null);
  /** As descrições que o campo já tem, como a ajuda e o erro. */
  readonly descritoPor = input<string | null>(null);

  private readonly idGerado = `ui-dado-revelavel-${++dadoRevelavelIdSeed}`;
  protected readonly idDoValor = computed(() => this.id() ?? this.idGerado);

  /** Revelado só depois do pedido, e de novo mascarado quando o dado muda. */
  protected readonly visivel = linkedSignal({
    source: () => this.dado().revelado,
    computation: () => false,
  });
  /** O anúncio só existe depois de um pedido: o dado recém-mostrado não é anunciado. */
  protected readonly anuncio = linkedSignal({
    source: () => this.dado().revelado,
    computation: () => '',
  });

  protected readonly mascarado = computed(() => textoMascarado(this.dado()));
  protected readonly leituraMascarada = computed(() => {
    const visivel = this.dado().visivel;
    return visivel ? `${this.rotulo()} parcialmente oculto: ${visivel}` : `${this.rotulo()} oculto`;
  });
  protected readonly descricaoDoCampo = computed(
    () =>
      [this.visivel() ? null : `${this.idDoValor()}-leitura`, this.descritoPor()]
        .filter((id) => id !== null)
        .join(' ') || null,
  );

  protected alternar(): void {
    const visivel = !this.visivel();
    this.visivel.set(visivel);
    this.anuncio.set(visivel ? `${this.rotulo()} visível` : `${this.rotulo()} oculto`);
  }
}
