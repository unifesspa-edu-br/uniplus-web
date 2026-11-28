import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { RecusaDoCampoComponent } from '@uniplus/shared-ui/components';

import { type CampoDaIdentificacao, idDaRecusaDoCampo } from './recusas-da-criacao';
import { GravacaoDaIdentificacao } from './servicos/gravacao-da-identificacao.service';

/**
 * A recusa de um campo do passo, junto dele: a do servidor com código e link da página, a da
 * conferência local só como texto. O elemento fica na tela mesmo sem recusa, para que a
 * região de alerta já esteja montada quando a mensagem entrar e o leitor de tela a anuncie (WCAG 4.1.3).
 * O campo a referencia por `aria-describedby`, com o id de `idDaRecusaDoCampo`.
 */
@Component({
  selector: 'sel-erro-do-campo',
  imports: [RecusaDoCampoComponent],
  template: `@if (erro(); as erro) {
    <ui-recusa-do-campo [recusas]="erro.recusas" />
    @if (erro.local; as texto) {
      <p class="field__error">{{ texto }}</p>
    }
  }`,
  host: { role: 'alert', 'aria-atomic': 'true', '[id]': 'id()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class ErroDoCampoComponent {
  private readonly gravacao = inject(GravacaoDaIdentificacao);

  readonly campo = input.required<CampoDaIdentificacao>();

  protected readonly id = computed(() => idDaRecusaDoCampo(this.campo()));
  protected readonly erro = computed(() => this.gravacao.erroDoCampo(this.campo()));
}
