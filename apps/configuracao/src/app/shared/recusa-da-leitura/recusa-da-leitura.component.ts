import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { tituloDaRecusa, type RecusaDaLeitura } from './recusa-da-leitura';

/**
 * A leitura que a API recusou em definitivo (sem credencial, sem permissão, não encontrado). Não
 * oferece nova tentativa: repeti-la devolveria a mesma resposta. O caminho de saída vem no
 * conteúdo projetado, porque só a tela sabe para onde a pessoa pode ir.
 */
@Component({
  selector: 'cfg-recusa-da-leitura',
  standalone: true,
  imports: [AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recusa(); as r) {
      <ui-alert variant="danger" [heading]="titulo()">
        {{ r.texto }}
        <ng-content />
      </ui-alert>
    }
  `,
})
export class RecusaDaLeituraComponent {
  readonly recusa = input.required<RecusaDaLeitura | null>();
  /** O título do 404, que nomeia o que não foi encontrado ("Pedido não encontrado"). */
  readonly naoEncontrado = input.required<string>();

  protected readonly titulo = computed(() => {
    const recusa = this.recusa();
    return recusa ? tituloDaRecusa(recusa.status, this.naoEncontrado()) : '';
  });
}
