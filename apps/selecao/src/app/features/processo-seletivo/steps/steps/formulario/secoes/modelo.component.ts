import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import type { AbaDoFormulario } from '../abas-do-formulario';
import { AplicacaoDeModeloService } from '../servicos/aplicacao-de-modelo.service';

/**
 * Partir de um modelo da Configuração: a escolha do modelo da aba e o pedido de aplicação, com a
 * origem, a recusa e o resumo da última aplicação. Aplicar substitui o formulário inteiro.
 */
@Component({
  selector: 'sel-modelo-do-formulario',
  templateUrl: './modelo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class ModeloDoFormularioComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly aplicacao = inject(AplicacaoDeModeloService);

  readonly aba = input.required<AbaDoFormulario>();
  /** A recusa do pedido de aplicação, para o leitor de tela ouvir. */
  readonly anunciou = output<string>();

  protected pedir(): void {
    const recusa = this.aplicacao.pedir(this.aba().finalidade);
    if (recusa !== null) this.anunciou.emit(recusa);
  }
}
