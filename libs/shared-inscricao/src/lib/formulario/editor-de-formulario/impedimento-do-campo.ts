import {
  CAMINHO_DO_PREDICADO_DA_OBRIGATORIEDADE,
  CAMINHO_DO_TIPO_DA_OBRIGATORIEDADE,
  type CamposEditadosDoFormulario,
} from './modelo/campos-editados';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';

import { EditorDeCondicoesComponent } from '../editor-de-condicoes/editor-de-condicoes';
import {
  condicaoNova,
  type CondicaoEmClausula,
} from '../editor-de-condicoes/condicoes/condicoes-em-clausulas';
import { type FatoEscolhivel } from '../editor-de-condicoes/condicoes/fatos-escolhiveis';
import { alternativaSemOProprioCampo, comImpedimento } from './modelo/impedimento';
import { type ItemDoFormulario, type PredicadoNoWire } from './modelo/tipos';
import { focarDepois } from './foco';
import {
  paraPredicado,
  problemasDasCondicoes,
  recopiarSeMudouPorFora,
} from './predicado-em-edicao';

/** O tamanho da mensagem ao candidato (`FormaDoItem.MensagemDoImpedimentoMaxLength`). */
const MENSAGEM_MAX = 500;
const CAMPOS_DO_IMPEDIMENTO: CamposEditadosDoFormulario = [
  ['regras', 'impedimento'],
  CAMINHO_DO_TIPO_DA_OBRIGATORIEDADE,
  CAMINHO_DO_PREDICADO_DA_OBRIGATORIEDADE,
];

/**
 * O impedimento da inscrição por um campo: quando a resposta dele — sozinha ou junto de respostas
 * anteriores — impede o candidato de se inscrever, e a mensagem que explica o porquê. Toda
 * alternativa cita a resposta do próprio campo, que vem primeiro entre os fatos oferecidos.
 */
@Component({
  selector: 'insc-impedimento-do-campo',
  standalone: true,
  imports: [EditorDeCondicoesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="editor-formulario__restricao">
      <legend class="field__label">Impedimento da inscrição</legend>

      @if (!permitido()) {
        <p class="field__error" [id]="idBase() + '-impedimento-nota'">
          O impedimento só cabe na inscrição, em campo de sim ou não, número, seleção de valores
          conhecidos ou município. Desligue-o para salvar.
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
        <insc-editor-de-condicoes
          legenda="Impede a inscrição quando"
          [condicoes]="condicoes()"
          [fatos]="fatos()"
          [idBase]="idBase() + '-impedimento'"
          [disabled]="disabled()"
          [erros]="problemas()"
          (condicoesChange)="trocarCondicoes($event)"
        />
        @if (semOProprioCampo()) {
          <p class="field__error">
            Cada alternativa cita a resposta deste campo: o bloqueio só por resposta anterior é da
            exibição.
          </p>
        }

        <div class="field" [class.is-error]="mensagemVazia()">
          <label class="field__label is-required" [for]="idBase() + '-impedimento-mensagem'"
            >Mensagem ao candidato</label
          >
          <textarea
            class="textarea"
            rows="2"
            [id]="idBase() + '-impedimento-mensagem'"
            [value]="item().regras.impedimento?.mensagem ?? ''"
            [maxLength]="mensagemMax"
            [disabled]="disabled()"
            [attr.aria-invalid]="mensagemVazia() ? 'true' : null"
            [attr.aria-describedby]="idBase() + '-impedimento-mensagem-nota'"
            (input)="trocarMensagem($event)"
          ></textarea>
          <span
            [class]="mensagemVazia() ? 'field__error' : 'field__hint'"
            [id]="idBase() + '-impedimento-mensagem-nota'"
          >
            {{
              mensagemVazia()
                ? 'Obrigatória: explica por que a inscrição não é possível.'
                : 'Explica por que a inscrição não é possível.'
            }}
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

  readonly camposEditados = output<CamposEditadosDoFormulario>();
  readonly itemChange = output<ItemDoFormulario>();

  protected readonly mensagemMax = MENSAGEM_MAX;
  protected readonly ligado = computed(() => this.item().regras.impedimento != null);
  protected readonly mensagemVazia = computed(
    () => this.ligado() && (this.item().regras.impedimento?.mensagem ?? '').trim() === '',
  );
  protected readonly semOProprioCampo = computed(
    () =>
      this.ligado() &&
      alternativaSemOProprioCampo(
        this.item().regras.impedimento?.quando ?? null,
        this.item().fatoCodigo,
      ),
  );

  protected readonly condicoes = linkedSignal<PredicadoNoWire, readonly CondicaoEmClausula[]>({
    source: () => this.item().regras.impedimento?.quando ?? null,
    computation: recopiarSeMudouPorFora,
  });

  protected readonly problemas = computed(() =>
    problemasDasCondicoes(this.condicoes(), this.fatos()),
  );

  /** Ligar põe a condição sobre o próprio campo e torna o campo obrigatório; desligar tira o impedimento inteiro. */
  protected alternar(): void {
    if (this.ligado()) {
      const regras = { ...this.item().regras, impedimento: null };
      this.publicar({ ...this.item(), regras }, [['regras', 'impedimento']]);
      return;
    }
    const proprio = this.fatos().find((fato) => fato.codigo === this.item().fatoCodigo);
    if (proprio === undefined) return;
    const condicoes = [condicaoNova(proprio, 1)];
    this.condicoes.set(condicoes);
    this.publicar(comImpedimento(this.item(), paraPredicado(condicoes)), CAMPOS_DO_IMPEDIMENTO);
    focarDepois(this.injector, `${this.idBase()}-impedimento-mensagem`);
  }

  protected trocarCondicoes(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoes.set(condicoes);
    const impedimento = {
      quando: paraPredicado(condicoes),
      mensagem: this.item().regras.impedimento?.mensagem ?? '',
    };
    const regras = { ...this.item().regras, impedimento };
    this.publicar({ ...this.item(), regras }, [['regras', 'impedimento', 'quando']]);
  }

  protected trocarMensagem(evento: Event): void {
    const mensagem = (evento.target as HTMLTextAreaElement).value;
    const impedimento = { quando: this.item().regras.impedimento?.quando ?? null, mensagem };
    const regras = { ...this.item().regras, impedimento };
    this.publicar({ ...this.item(), regras }, [['regras', 'impedimento', 'mensagem']]);
  }

  private publicar(item: ItemDoFormulario, campos: CamposEditadosDoFormulario): void {
    this.camposEditados.emit(campos);
    this.itemChange.emit(item);
  }
}
