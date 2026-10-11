import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { AlertComponent } from '../alert/alert';
import {
  type AvaliacaoNaTela,
  CONCORRE,
  FALTA_RESPONDER,
  NAO_CONCORRE,
  nomesNaOrdem,
  type SecaoQueDefineAsModalidades,
} from './modalidades-avaliadas';

/**
 * As modalidades em que o candidato concorre com as respostas dadas até agora, como a API as calcula
 * (ADR-0143). Mostra a lista, ou o que falta responder para saber, ou que nenhuma se aplica — e, nos
 * dois últimos casos, leva às perguntas que decidem. Na Revisão, o resumo leva às seções que as definem.
 */
@Component({
  selector: 'ui-modalidades-da-inscricao',
  standalone: true,
  imports: [AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.aria-busy]': 'avaliacao().calculando' },
  styles: `
    .modalidades-da-inscricao {
      display: grid;
      gap: var(--space-3);
      max-width: 68ch;
    }
    .modalidades-da-inscricao p,
    .modalidades-da-inscricao ul {
      margin: 0;
    }
    .modalidades-da-inscricao__lista {
      display: grid;
      gap: var(--space-1);
      padding-inline-start: var(--space-5);
    }
    .modalidades-da-inscricao__atalhos {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      padding: 0;
      list-style: none;
    }
    .modalidades-da-inscricao__titulo {
      margin: 0;
      font-size: var(--text-base);
      font-weight: var(--weight-semibold);
    }
  `,
  template: `
    <div class="modalidades-da-inscricao">
      @if (resumo()) {
        <h4 class="modalidades-da-inscricao__titulo">Modalidades de concorrência</h4>
      }

      @switch (situacao()) {
        @case (CONCORRE) {
          <p>Com as respostas dadas até agora, você concorre em:</p>
          <ul class="modalidades-da-inscricao__lista">
            @for (nome of nomes(); track nome) {
              <li>{{ nome }}</li>
            }
          </ul>
        }
        @case (NAO_CONCORRE) {
          <p>
            Com as respostas dadas até aqui, você não concorre a nenhuma das modalidades ofertadas
            neste processo seletivo, e a inscrição não poderá ser enviada assim. Confira as
            respostas
            {{ secoes().length === 1 ? 'da seção' : 'das seções' }} abaixo.
          </p>
        }
        @case (FALTA_RESPONDER) {
          <p>Para saber em quais modalidades você concorre, falta responder:</p>
          <ul class="modalidades-da-inscricao__atalhos">
            @for (pendencia of pendencias(); track pendencia.fatoCodigo) {
              <li>
                <button
                  type="button"
                  class="btn btn--tertiary btn--sm"
                  (click)="irAoCampo.emit(pendencia.fatoCodigo)"
                >
                  {{ pendencia.rotulo }}
                </button>
              </li>
            }
          </ul>
        }
      }

      @if (mostrarSecoes()) {
        <ul
          class="modalidades-da-inscricao__atalhos"
          aria-label="Seções que definem as modalidades"
        >
          @for (secao of secoes(); track secao.chave) {
            <li>
              <button
                type="button"
                class="btn btn--tertiary btn--sm"
                (click)="irASecao.emit(secao.chave)"
              >
                Conferir {{ secao.titulo }}
              </button>
            </li>
          }
        </ul>
      }

      @if (avaliacao().erro; as erro) {
        <ui-alert variant="warning" [dynamic]="false">
          {{ erro }}
          <p>
            <button type="button" class="btn btn--secondary btn--sm" (click)="tentarDeNovo.emit()">
              Tentar de novo
            </button>
          </p>
        </ui-alert>
      }

      @if (situacao() === CONCORRE || situacao() === NAO_CONCORRE) {
        <p class="field__hint">
          A lista mostra o que as respostas dão até agora. O envio da inscrição confirma as
          modalidades.
        </p>
      }
    </div>
  `,
})
export class ModalidadesDaInscricaoComponent {
  readonly avaliacao = input.required<AvaliacaoNaTela>();
  /** As seções com respostas de que as modalidades dependem, para o candidato conferi-las. */
  readonly secoes = input<readonly SecaoQueDefineAsModalidades[]>([]);
  /** Na Revisão: um resumo com título próprio e o caminho de volta às seções. */
  readonly resumo = input(false);

  /** O candidato escolheu a pergunta pendente: leva a ela. */
  readonly irAoCampo = output<string>();
  /** O candidato quer conferir uma seção: leva a ela. */
  readonly irASecao = output<string>();
  readonly tentarDeNovo = output<void>();

  protected readonly CONCORRE = CONCORRE;
  protected readonly NAO_CONCORRE = NAO_CONCORRE;
  protected readonly FALTA_RESPONDER = FALTA_RESPONDER;

  protected readonly situacao = computed(() => this.avaliacao().modalidades?.situacao ?? null);
  protected readonly nomes = computed(() => nomesNaOrdem(this.avaliacao().modalidades));
  protected readonly pendencias = computed(() => this.avaliacao().modalidades?.pendencias ?? []);
  /** Sem nenhuma modalidade, o candidato precisa voltar às respostas; na Revisão, sempre pode. */
  protected readonly mostrarSecoes = computed(
    () =>
      this.secoes().length > 0 &&
      (this.situacao() === NAO_CONCORRE || (this.resumo() && this.situacao() === CONCORRE)),
  );
}
