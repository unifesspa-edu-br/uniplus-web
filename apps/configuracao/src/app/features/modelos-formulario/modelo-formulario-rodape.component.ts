import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SpinnerComponent, type ConteudoDoFormulario } from '@uniplus/shared-ui/components';
import type { ModeloFormularioEdicaoStore } from './modelo-formulario-edicao.store';

/** O atalho para simular o modelo gravado e o rodapé de salvar, que envia o formulário de identificação. */
@Component({
  selector: 'cfg-modelo-formulario-rodape',
  imports: [RouterLink, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modelo-formulario-rodape.component.html',
  host: { class: 'cfg-page' },
})
export class ModeloFormularioRodapeComponent {
  readonly modelo =
    input.required<NonNullable<ReturnType<ModeloFormularioEdicaoStore['modelo']>>>();
  readonly conteudo = input.required<ConteudoDoFormulario | null>();
  readonly salvando = input.required<boolean>();
  /** A gravação em curso e a espera pela recarga que a segue. */
  readonly somenteLeitura = input.required<boolean>();

  readonly conteudoAlterado = computed(
    () => JSON.stringify(this.conteudo()) !== JSON.stringify(this.modelo().conteudo ?? null),
  );
}
