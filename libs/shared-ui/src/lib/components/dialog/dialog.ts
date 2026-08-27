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

let dialogIdSeed = 0;

@Component({
  selector: 'ui-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="uni-dialog"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="headingId"
      (cancel)="close($event)"
      (close)="onNativeClose()"
    >
      <div class="uni-dialog__panel">
        <div class="uni-dialog__header">
          <h3 [id]="headingId" class="uni-dialog__title">{{ heading() }}</h3>
          <button
            #closeButton
            type="button"
            class="btn btn--tertiary btn--icon-only btn--rect"
            aria-label="Fechar"
            [disabled]="!dismissible()"
            (click)="close()"
          >
            &times;
          </button>
        </div>
        <div class="uni-dialog__body">
          <ng-content />
        </div>
        @if (hasFooter()) {
          <div class="uni-dialog__footer">
            <ng-content select="[uiDialogFooter]" />
          </div>
        }
      </div>
    </dialog>
  `,
})
export class DialogComponent {
  readonly visible = model<boolean>(false);
  readonly heading = input<string>('Janela');
  readonly hasFooter = input<boolean>(true);

  /**
   * Se o diálogo pode ser dispensado por quem o vê. `false` fecha os três
   * caminhos de saída — Esc, o botão de fechar e o clique fora — para as
   * situações em que sair não é uma opção real: uma operação irreversível já
   * em curso, por exemplo, em que o diálogo é a única coisa na tela dizendo
   * que ela está acontecendo. Quem o abre continua responsável por fechá-lo
   * pelo `visible`.
   */
  readonly dismissible = input<boolean>(true);
  readonly closed = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly closeButtonRef = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private lastFocusedElement: HTMLElement | null = null;
  protected readonly headingId = `ui-dialog-heading-${++dialogIdSeed}`;

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog) return;

      if (this.visible()) {
        this.openDialog(dialog);
      } else {
        this.closeDialog(dialog);
      }
    });
  }

  protected close(event?: Event): void {
    // `preventDefault` no `cancel` é o que impede o `<dialog>` de fechar
    // sozinho: sem isso o Esc fecharia no nível do elemento, antes de qualquer
    // decisão deste componente.
    event?.preventDefault();
    if (!this.dismissible()) return;
    this.visible.set(false);
  }

  protected onNativeClose(): void {
    if (this.visible()) {
      this.visible.set(false);
    }
    this.lastFocusedElement?.focus();
    this.lastFocusedElement = null;
    this.closed.emit();
  }

  private openDialog(dialog: HTMLDialogElement): void {
    if (dialog.open) return;
    this.lastFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    queueMicrotask(() => this.closeButtonRef()?.nativeElement.focus());
  }

  private closeDialog(dialog: HTMLDialogElement): void {
    if (!dialog.open) return;
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
      this.onNativeClose();
    }
  }
}
