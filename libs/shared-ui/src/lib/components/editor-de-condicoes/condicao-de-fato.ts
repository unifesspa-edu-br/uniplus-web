import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ComboboxComponent, type UiComboboxGroup } from '../combobox/combobox';
import { ValorDeMunicipioComponent } from './valor-de-municipio';
import {
  RESPOSTAS_BOOLEANAS,
  alcanceDaCondicao,
  comOperador,
  comValorEscalar,
  comValoresDeLista,
  comparaComLista,
  operadoresDoFato,
  valorEscalarDe,
  valoresDeListaDe,
  type CondicaoDeFato,
  type FatoEscolhivel,
} from './condicoes-de-fatos';

/**
 * Uma condição sobre um fato do candidato: o fato, a comparação e o valor.
 *
 * Os três vêm do catálogo institucional e não de texto livre — são vocabulário fechado do
 * lado do servidor, e digitar "=" onde ele espera "IGUAL" era recusado no 422 sem dizer qual
 * dos três campos estava errado. O valor muda de controle com o domínio: lista de escolha
 * para "é um de", duas respostas fechadas para sim-ou-não, seleção para categórico e campo
 * numérico para o resto. O município, que não vem em lista, é escolhido pela busca no Geo.
 *
 * O componente não guarda estado: recebe a condição e devolve a condição inteira a cada
 * mudança. Os campos extras que a condição trouxer (a cláusula, por exemplo) seguem junto.
 *
 * Acessibilidade: todo controle tem rótulo associado; o que a condição alcança é anunciado
 * como `status`; o erro informado pelo hospedeiro é anunciado como `alert` e ligado ao
 * controle de valor por `aria-describedby`. O conteúdo projetado entra após o valor — é o
 * lugar de uma ação da linha, como remover.
 */
@Component({
  selector: 'ui-condicao-de-fato',
  standalone: true,
  imports: [ComboboxComponent, ValorDeMunicipioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form-field">
      <label class="label" [attr.for]="idDe('fato')">Fato do candidato</label>
      <select
        class="select"
        [attr.id]="idDe('fato')"
        [disabled]="disabled()"
        (change)="escolherFato(valorDe($event))"
      >
        @if (permiteSemFato()) {
          <option value="" [selected]="condicao().fato === ''">Escolha o fato</option>
        }
        @for (fato of fatos(); track fato.codigo) {
          <option [value]="fato.codigo" [selected]="fato.codigo === condicao().fato">
            {{ fato.nome }}
          </option>
        }
        @if (condicao().fato !== '' && fatoAtual() === undefined) {
          <option [value]="condicao().fato" selected>
            {{ condicao().fato }} — fora do catálogo
          </option>
        }
      </select>
    </div>

    @if (condicao().fato !== '' || !permiteSemFato()) {
      <div class="form-field">
        <label class="label" [attr.for]="idDe('operador')">Comparação</label>
        <select
          class="select"
          [attr.id]="idDe('operador')"
          [disabled]="disabled()"
          (change)="escolherOperador(valorDe($event))"
        >
          @for (opcao of operadores(); track opcao.valor) {
            <option [value]="opcao.valor" [selected]="opcao.valor === condicao().operador">
              {{ opcao.rotulo }}
            </option>
          }
        </select>
      </div>

      @if (fatoAtual()?.municipio) {
        <!--
          Município: a lista do país não vem inteira, e o valor é escolhido pela busca no Geo e
          gravado pelo código IBGE — um só, ou vários na comparação com lista.
        -->
        <div class="form-field condicao-de-fato__valor">
          <label class="label" [attr.for]="municipioCampo.campoId()">
            {{ comparaComLista(condicao().operador) ? 'Municípios' : 'Município' }}
          </label>
          <ui-valor-de-municipio
            #municipioCampo
            [rotulo]="
              comparaComLista(condicao().operador)
                ? rotuloDosValores()
                : 'Município que satisfaz a condição'
            "
            [multiplo]="comparaComLista(condicao().operador)"
            [values]="municipiosEscolhidos()"
            [disabled]="disabled()"
            [invalido]="erro() !== ''"
            [descritoPor]="ligacoes()"
            (valuesChange)="escolherMunicipios($event)"
          />
        </div>
      } @else if (comparaComLista(condicao().operador)) {
        <div class="form-field condicao-de-fato__valor">
          <label class="label" [attr.for]="valoresCampo.campoId">Valores</label>
          <ui-combobox
            #valoresCampo
            multiplo
            [rotulo]="rotuloDosValores()"
            placeholder="Escolha ao menos um"
            textoSemResultado="Nenhum valor do domínio casa com o que você digitou."
            [grupos]="grupos()"
            [values]="valoresDaLista()"
            [disabled]="disabled()"
            [invalido]="erro() !== ''"
            [descritoPor]="ligacoes()"
            (valuesChange)="escolherValores($event)"
          />
        </div>
      } @else if (fatoAtual()?.tipoDominio === 'BOOLEANO') {
        <div class="form-field condicao-de-fato__valor">
          <label class="label" [attr.for]="idDe('valor')">Resposta</label>
          <!--
            Duas opções fechadas, nunca texto livre: um campo de texto aqui aceitaria "Sim" e
            gravaria o contrário do que foi escrito, e o servidor aceitaria, porque "não"
            também é booleano válido.
          -->
          <select
            class="select"
            [attr.id]="idDe('valor')"
            [disabled]="disabled()"
            [attr.aria-invalid]="erro() !== '' ? 'true' : null"
            [attr.aria-describedby]="ligacoes()"
            (change)="escolherValor(valorDe($event))"
          >
            <option value="" [selected]="valorEscalar() === ''">Escolha a resposta</option>
            @for (resposta of respostasBooleanas; track resposta.valor) {
              <option [value]="resposta.valor" [selected]="resposta.valor === valorEscalar()">
                {{ resposta.rotulo }}
              </option>
            }
          </select>
        </div>
      } @else if (valoresEscolhiveis().length > 0) {
        <div class="form-field condicao-de-fato__valor">
          <label class="label" [attr.for]="idDe('valor')">Valor</label>
          <select
            class="select"
            [attr.id]="idDe('valor')"
            [disabled]="disabled()"
            [attr.aria-invalid]="erro() !== '' ? 'true' : null"
            [attr.aria-describedby]="ligacoes()"
            (change)="escolherValor(valorDe($event))"
          >
            <option value="" [selected]="valorEscalar() === ''">Escolha o valor</option>
            @for (valor of valoresEscolhiveis(); track valor) {
              <option [value]="valor" [selected]="valor === valorEscalar()">{{ valor }}</option>
            }
          </select>
        </div>
      } @else {
        <!--
          Fato numérico: o domínio não tem lista de valores, e o que ele aceita é um inteiro —
          decimal é recusado pelo servidor.
        -->
        <div class="form-field condicao-de-fato__valor">
          <label class="label" [attr.for]="idDe('valor')">Valor</label>
          <input
            class="input"
            type="text"
            inputmode="numeric"
            [attr.id]="idDe('valor')"
            [value]="valorEscalar()"
            [disabled]="disabled()"
            [attr.aria-invalid]="erro() !== '' ? 'true' : null"
            [attr.aria-describedby]="ligacoes()"
            (input)="escolherValor(valorDe($event))"
          />
        </div>
      }

      <ng-content />

      @if (alcance() !== '') {
        <!--
          "não é feminino" e "é masculino" não são a mesma coisa: a primeira alcança também
          quem declarou outro valor do domínio. Dizer o que cada condição alcança é o que
          torna a escolha consciente antes da gravação.
        -->
        <p class="field__hint condicao-de-fato__nota" role="status" [attr.id]="idDe('alcance')">
          {{ alcance() }}
        </p>
      }

      @if (erro() !== '') {
        <p class="field__error condicao-de-fato__nota" role="alert" [attr.id]="idDe('erro')">
          {{ erro() }}
        </p>
      }
    } @else {
      <!--
        Sem fato escolhido não há o que comparar nem com o quê: um seletor de comparação sem
        opção nenhuma, rotulado, é caixa inerte que não explica a si mesma.
      -->
      <p class="field__hint condicao-de-fato__nota">
        Escolha o fato do candidato para declarar a comparação e o valor.
      </p>
    }
  `,
})
export class CondicaoDeFatoComponent {
  readonly condicao = input.required<CondicaoDeFato>();
  readonly fatos = input.required<readonly FatoEscolhivel[]>();
  /** Prefixo dos ids dos controles — único na tela, para os rótulos apontarem para eles. */
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);
  /** Oferece "Escolha o fato" e, enquanto nenhum fato estiver escolhido, esconde o resto. */
  readonly permiteSemFato = input<boolean>(false);
  /** Como a lista de valores se chama para quem usa leitor de tela. */
  readonly rotuloDosValores = input<string>('Valores que satisfazem a condição');
  /** O que impede a condição de ser gravada, quando o hospedeiro já sabe. */
  readonly erro = input<string>('');

  readonly condicaoChange = output<CondicaoDeFato>();

  protected readonly respostasBooleanas = RESPOSTAS_BOOLEANAS;
  protected readonly comparaComLista = comparaComLista;

  protected readonly fatoAtual = computed(() =>
    this.fatos().find((fato) => fato.codigo === this.condicao().fato),
  );

  protected readonly operadores = computed(() => {
    const fato = this.fatoAtual();
    return fato === undefined ? [] : operadoresDoFato(fato);
  });

  protected readonly valoresEscolhiveis = computed(() => this.fatoAtual()?.valores ?? []);

  protected readonly grupos = computed<readonly UiComboboxGroup[]>(() => {
    const fato = this.fatoAtual();
    if (fato === undefined || fato.valores.length === 0) return [];
    return [
      {
        label: fato.nome,
        options: fato.valores.map((valor) => ({ value: valor, label: valor })),
      },
    ];
  });

  protected readonly valorEscalar = computed(() => valorEscalarDe(this.condicao()));
  protected readonly valoresDaLista = computed(() => valoresDeListaDe(this.condicao()));
  /** Os códigos IBGE da condição sobre município, na forma de lista nos dois casos. */
  protected readonly municipiosEscolhidos = computed(() =>
    comparaComLista(this.condicao().operador)
      ? this.valoresDaLista()
      : [this.valorEscalar()].filter((codigo) => codigo !== ''),
  );

  protected readonly alcance = computed(() => {
    const fato = this.fatoAtual();
    return fato === undefined ? '' : alcanceDaCondicao(this.condicao(), fato);
  });

  /** Os ids das notas que descrevem o controle de valor — só as que existem na tela. */
  protected readonly ligacoes = computed(() => {
    const ids = [
      this.alcance() !== '' ? this.idDe('alcance') : '',
      this.erro() !== '' ? this.idDe('erro') : '',
    ].filter((id) => id !== '');
    return ids.length > 0 ? ids.join(' ') : null;
  });

  protected idDe(parte: string): string {
    return `${this.idBase()}-${parte}`;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  /**
   * Troca o fato. O operador e o valor recomeçam: eles pertenciam ao domínio do fato
   * anterior, e carregá-los para outro domínio gravaria uma comparação que o servidor
   * recusa. Voltar ao "Escolha o fato" LIMPA a condição — ignorar a escolha em branco deixava
   * a tela dizendo que não havia fato enquanto o rascunho continuava com o anterior.
   */
  protected escolherFato(codigo: string): void {
    const atual = this.condicao();

    if (codigo === '') {
      this.condicaoChange.emit({ ...atual, fato: '', operador: '', valor: '' });
      return;
    }

    const fato = this.fatos().find((candidato) => candidato.codigo === codigo);
    if (fato === undefined) return;

    this.condicaoChange.emit({
      ...atual,
      fato: codigo,
      operador: operadoresDoFato(fato)[0].valor,
      valor: '',
    });
  }

  protected escolherOperador(operador: string): void {
    const fato = this.fatoAtual();
    if (fato === undefined) return;

    this.condicaoChange.emit(comOperador(this.condicao(), fato, operador));
  }

  protected escolherValor(valor: string): void {
    const fato = this.fatoAtual();
    if (fato === undefined) return;

    this.condicaoChange.emit(comValorEscalar(this.condicao(), fato, valor));
  }

  protected escolherMunicipios(codigos: readonly string[]): void {
    if (comparaComLista(this.condicao().operador)) {
      this.escolherValores(codigos);
      return;
    }
    this.escolherValor(codigos[0] ?? '');
  }

  protected escolherValores(valores: readonly string[]): void {
    this.condicaoChange.emit(comValoresDeLista(this.condicao(), valores));
  }
}
