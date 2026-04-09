import { Component, ChangeDetectionStrategy, output, signal } from '@angular/core';

@Component({
  selector: 'poc-confirmacao-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button (click)="abrir()"
      class="inline-flex items-center justify-center px-govbr-5 py-govbr-2
             bg-govbr-primary text-govbr-pure-0 font-semibold text-govbr-base
             rounded-govbr-pill cursor-pointer
             hover:bg-govbr-primary-hover active:bg-govbr-primary-dark
             disabled:opacity-50 disabled:cursor-not-allowed
             transition-colors">
      Enviar Inscrição
    </button>

    @if (visivel()) {
      <!-- Overlay -->
      <div class="fixed inset-0 bg-govbr-pure-100/50 z-40"
           (click)="fechar()"
           role="presentation"></div>

      <!-- Modal -->
      <div role="dialog"
           aria-modal="true"
           aria-labelledby="dialog-title"
           class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                  w-full max-w-lg bg-govbr-pure-0 rounded-govbr p-govbr-6 shadow-xl">

        <h2 id="dialog-title"
          class="text-govbr-lg font-bold text-govbr-primary-dark mb-govbr-3">
          Confirmar inscrição
        </h2>

        <p class="text-govbr-base text-govbr-gray-60 mb-govbr-5">
          Tem certeza que deseja enviar sua inscrição? Após o envio, seus dados
          serão analisados pela comissão do processo seletivo.
        </p>

        <div class="flex justify-end gap-govbr-3">
          <button (click)="fechar()"
            class="px-govbr-4 py-govbr-2 border border-govbr-gray-20 rounded-govbr-pill
                   text-govbr-base font-medium text-govbr-gray-80
                   hover:bg-govbr-gray-2 transition-colors cursor-pointer">
            Cancelar
          </button>
          <button (click)="onConfirmar()" data-testid="btn-confirmar"
            class="px-govbr-4 py-govbr-2 bg-govbr-success text-govbr-pure-0
                   rounded-govbr-pill text-govbr-base font-semibold
                   hover:opacity-90 transition-colors cursor-pointer">
            Confirmar
          </button>
        </div>
      </div>
    }
  `,
})
export class ConfirmacaoDialogComponent {
  readonly confirmado = output<void>();
  readonly visivel = signal(false);

  abrir(): void {
    this.visivel.set(true);
  }

  fechar(): void {
    this.visivel.set(false);
  }

  onConfirmar(): void {
    this.confirmado.emit();
    this.fechar();
  }
}
