import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { AvisoDaRevisao } from './publicacao-para-comando';

/**
 * Os avisos de conformidade da revisão do processo. Ficam à parte das pendências porque não
 * impedem a publicação: pedem que o administrador confirme que o edital é o que ele quer.
 * Sem aviso, não renderiza nada.
 */
@Component({
  selector: 'sel-avisos-da-revisao',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (avisos().length > 0) {
      <section class="step-section" aria-labelledby="revisao-avisos-titulo">
        <h2 id="revisao-avisos-titulo" class="step-section__title">Avisos para conferir</h2>

        <p class="alert alert--info" role="status">
          Estes avisos não impedem a publicação. Confira se cada um é o que o edital quer; se não
          for, ajuste no passo indicado.
        </p>

        <ul class="revisao-grupo__itens">
          @for (aviso of avisos(); track aviso.idDaMensagem) {
            <li class="revisao-item revisao-item--aviso">
              <span class="revisao-item__estado">Aviso</span>
              <div class="revisao-item__meta">
                <span class="revisao-item__name" [id]="aviso.idDaMensagem">{{
                  aviso.mensagem
                }}</span>
                <span class="revisao-item__onde">{{ aviso.rotuloDaDimensao }}</span>
              </div>
              @if (aviso.passo; as passo) {
                @if (navegavel()) {
                  <button
                    class="btn btn--sm btn--ghost revisao-item__ir"
                    type="button"
                    [attr.aria-describedby]="aviso.idDaMensagem"
                    (click)="irParaPasso.emit(passo.indice)"
                  >
                    Ir para {{ passo.nome }}
                  </button>
                }
              }
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class AvisosDaRevisaoComponent {
  readonly avisos = input.required<readonly AvisoDaRevisao[]>();
  /** Falso em consulta: o processo não se edita mais, e o atalho levaria a um passo sem o que fazer. */
  readonly navegavel = input(true);
  readonly irParaPasso = output<number>();
}
