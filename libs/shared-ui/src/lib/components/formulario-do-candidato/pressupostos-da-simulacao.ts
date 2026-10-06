import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { CampoDoCandidatoComponent } from './campo-do-candidato';
import type { CampoNoPasso, PressupostoDoFormulario } from './formulario-do-candidato.model';
import type { ValorJson } from './interpretador/regras-do-formulario';

/** A forma do valor de um pressuposto sem apresentação, que quem simula escolhe. */
const FORMAS: readonly { readonly tipo: string; readonly rotulo: string }[] = [
  { tipo: 'TEXTO', rotulo: 'Texto ou código' },
  { tipo: 'NUMERO', rotulo: 'Número' },
  { tipo: 'BOOLEANO', rotulo: 'Sim ou não' },
  { tipo: 'SELECAO_MULTIPLA', rotulo: 'Lista de códigos' },
];

/**
 * Os pressupostos da simulação: os fatos que o formulário cita sem perguntar. O respondido em outro
 * formulário é informado com o campo de lá; o calculado pelo sistema, ou sem apresentação, com o valor
 * na forma que quem simula escolher — a simulação não calcula: informa o valor que o cálculo daria.
 */
@Component({
  selector: 'ui-pressupostos-da-simulacao',
  standalone: true,
  imports: [CampoDoCandidatoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pressupostos().length > 0) {
      <section class="pressupostos-simulacao" [attr.aria-labelledby]="idBase() + '-titulo'">
        <h2 class="pressupostos-simulacao__titulo" [id]="idBase() + '-titulo'">
          Respostas de fora deste formulário
        </h2>
        <p class="field__hint">
          O formulário depende destes fatos, respondidos em outro formulário ou calculados pelo
          sistema. Informe os valores para simular cada situação.
        </p>
        @for (item of itens(); track item.pressuposto.fatoCodigo) {
          <div class="pressupostos-simulacao__item">
            @if (item.semApresentacao) {
              <div class="field">
                <label
                  class="field__label"
                  [for]="idBase() + '-' + item.pressuposto.fatoCodigo + '-forma'"
                >
                  Forma do valor de {{ item.pressuposto.fatoCodigo }}
                </label>
                <select
                  class="select"
                  [id]="idBase() + '-' + item.pressuposto.fatoCodigo + '-forma'"
                  (change)="escolherForma(item.pressuposto.fatoCodigo, $event)"
                >
                  @for (forma of formas; track forma.tipo) {
                    <option
                      [value]="forma.tipo"
                      [selected]="forma.tipo === item.campo.campo.tipoRenderizacao"
                    >
                      {{ forma.rotulo }}
                    </option>
                  }
                </select>
              </div>
            }
            <ui-campo-do-candidato
              [noPasso]="item.campo"
              [id]="idBase() + '-' + item.pressuposto.fatoCodigo"
              [resposta]="valores()[item.pressuposto.fatoCodigo]"
              (respondida)="responder(item.pressuposto.fatoCodigo, $event)"
            />
            @if (item.pressuposto.calculadoDe?.length) {
              <p class="field__hint">
                Calculado pelo sistema a partir de {{ item.pressuposto.calculadoDe!.join(', ') }}.
              </p>
            }
          </div>
        }
      </section>
    }
  `,
})
export class PressupostosDaSimulacaoComponent {
  readonly pressupostos = input<readonly PressupostoDoFormulario[]>([]);
  readonly valores = input<Readonly<Record<string, ValorJson>>>({});
  readonly idBase = input<string>('pressupostos');

  readonly valoresChange = output<Readonly<Record<string, ValorJson>>>();

  protected readonly formas = FORMAS;
  /** A forma escolhida para cada pressuposto sem apresentação; texto, até se escolher outra. */
  private readonly formaEscolhida = signal<Readonly<Record<string, string>>>({});

  /** Cada pressuposto como um campo sempre visível e opcional, sem regra própria. */
  protected readonly itens = computed(() =>
    this.pressupostos().map((pressuposto) => {
      const semApresentacao = !pressuposto.tipoRenderizacao;
      const tipo =
        pressuposto.tipoRenderizacao ?? this.formaEscolhida()[pressuposto.fatoCodigo] ?? 'TEXTO';
      const campo: CampoNoPasso = {
        campo: {
          fatoCodigo: pressuposto.fatoCodigo,
          ordem: 0,
          rotulo: pressuposto.rotulo?.trim() || pressuposto.fatoCodigo,
          tipoRenderizacao: tipo,
          valoresSelecionaveis: pressuposto.valoresSelecionaveis ?? null,
          formato: pressuposto.formato ?? null,
        },
        avaliado: {
          fatoCodigo: pressuposto.fatoCodigo,
          etapaCodigo: '',
          estado: 'RESOLVIDO',
          visivel: 'VERDADEIRO',
          obrigatorio: 'FALSO',
          restricoesVioladas: [],
          impedido: 'FALSO',
          opcoes: null,
        },
        regra: null,
      };
      return { pressuposto, semApresentacao, campo };
    }),
  );

  protected escolherForma(fato: string, evento: Event): void {
    const tipo = (evento.target as HTMLSelectElement).value;
    this.formaEscolhida.update((atual) => ({ ...atual, [fato]: tipo }));
    this.responder(fato, undefined);
  }

  protected responder(fato: string, valor: ValorJson | undefined): void {
    const novos = { ...this.valores() };
    if (valor === undefined) delete novos[fato];
    else novos[fato] = valor;
    this.valoresChange.emit(novos);
  }
}
