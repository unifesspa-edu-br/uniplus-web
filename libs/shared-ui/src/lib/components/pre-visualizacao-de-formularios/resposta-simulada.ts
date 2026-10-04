import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ValorDeMunicipioComponent } from '../editor-de-condicoes/valor-de-municipio';
import { dicaDosValores, naoReconhecida, respostaDoTexto, type FatoSimulado } from './simulacao-de-respostas';

/** A resposta dada no controle: o valor no JSON que a API compara, ou `undefined` quando não há resposta válida. */
export interface RespostaDada {
  readonly valor: unknown;
  /** Há valor escrito que o domínio do fato não reconhece. */
  readonly invalido: boolean;
}

/**
 * O rótulo e o controle com que a simulação pergunta um fato, escolhido pelo controle do fato. Diz
 * a resposta já convertida no tipo do domínio; quem o usa decide onde guardá-la — nas respostas do
 * candidato ou numa ocorrência de grupo.
 *
 * Os controles não guardam valor vindo de fora, salvo o município, que a busca mostra pelo nome.
 */
@Component({
  selector: 'ui-resposta-simulada',
  standalone: true,
  imports: [ValorDeMunicipioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'field' },
  template: `
    @if (fato().controle === 'municipio') {
      <label class="field__label" [attr.for]="municipioCampo.campoId()">{{ rotulo() }}</label>
      <ui-valor-de-municipio
        #municipioCampo
        [rotulo]="fato().nome"
        [multiplo]="fato().multiplo"
        [values]="municipios()"
        (valuesChange)="responderMunicipios($event)"
      />
      @if (municipios().length > 0) {
        <button type="button" class="btn btn--tertiary btn--sm" (click)="responderMunicipios([])">
          Deixar {{ fato().nome }} sem resposta
        </button>
      }
    } @else {
      <label class="field__label" [for]="controleId()">{{ rotulo() }}</label>
    }
    @switch (fato().controle) {
      @case ('booleano') {
        <select class="select" [id]="controleId()" (change)="responder(valorDe($event))">
          <option value="">Sem resposta</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      }
      @case ('numero') {
        <input
          class="input"
          type="text"
          inputmode="numeric"
          [id]="controleId()"
          [attr.aria-invalid]="invalido() ? 'true' : null"
          [attr.aria-describedby]="invalido() ? controleId() + '-nota' : null"
          (input)="responder(valorDe($event))"
        />
        @if (invalido()) {
          <span class="field__error" [id]="controleId() + '-nota'">Valor não reconhecido. Escreva um número inteiro.</span>
        }
      }
      @case ('data') {
        <input class="input" type="date" [id]="controleId()" (input)="responder(valorDe($event))" />
      }
      @case ('municipio') {
        <!-- O campo de município fica com o rótulo dele, acima: a busca é que o liga ao controle. -->
      }
      @case ('lista') {
        <select class="select" [id]="controleId()" [multiple]="fato().multiplo" (change)="responderLista($event)">
          @if (!fato().multiplo) {
            <option value="">Sem resposta</option>
          }
          @for (valor of fato().valores; track valor) {
            <option [value]="valor">{{ valor }}</option>
          }
        </select>
      }
      @default {
        <input
          class="input"
          type="text"
          [id]="controleId()"
          [attr.aria-invalid]="invalido() ? 'true' : null"
          [attr.aria-describedby]="fato().multiplo ? controleId() + '-nota' : null"
          (input)="responder(valorDe($event))"
        />
        @if (fato().multiplo) {
          <span [class]="invalido() ? 'field__error' : 'field__hint'" [id]="controleId() + '-nota'">
            {{ invalido() ? 'Valor não reconhecido. ' : '' }}{{ dica() }}
          </span>
        }
      }
    }
  `,
})
export class RespostaSimuladaComponent {
  readonly fato = input.required<FatoSimulado>();
  /** O id do controle — único na tela. */
  readonly controleId = input.required<string>();
  readonly rotulo = input.required<string>();
  /** Os códigos IBGE respondidos, que o campo de município mostra; os outros controles não usam. */
  readonly municipios = input<readonly string[]>([]);
  readonly invalido = input<boolean>(false);

  readonly respondida = output<RespostaDada>();

  protected dica(): string {
    return dicaDosValores(this.fato());
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected responder(texto: string): void {
    const valor = respostaDoTexto(this.fato(), texto);
    const invalido = naoReconhecida(valor);
    this.respondida.emit({ valor: invalido ? undefined : valor, invalido });
  }

  protected responderMunicipios(codigos: readonly string[]): void {
    const valor = codigos.length === 0 ? undefined : this.fato().multiplo ? codigos : codigos[0];
    this.respondida.emit({ valor, invalido: false });
  }

  protected responderLista(evento: Event): void {
    const select = evento.target as HTMLSelectElement;
    if (!this.fato().multiplo) {
      this.responder(select.value);
      return;
    }
    const escolhidos = Array.from(select.selectedOptions, (opcao) => opcao.value);
    this.respondida.emit({ valor: escolhidos.length === 0 ? undefined : escolhidos, invalido: false });
  }
}
