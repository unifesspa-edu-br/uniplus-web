import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';

const ID_DA_CONFIRMACAO = 'cfg-exclusao-confirmacao';

/**
 * Confirmação de que recusar, ou encerrar a janela, revoga o acesso. O botão só segue adiante com
 * a caixa marcada; quem hospeda faz a chamada e informa `erro` e `enviando`.
 */
@Component({
  selector: 'cfg-exclusao-dialog',
  standalone: true,
  imports: [AlertComponent, DialogComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../../shared/sobreposicao/sobreposicao.css',
  template: `
    <ui-dialog [(visible)]="visible" [heading]="heading()" [dismissible]="!enviando()">
      @if (erro()) {
        <ui-alert variant="danger" heading="Não foi possível concluir">{{ erro() }}</ui-alert>
      }
      <ui-alert variant="warning" heading="O acesso será revogado" [dynamic]="false">
        <ng-content />
      </ui-alert>
      <label class="checkbox" [class.is-error]="tentou() && !marcada()">
        <input
          type="checkbox"
          [id]="idDaConfirmacao"
          [checked]="marcada()"
          [disabled]="enviando()"
          [attr.aria-invalid]="tentou() && !marcada() ? 'true' : null"
          [attr.aria-describedby]="tentou() && !marcada() ? idDoErro : null"
          (change)="marcada.set(!marcada())"
        />
        <span class="checkbox__box" aria-hidden="true"></span>
        <span>{{ confirmacao() }}</span>
      </label>
      @if (tentou() && !marcada()) {
        <span class="field__error" [id]="idDoErro">Marque a caixa para confirmar.</span>
      }
      <p role="status" class="sr-only">{{ enviando() ? 'Enviando decisão…' : '' }}</p>
      <ng-container uiDialogFooter>
        <button
          type="button"
          class="btn btn--tertiary btn--rect"
          [disabled]="enviando()"
          (click)="visible.set(false)"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn--danger"
          [attr.aria-disabled]="enviando() ? 'true' : null"
          [attr.aria-busy]="enviando() ? 'true' : null"
          (click)="confirmar($event)"
        >
          @if (enviando()) {
            <ui-spinner spinnerSize="sm" />
          }
          {{ confirmLabel() }}
        </button>
      </ng-container>
    </ui-dialog>
  `,
})
export class ExclusaoDialogComponent {
  readonly visible = model(false);
  readonly heading = input.required<string>();
  readonly confirmLabel = input.required<string>();
  /** A frase da caixa de confirmação, na primeira pessoa. */
  readonly confirmacao = input.required<string>();
  readonly erro = input<string | null>(null);
  readonly enviando = input(false);
  readonly confirmado = output<void>();

  protected readonly idDaConfirmacao = ID_DA_CONFIRMACAO;
  protected readonly idDoErro = `${ID_DA_CONFIRMACAO}-erro`;
  protected readonly marcada = signal(false);
  protected readonly tentou = signal(false);
  private readonly injector = inject(Injector);

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      untracked(() => {
        this.marcada.set(false);
        this.tentou.set(false);
      });
    });
  }

  protected confirmar(evento: Event): void {
    if (this.enviando()) {
      evento.preventDefault();
      return;
    }
    if (this.marcada()) {
      this.confirmado.emit();
      return;
    }
    this.tentou.set(true);
    afterNextRender(() => document.getElementById(ID_DA_CONFIRMACAO)?.focus(), {
      injector: this.injector,
    });
  }
}
