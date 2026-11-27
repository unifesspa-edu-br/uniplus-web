import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DialogComponent } from '../dialog/dialog';

const SEGUNDOS_POR_MINUTO = 60;

/**
 * Diz o tempo que falta em minutos inteiros, para o leitor de tela não anunciar a cada segundo.
 * Arredonda para baixo: o texto nunca promete mais tempo do que resta.
 */
export function descreverTempoRestante(segundos: number): string {
  const minutos = Math.floor(segundos / SEGUNDOS_POR_MINUTO);
  if (minutos < 1) return 'menos de 1 minuto';
  return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
}

/**
 * O aviso de que a sessão vai acabar. Só apresenta: quem o usa decide o que cada ação faz. Não se fecha por Esc nem
 * fora dele, para não ser dispensado sem querer; a saída é o botão "Agora não", e o foco volta ao ponto
 * onde estava.
 */
@Component({
  selector: 'ui-aviso-de-sessao-perto-de-vencer',
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-dialog
      [visible]="aberto()"
      heading="Sua sessão está perto de acabar"
      describedBy="aviso-de-sessao-perto-de-vencer-texto"
      [dismissible]="false"
    >
      <div id="aviso-de-sessao-perto-de-vencer-texto">
        <p role="status">A sessão acaba em {{ tempoRestante() }}.</p>
        @if (podeContinuar()) {
          <p>Escolha continuar para manter o acesso.</p>
        } @else {
          <p>
            Não é possível estender o tempo. Grave o que você preencheu e entre de novo antes de a
            sessão acabar; o que não for gravado se perde.
          </p>
          <p id="aviso-de-sessao-perto-de-vencer-efeito">
            Entrar de novo encerra a sessão em todas as páginas do Uni+ abertas neste navegador,
            como Seleção, Ingresso e Portal, e o que não foi gravado nelas se perde. Depois de
            entrar, você volta a esta página.
          </p>
        }
      </div>
      <ng-container uiDialogFooter>
        <button type="button" class="btn btn--tertiary" (click)="dispensar.emit()">
          Agora não
        </button>
        @if (podeContinuar()) {
          <button #acaoPrincipal type="button" class="btn" (click)="continuar.emit()">
            Continuar
          </button>
        } @else {
          <button
            #acaoPrincipal
            type="button"
            class="btn"
            aria-describedby="aviso-de-sessao-perto-de-vencer-efeito"
            (click)="entrar.emit()"
          >
            Entrar de novo agora
          </button>
        }
      </ng-container>
    </ui-dialog>
  `,
})
export class AvisoDeSessaoPertoDeVencerComponent {
  readonly aberto = input.required<boolean>();
  readonly restanteEmSegundos = input.required<number>();
  /** Verdadeiro quando pedir mais tempo ainda pode adiantar; falso quando só resta entrar de novo. */
  readonly podeContinuar = input.required<boolean>();
  readonly continuar = output<void>();
  readonly entrar = output<void>();
  readonly dispensar = output<void>();

  protected readonly tempoRestante = computed(() =>
    descreverTempoRestante(this.restanteEmSegundos()),
  );
  private readonly injector = inject(Injector);
  private readonly acaoPrincipal = viewChild<ElementRef<HTMLButtonElement>>('acaoPrincipal');

  /** Refaz o foco também quando a ação principal muda, para não deixá-lo num botão que saiu da tela. */
  constructor() {
    effect(() => {
      this.podeContinuar();
      if (this.aberto()) this.focarDepoisDeRenderizar();
    });
  }

  private focarDepoisDeRenderizar(): void {
    afterNextRender(() => this.acaoPrincipal()?.nativeElement.focus(), { injector: this.injector });
  }
}
