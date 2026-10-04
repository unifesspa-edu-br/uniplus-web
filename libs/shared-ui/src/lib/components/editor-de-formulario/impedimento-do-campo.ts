import { ChangeDetectionStrategy, Component, Injector, computed, inject, input, linkedSignal, output } from '@angular/core';

import { EditorDeCondicoesComponent } from '../editor-de-condicoes/editor-de-condicoes';
import { condicaoNova, type CondicaoEmClausula, type FatoEscolhivel } from '../editor-de-condicoes/condicoes-de-fatos';
import { alternativaSemOProprioCampo, comImpedimento, type ItemDoFormulario, type PredicadoNoWire } from './formulario-editavel';
import { focarDepois } from './foco';
import { paraPredicado, problemasDasCondicoes, recopiarSeMudouPorFora } from './predicado-em-edicao';

/** O tamanho da mensagem ao candidato (`FormaDoItem.MensagemDoImpedimentoMaxLength`). */
const MENSAGEM_MAX = 500;

/**
 * O impedimento da inscrição por um campo: quando a resposta dele — sozinha ou junto de respostas
 * anteriores — impede o candidato de se inscrever, e a mensagem que explica o porquê. Toda
 * alternativa cita a resposta do próprio campo, que vem primeiro entre os fatos oferecidos.
 */
@Component({
  selector: 'ui-impedimento-do-campo',
  standalone: true,
  imports: [EditorDeCondicoesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="editor-formulario__restricao">
      <legend class="field__label">Impedimento da inscrição</legend>

      @if (!permitido()) {
        <p class="field__error" [id]="idBase() + '-impedimento-nota'">
          O impedimento só cabe na inscrição, em campo de sim ou não, número, seleção de valores conhecidos ou município.
          Desligue-o para salvar.
        </p>
      }

      <label class="checkbox">
        <input
          type="checkbox"
          [checked]="ligado()"
          [disabled]="disabled() || (!permitido() && !ligado())"
          [attr.aria-describedby]="!permitido() ? idBase() + '-impedimento-nota' : null"
          (change)="alternar()"
        />
        <span class="checkbox__box" aria-hidden="true"></span>
        Impedir a inscrição conforme a resposta deste campo
      </label>

      @if (ligado()) {
        <ui-editor-de-condicoes
          legenda="Impede a inscrição quando"
          [condicoes]="condicoes()"
          [fatos]="fatos()"
          [idBase]="idBase() + '-impedimento'"
          [disabled]="disabled()"
          [erros]="problemas()"
          (condicoesChange)="trocarCondicoes($event)"
        />
        @if (semOProprioCampo()) {
          <p class="field__error">Cada alternativa cita a resposta deste campo: o bloqueio só por resposta anterior é da exibição.</p>
        }

        <div class="field" [class.is-error]="mensagemVazia()">
          <label class="field__label is-required" [for]="idBase() + '-impedimento-mensagem'">Mensagem ao candidato</label>
          <textarea
            class="textarea"
            rows="2"
            [id]="idBase() + '-impedimento-mensagem'"
            [value]="item().impedimento?.mensagem ?? ''"
            [maxLength]="mensagemMax"
            [disabled]="disabled()"
            [attr.aria-invalid]="mensagemVazia() ? 'true' : null"
            [attr.aria-describedby]="idBase() + '-impedimento-mensagem-nota'"
            (input)="trocarMensagem($event)"
          ></textarea>
          <span [class]="mensagemVazia() ? 'field__error' : 'field__hint'" [id]="idBase() + '-impedimento-mensagem-nota'">
            {{ mensagemVazia() ? 'Obrigatória: explica por que a inscrição não é possível.' : 'Explica por que a inscrição não é possível.' }}
          </span>
        </div>
      }
    </fieldset>
  `,
})
export class ImpedimentoDoCampoComponent {
  private readonly injector = inject(Injector);

  readonly item = input.required<ItemDoFormulario>();
  /** Os fatos que a condição pode citar, o próprio campo primeiro: a alternativa nova nasce com ele. */
  readonly fatos = input.required<readonly FatoEscolhivel[]>();
  /** Se o impedimento cabe no campo; o que veio gravado sem caber aparece para ser desligado. */
  readonly permitido = input<boolean>(true);
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);

  readonly itemChange = output<ItemDoFormulario>();

  protected readonly mensagemMax = MENSAGEM_MAX;
  protected readonly ligado = computed(() => this.item().impedimento != null);
  protected readonly mensagemVazia = computed(() => this.ligado() && (this.item().impedimento?.mensagem ?? '').trim() === '');
  protected readonly semOProprioCampo = computed(
    () => this.ligado() && alternativaSemOProprioCampo(this.item().impedimento?.quando ?? null, this.item().fatoCodigo),
  );

  protected readonly condicoes = linkedSignal<PredicadoNoWire, readonly CondicaoEmClausula[]>({
    source: () => this.item().impedimento?.quando ?? null,
    computation: recopiarSeMudouPorFora,
  });

  protected readonly problemas = computed(() => problemasDasCondicoes(this.condicoes(), this.fatos()));

  /** Ligar põe a condição sobre o próprio campo e torna o campo obrigatório; desligar tira o impedimento inteiro. */
  protected alternar(): void {
    if (this.ligado()) {
      this.itemChange.emit({ ...this.item(), impedimento: null });
      return;
    }
    const proprio = this.fatos().find((fato) => fato.codigo === this.item().fatoCodigo);
    if (proprio === undefined) return;
    const condicoes = [condicaoNova(proprio, 1)];
    this.condicoes.set(condicoes);
    this.itemChange.emit(comImpedimento(this.item(), paraPredicado(condicoes)));
    focarDepois(this.injector, `${this.idBase()}-impedimento-mensagem`);
  }

  protected trocarCondicoes(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoes.set(condicoes);
    this.itemChange.emit({ ...this.item(), impedimento: { quando: paraPredicado(condicoes), mensagem: this.item().impedimento?.mensagem ?? '' } });
  }

  protected trocarMensagem(evento: Event): void {
    const mensagem = (evento.target as HTMLTextAreaElement).value;
    this.itemChange.emit({ ...this.item(), impedimento: { quando: this.item().impedimento?.quando ?? null, mensagem } });
  }
}
