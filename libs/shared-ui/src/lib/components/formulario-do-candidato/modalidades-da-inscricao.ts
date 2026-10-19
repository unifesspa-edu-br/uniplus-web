import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { AlertComponent } from '../alert/alert';
import {
  type AvaliacaoNaTela,
  CONCORRE,
  FALTA_RESPONDER,
  NAO_CONCORRE,
  type ModalidadesAvaliadas,
  nomesNaOrdem,
  type PendenciaDaAvaliacao,
  type SecaoQueDefineAsModalidades,
} from './modalidades-avaliadas';

interface BlocoDeOpcao {
  readonly chave: 'unica' | 'primeira' | 'segunda';
  readonly titulo: string | null;
  readonly situacao: string | null;
  readonly nomes: readonly string[];
  readonly pendencias: readonly PendenciaDaAvaliacao[];
}

const tituloDaOpcao = (opcao: string, curso: string | null | undefined): string =>
  curso ? `${opcao} — ${curso}` : opcao;

function blocoDe(
  chave: BlocoDeOpcao['chave'],
  titulo: string | null,
  modalidades: ModalidadesAvaliadas | null,
  pendenciasJaPedidas: ReadonlySet<string>,
): BlocoDeOpcao {
  return {
    chave,
    titulo,
    situacao: modalidades?.situacao ?? null,
    nomes: nomesNaOrdem(modalidades),
    pendencias: (modalidades?.pendencias ?? []).filter(
      (p) => !pendenciasJaPedidas.has(p.fatoCodigo),
    ),
  };
}

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
    .modalidades-da-inscricao__opcao {
      display: grid;
      gap: var(--space-3);
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

      @for (bloco of blocos(); track bloco.chave) {
        <div class="modalidades-da-inscricao__opcao">
          @if (bloco.titulo; as titulo) {
            @if (resumo()) {
              <h5 class="modalidades-da-inscricao__titulo">{{ titulo }}</h5>
            } @else {
              <h4 class="modalidades-da-inscricao__titulo">{{ titulo }}</h4>
            }
          }
          @switch (bloco.situacao) {
            @case (CONCORRE) {
              <p>Com as respostas dadas até agora, você concorre em:</p>
              <ul
                class="modalidades-da-inscricao__lista"
                [attr.aria-label]="
                  bloco.titulo
                    ? 'Modalidades em que você concorre na ' + bloco.titulo
                    : 'Modalidades em que você concorre'
                "
              >
                @for (nome of bloco.nomes; track nome) {
                  <li>{{ nome }}</li>
                }
              </ul>
            }
            @case (NAO_CONCORRE) {
              @if (bloco.titulo) {
                <p>
                  Com as respostas dadas até aqui, você não concorre a nenhuma das modalidades
                  ofertadas nesta opção de curso, e a inscrição não poderá ser enviada assim.
                  Confira as respostas {{ secoes().length === 1 ? 'da seção' : 'das seções' }}
                  abaixo ou escolha outro curso.
                </p>
              } @else {
                <p>
                  Com as respostas dadas até aqui, você não concorre a nenhuma das modalidades
                  ofertadas neste processo seletivo, e a inscrição não poderá ser enviada assim.
                  Confira as respostas
                  {{ secoes().length === 1 ? 'da seção' : 'das seções' }} abaixo.
                </p>
              }
            }
            @case (FALTA_RESPONDER) {
              @if (bloco.chave === 'segunda' && bloco.pendencias.length === 0) {
                <p>Depende das mesmas respostas pedidas na 1ª opção.</p>
              } @else {
                <p>Para saber em quais modalidades você concorre, falta responder:</p>
                <ul class="modalidades-da-inscricao__atalhos">
                  @for (pendencia of bloco.pendencias; track pendencia.fatoCodigo) {
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
          }
        </div>
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

      @if (decidida()) {
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

  /**
   * Um bloco por opção de curso quando a avaliação traz as modalidades da 2ª; senão, um só, sem título.
   * A pendência que a 2ª opção repete da 1ª aparece uma vez, no bloco da 1ª.
   */
  protected readonly blocos = computed<readonly BlocoDeOpcao[]>(() => {
    const { modalidades, modalidadesSegundaOpcao, opcoesDeCurso } = this.avaliacao();
    if (!modalidadesSegundaOpcao) return [blocoDe('unica', null, modalidades, new Set())];
    const jaPedidas = new Set((modalidades?.pendencias ?? []).map((p) => p.fatoCodigo));
    return [
      blocoDe(
        'primeira',
        tituloDaOpcao('1ª opção', opcoesDeCurso?.primeira),
        modalidades,
        new Set(),
      ),
      blocoDe(
        'segunda',
        tituloDaOpcao('2ª opção', opcoesDeCurso?.segunda),
        modalidadesSegundaOpcao,
        jaPedidas,
      ),
    ];
  });
  /** Alguma opção tem as modalidades decididas: a lista é o que as respostas dão até agora. */
  protected readonly decidida = computed(() =>
    this.blocos().some((b) => b.situacao === CONCORRE || b.situacao === NAO_CONCORRE),
  );
  /** Sem nenhuma modalidade em alguma opção, o candidato precisa voltar às respostas; na Revisão, sempre pode. */
  protected readonly mostrarSecoes = computed(
    () =>
      this.secoes().length > 0 &&
      this.blocos().some(
        (b) => b.situacao === NAO_CONCORRE || (this.resumo() && b.situacao === CONCORRE),
      ),
  );
}
