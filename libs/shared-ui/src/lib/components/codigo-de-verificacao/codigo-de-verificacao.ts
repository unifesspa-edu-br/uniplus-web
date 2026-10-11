import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

/** O tamanho de cada grupo do código, separado só na tela. */
const TAMANHO_DO_GRUPO = 8;

/**
 * Um código de verificação longo, como o resumo de integridade de um comprovante. Na tela, ele sai em
 * grupos para ser lido e conferido; os grupos são só visuais: no texto o código é contínuo, então o
 * leitor de tela o lê inteiro e a seleção o copia sem espaços. "Copiar código" só aparece onde o
 * navegador permite escrever na área de transferência, e não sai no papel.
 */
@Component({
  selector: 'ui-codigo-de-verificacao',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'codigo-de-verificacao' },
  template: `
    <code class="codigo-de-verificacao__codigo">
      @for (grupo of grupos(); track $index) {
        <span class="codigo-de-verificacao__grupo">{{ grupo }}</span>
      }
    </code>
    @if (areaDeTransferencia) {
      <div class="codigo-de-verificacao__acoes u-no-print">
        <button type="button" class="btn btn--secondary btn--sm" (click)="copiar()">
          Copiar código
        </button>
        <span class="codigo-de-verificacao__aviso" role="status">{{ aviso() }}</span>
      </div>
    }
  `,
})
export class CodigoDeVerificacaoComponent {
  readonly codigo = input.required<string>();

  protected readonly areaDeTransferencia =
    inject(DOCUMENT).defaultView?.navigator.clipboard ?? null;
  protected readonly aviso = signal('');

  protected readonly grupos = computed(() => {
    const codigo = this.codigo();
    const grupos: string[] = [];
    for (let i = 0; i < codigo.length; i += TAMANHO_DO_GRUPO) {
      grupos.push(codigo.slice(i, i + TAMANHO_DO_GRUPO));
    }
    return grupos;
  });

  protected async copiar(): Promise<void> {
    if (!this.areaDeTransferencia) return;
    this.aviso.set('');
    try {
      await this.areaDeTransferencia.writeText(this.codigo());
      this.aviso.set('Código copiado.');
    } catch {
      this.aviso.set('Não foi possível copiar. Selecione o código e copie.');
    }
  }
}
