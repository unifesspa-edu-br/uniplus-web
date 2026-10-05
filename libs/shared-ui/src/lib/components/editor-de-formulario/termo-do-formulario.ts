import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';

import { EditorDeCondicoesComponent } from '../editor-de-condicoes/editor-de-condicoes';
import { type CondicaoEmClausula, type FatoEscolhivel } from '../editor-de-condicoes/condicoes-de-fatos';
import {
  OBRIGATORIEDADE_NUNCA,
  OBRIGATORIEDADE_QUANDO,
  OBRIGATORIEDADE_SEMPRE,
  type PredicadoNoWire,
  type TermoDisponivel,
  type TermoDoFormulario,
} from './formulario-editavel';
import { paraPredicado, problemasDasCondicoes, recopiarSeMudouPorFora } from './predicado-em-edicao';

const ACEITES = [
  { valor: OBRIGATORIEDADE_SEMPRE, rotulo: 'Aceite obrigatório' },
  { valor: OBRIGATORIEDADE_NUNCA, rotulo: 'Aceite opcional' },
  { valor: OBRIGATORIEDADE_QUANDO, rotulo: 'Aceite obrigatório conforme respostas' },
] as const;

/**
 * Um termo de consentimento exigido pelo formulário: a versão aceita, se o aceite é obrigatório e
 * quando o termo aparece — o consentimento de consulta a dados de renda, por exemplo, só para quem
 * concorre a cota de renda. Devolve o termo inteiro a cada mudança.
 */
@Component({
  selector: 'ui-termo-do-formulario',
  standalone: true,
  imports: [EditorDeCondicoesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="editor-formulario__item" [attr.aria-labelledby]="idDe('titulo')">
      <div class="editor-formulario__cabecalho">
        <h4 class="editor-formulario__titulo-item" [id]="idDe('titulo')">{{ posicao() }}. {{ nome() }}</h4>
        <code>{{ termo().codigo }}</code>
      </div>

      @if (erros().length > 0) {
        <ul class="editor-formulario__erros">
          @for (erro of erros(); track $index) {
            <li class="field__error">{{ erro }}</li>
          }
        </ul>
      }

      <div class="editor-formulario__campos">
        <div class="field">
          <label class="field__label" [for]="idDe('versao')">Versão aceita</label>
          <select class="select" [id]="idDe('versao')" [disabled]="disabled()" (change)="trocar({ versaoId: valorDe($event) })">
            @for (versao of versoes(); track versao.versaoId) {
              <option [value]="versao.versaoId" [selected]="versao.versaoId === termo().versaoId">{{ versao.rotulo }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label class="field__label" [for]="idDe('aceite')">Aceite</label>
          <select class="select" [id]="idDe('aceite')" [disabled]="disabled()" (change)="trocarAceite(valorDe($event))">
            @for (opcao of aceites; track opcao.valor) {
              <option [value]="opcao.valor" [selected]="opcao.valor === termo().obrigatoriedade">{{ opcao.rotulo }}</option>
            }
          </select>
        </div>
      </div>

      @if (termo().obrigatoriedade === quando) {
        <ui-editor-de-condicoes
          legenda="Aceite obrigatório quando"
          textoSemCondicao="Declare ao menos uma condição: sem ela, escolha obrigatório ou opcional."
          [condicoes]="condicoesDoAceite()"
          [fatos]="fatos()"
          [idBase]="idDe('aceite-quando')"
          [disabled]="disabled()"
          [erros]="problemas(condicoesDoAceite())"
          (condicoesChange)="trocarAceiteQuando($event)"
        />
      }

      <ui-editor-de-condicoes
        legenda="Exibir o termo só quando"
        textoSemCondicao="O termo é exibido sempre."
        [condicoes]="condicoesDaExibicao()"
        [fatos]="fatos()"
        [idBase]="idDe('exibicao')"
        [disabled]="disabled()"
        [erros]="problemas(condicoesDaExibicao())"
        (condicoesChange)="trocarExibicao($event)"
      />

      <div class="editor-formulario__acoes" role="group" [attr.aria-label]="'Ações do termo ' + nome()">
        <button class="btn btn--tertiary btn--sm" type="button" [id]="idDe('subir')" [disabled]="disabled() || !podeSubir()" [attr.aria-label]="'Subir ' + nome()" (click)="mover.emit(-1)">
          <i class="pi pi-arrow-up" aria-hidden="true"></i> Subir
        </button>
        <button class="btn btn--tertiary btn--sm" type="button" [id]="idDe('descer')" [disabled]="disabled() || !podeDescer()" [attr.aria-label]="'Descer ' + nome()" (click)="mover.emit(1)">
          <i class="pi pi-arrow-down" aria-hidden="true"></i> Descer
        </button>
        <button class="btn btn--tertiary btn--sm" type="button" [disabled]="disabled()" [attr.aria-label]="'Deixar de exigir o termo ' + nome()" (click)="remover.emit()">
          <i class="pi pi-trash" aria-hidden="true"></i> Remover
        </button>
      </div>
    </article>
  `,
})
export class TermoDoFormularioComponent {
  readonly termo = input.required<TermoDoFormulario>();
  /** O termo no catálogo; ausente quando o catálogo não o traz mais. */
  readonly disponivel = input<TermoDisponivel | undefined>(undefined);
  readonly posicao = input.required<number>();
  readonly fatos = input.required<readonly FatoEscolhivel[]>();
  readonly idBase = input.required<string>();
  readonly podeSubir = input<boolean>(false);
  readonly podeDescer = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly erros = input<readonly string[]>([]);

  readonly termoChange = output<TermoDoFormulario>();
  readonly mover = output<-1 | 1>();
  readonly remover = output<void>();

  protected readonly aceites = ACEITES;
  protected readonly quando = OBRIGATORIEDADE_QUANDO;

  protected readonly nome = computed(() => this.disponivel()?.nome ?? 'Termo fora do catálogo');

  /** As versões promovidas; a gravada aparece mesmo se não estiver entre elas, para não trocar sem aviso. */
  protected readonly versoes = computed(() => {
    const versoes = this.disponivel()?.versoes ?? [];
    return versoes.some((versao) => versao.versaoId === this.termo().versaoId)
      ? versoes
      : [{ versaoId: this.termo().versaoId, rotulo: 'Versão gravada (fora do catálogo)' }, ...versoes];
  });

  protected readonly condicoesDaExibicao = linkedSignal<PredicadoNoWire, readonly CondicaoEmClausula[]>({
    source: () => this.termo().exibicao,
    computation: recopiarSeMudouPorFora,
  });

  protected readonly condicoesDoAceite = linkedSignal<PredicadoNoWire, readonly CondicaoEmClausula[]>({
    source: () => this.termo().predicadoObrigatoriedade,
    computation: recopiarSeMudouPorFora,
  });

  protected idDe(parte: string): string {
    return `${this.idBase()}-${parte}`;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLSelectElement).value;
  }

  protected problemas(condicoes: readonly CondicaoEmClausula[]): Readonly<Record<number, string | undefined>> {
    return problemasDasCondicoes(condicoes, this.fatos());
  }

  protected trocar(mudanca: Partial<TermoDoFormulario>): void {
    this.termoChange.emit({ ...this.termo(), ...mudanca });
  }

  /** Fora do aceite condicional, o predicado sai: a API recusa predicado sem a condicional. */
  protected trocarAceite(obrigatoriedade: string): void {
    const condicional = obrigatoriedade === OBRIGATORIEDADE_QUANDO;
    if (!condicional) this.condicoesDoAceite.set([]);
    this.trocar({ obrigatoriedade, predicadoObrigatoriedade: condicional ? paraPredicado(this.condicoesDoAceite()) : null });
  }

  protected trocarAceiteQuando(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoesDoAceite.set(condicoes);
    this.trocar({ predicadoObrigatoriedade: paraPredicado(condicoes) });
  }

  protected trocarExibicao(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoesDaExibicao.set(condicoes);
    this.trocar({ exibicao: paraPredicado(condicoes) });
  }
}
