import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'cfg-termo-consentimento-remocao',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
  template: `
    <dialog
      #dialog
      class="uni-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="termo-remocao-titulo"
      aria-describedby="termo-remocao-mensagem"
      (cancel)="cancelar($event)"
      (close)="fechado()"
    >
      <div class="uni-dialog__panel">
        <div class="uni-dialog__header">
          <h3 id="termo-remocao-titulo" class="uni-dialog__title">
            Remover termo de consentimento
          </h3>
          <button
            #fechar
            type="button"
            class="btn btn--tertiary btn--icon-only btn--rect"
            data-testid="confirm-dialog-close"
            aria-label="Fechar"
            [attr.aria-disabled]="processando()"
            (click)="cancelar()"
          >
            &times;
          </button>
        </div>
        <div class="uni-dialog__body">
          <p id="termo-remocao-mensagem">
            Remover o termo {{ nome() }}? Essa ação não pode ser desfeita.
          </p>
          <p role="status">
            {{ erro() || (processando() ? 'Removendo o termo ' + nome() + '.' : '') }}
          </p>
          @if (processando()) {
            <span aria-hidden="true">Removendo...</span>
          }
        </div>
        <div class="uni-dialog__footer">
          <button
            type="button"
            class="btn btn--tertiary"
            data-testid="confirm-dialog-cancel"
            [attr.aria-disabled]="processando()"
            (click)="cancelar()"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn--danger"
            data-testid="confirm-dialog-confirm"
            data-variant="danger"
            [attr.aria-disabled]="processando()"
            [attr.aria-busy]="processando()"
            (click)="confirmar()"
          >
            Remover
          </button>
        </div>
      </div>
    </dialog>
  `,
})
export class TermoConsentimentoRemocaoComponent {
  readonly aberto = model(false);
  readonly nome = input.required<string>();
  readonly processando = input.required<boolean>();
  readonly erro = input<string | null>(null);
  readonly confirmado = output<void>();
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly fechar = viewChild<ElementRef<HTMLButtonElement>>('fechar');
  private focoAnterior: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.aberto() && !dialog.open) {
        this.focoAnterior =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        queueMicrotask(() => this.fechar()?.nativeElement.focus());
      } else if (!this.aberto() && dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else {
          dialog.removeAttribute('open');
          this.fechado();
        }
      }
    });
  }
  protected cancelar(evento?: Event): void {
    evento?.preventDefault();
    if (!this.processando()) this.aberto.set(false);
  }
  protected confirmar(): void {
    if (!this.processando()) this.confirmado.emit();
  }
  protected fechado(): void {
    if (this.dialog()?.nativeElement.open) return;
    this.aberto.set(false);
    this.focoAnterior?.focus();
    this.focoAnterior = null;
  }
}
