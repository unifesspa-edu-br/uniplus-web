import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { TermoDoPedidoDto } from '@uniplus/shared-data/autorizacao';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

/** O termo fixado no pedido e a evidência do aceite: quem aceitou, quando, a versão e o resumo. */
@Component({
  selector: 'cfg-evidencia-do-termo',
  standalone: true,
  imports: [DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './termo-de-responsabilidade.component.css',
  template: `
    <section class="panel" aria-labelledby="cfg-evidencia-do-termo">
      <div class="panel-head">
        <h2 id="cfg-evidencia-do-termo" class="panel-head__title">Termo de responsabilidade</h2>
      </div>
      <dl class="cfg-descricao panel-body">
        <dt>Versão fixada no pedido</dt>
        <dd>{{ termo().numero }}</dd>
        <dt>Resumo do texto (SHA-256)</dt>
        <dd>
          <code class="ui-code cfg-termo__resumo">{{ termo().resumo }}</code>
        </dd>
        <dt>Aceite</dt>
        @if (termo().aceite; as aceite) {
          <dd>
            Aceito por {{ aceite.pessoa.nome ?? 'pessoa não identificada' }} em
            {{ aceite.aceitoEm | dateBr: 'datetime' }}, versão {{ aceite.numero }}, resumo
            <code class="ui-code cfg-termo__resumo">{{ aceite.resumo }}</code>
          </dd>
        } @else {
          <dd>Aguarda o aceite do beneficiário.</dd>
        }
      </dl>
    </section>
  `,
})
export class EvidenciaDoTermoComponent {
  readonly termo = input.required<TermoDoPedidoDto>();
}
