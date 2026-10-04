import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';

import { EditorDeCondicoesComponent } from '../editor-de-condicoes/editor-de-condicoes';
import { type CondicaoEmClausula, type FatoEscolhivel } from '../editor-de-condicoes/condicoes-de-fatos';
import { TagComponent } from '../tag/tag';
import {
  LIMITES_DO_FORMULARIO,
  OBRIGATORIEDADES,
  OBRIGATORIEDADE_QUANDO,
  OBRIGATORIEDADE_SEMPRE,
  type ItemDoFormulario,
  type PredicadoNoWire,
  type RecusaDaRestricao,
} from './formulario-editavel';
import { ImpedimentoDoCampoComponent } from './impedimento-do-campo';
import { paraPredicado, problemasDasCondicoes, recopiarSeMudouPorFora } from './predicado-em-edicao';
import { RestricoesDoCampoComponent } from './restricoes-do-campo';

/** Como o candidato responde, pelo tipo de campo. */
const TIPOS_DE_CAMPO: Readonly<Record<string, string>> = {
  BOOLEANO: 'Sim ou não',
  NUMERO: 'Número',
  TEXTO: 'Texto',
  DATA: 'Data',
  ENDERECO: 'Endereço',
  MUNICIPIO: 'Município',
  SELECAO_UNICA: 'Escolha de um valor',
  SELECAO_MULTIPLA: 'Escolha de vários valores',
};

/**
 * Um campo do formulário em edição: o rótulo, a ajuda, se é obrigatório e quando é exibido.
 *
 * Não guarda o item: devolve o item inteiro a cada mudança, com o que não edita intacto. Guarda
 * só as condições como o editor de condições as escreve — o valor em texto, enquanto é digitado,
 * não sobrevive à ida e volta pela forma da API — e as recopia quando o predicado muda por fora.
 */
@Component({
  selector: 'ui-item-do-formulario',
  standalone: true,
  imports: [EditorDeCondicoesComponent, ImpedimentoDoCampoComponent, RestricoesDoCampoComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="editor-formulario__item" [attr.aria-labelledby]="idDe('titulo')">
      <div class="editor-formulario__cabecalho">
        @if (nivelDoTitulo() === 5) {
          <h5 class="editor-formulario__titulo-item" [id]="idDe('titulo')">{{ posicao() }}. {{ nome() }}</h5>
        } @else {
          <h4 class="editor-formulario__titulo-item" [id]="idDe('titulo')">{{ posicao() }}. {{ nome() }}</h4>
        }
        <ui-tag variant="neutral">{{ tipoDeCampo() }}</ui-tag>
        @if (fatoDesativado()) {
          <ui-tag variant="warning">Fato desativado</ui-tag>
        }
      </div>

      @if (remocaoTravadaPor(); as motivo) {
        <p class="field__hint" [id]="idDe('remocao-travada')">{{ motivo }}</p>
      }

      @if (travadoPor(); as motivo) {
        <p class="field__hint" [id]="idDe('trava')">{{ motivo }}</p>
      }

      @if (erros().length > 0) {
        <ul class="editor-formulario__erros" [id]="idDe('erros')">
          @for (erro of erros(); track $index) {
            <li class="field__error">{{ erro }}</li>
          }
        </ul>
      }

      <div class="editor-formulario__campos">
        <div class="field" [class.is-error]="rotuloVazio()">
          <label class="field__label is-required" [for]="idDe('rotulo')">Rótulo</label>
          <input
            class="input"
            type="text"
            [id]="idDe('rotulo')"
            [value]="item().rotulo"
            [maxLength]="limites.rotulo"
            [disabled]="disabled()"
            [attr.aria-invalid]="rotuloVazio() ? 'true' : null"
            [attr.aria-describedby]="rotuloVazio() ? idDe('rotulo-erro') : null"
            (input)="trocar({ rotulo: valorDe($event) })"
          />
          @if (rotuloVazio()) {
            <span class="field__error" [id]="idDe('rotulo-erro')">O rótulo é o que o candidato lê: não pode ficar vazio.</span>
          }
        </div>

        <div class="field" [class.is-error]="opcionalQueExigeResposta()">
          <label class="field__label" [for]="idDe('obrigatoriedade')">Obrigatoriedade</label>
          <select
            class="select"
            [id]="idDe('obrigatoriedade')"
            [disabled]="disabled() || travadoPor() !== null"
            [attr.aria-describedby]="travadoPor() !== null ? idDe('trava') : exigeResposta() ? idDe('obrigatoriedade-nota') : null"
            [attr.aria-invalid]="opcionalQueExigeResposta() ? 'true' : null"
            (change)="trocarObrigatoriedade(valorDe($event))"
          >
            @for (opcao of obrigatoriedades; track opcao.valor) {
              <option
                [value]="opcao.valor"
                [selected]="opcao.valor === obrigatoriedade()"
                [disabled]="exigeResposta() && opcao.valor !== sempre"
              >
                {{ opcao.rotulo }}
              </option>
            }
          </select>
          @if (exigeResposta()) {
            <span [class]="opcionalQueExigeResposta() ? 'field__error' : 'field__hint'" [id]="idDe('obrigatoriedade-nota')">
              Precisa ser obrigatório: uma condição de negação cita este campo, ou ele tem impedimento. Sem
              resposta, toda comparação dá falso, e a regra concluiria o que o candidato não declarou.
            </span>
          }
        </div>

        <div class="field editor-formulario__largo">
          <label class="field__label" [for]="idDe('ajuda')">Ajuda</label>
          <textarea
            class="textarea"
            rows="2"
            [id]="idDe('ajuda')"
            [value]="item().ajuda ?? ''"
            [maxLength]="limites.ajuda"
            [disabled]="disabled()"
            [attr.aria-describedby]="idDe('ajuda-nota')"
            (input)="trocar({ ajuda: valorDe($event).trim() === '' ? null : valorDe($event) })"
          ></textarea>
          <span class="field__hint" [id]="idDe('ajuda-nota')">Texto opcional exibido abaixo do campo.</span>
        </div>
      </div>

      @if (obrigatoriedade() === quando) {
        <ui-editor-de-condicoes
          legenda="Obrigatório quando"
          textoSemCondicao="Declare ao menos uma condição: sem ela, escolha Obrigatório ou Opcional."
          [condicoes]="condicoesDaObrigatoriedade()"
          [fatos]="fatos()"
          [idBase]="idDe('obrigatorio-quando')"
          [disabled]="disabled()"
          [textoSemFatos]="textoSemFatos"
          [erros]="problemas(condicoesDaObrigatoriedade())"
          (condicoesChange)="trocarObrigatorioQuando($event)"
        />
      }

      <ui-editor-de-condicoes
        legenda="Exibir o campo só quando"
        textoSemCondicao="O campo é exibido sempre."
        [condicoes]="condicoesDaExibicao()"
        [fatos]="fatos()"
        [idBase]="idDe('exibicao')"
        [disabled]="disabled() || travadoPor() !== null"
        [textoSemFatos]="textoSemFatos"
        [erros]="problemas(condicoesDaExibicao())"
        (condicoesChange)="trocarExibicao($event)"
      />

      <ui-restricoes-do-campo
        [item]="item()"
        [valoresConhecidos]="valoresConhecidos()"
        [fatos]="fatos()"
        [fontesDeOpcoes]="fontesDeOpcoes()"
        [recusas]="recusasDasRestricoes()"
        [ufs]="ufs()"
        [idBase]="idBase()"
        [disabled]="disabled()"
        (restricoesChange)="trocar({ restricoes: $event })"
      />

      @if (impedimentoPermitido() || item().impedimento) {
        <ui-impedimento-do-campo
          [item]="item()"
          [fatos]="fatosDoImpedimento()"
          [permitido]="impedimentoPermitido()"
          [idBase]="idBase()"
          [disabled]="disabled()"
          (itemChange)="itemChange.emit($event)"
        />
      }

      <div class="editor-formulario__acoes" role="group" [attr.aria-label]="'Ações do campo ' + nome()">
        <button
          class="btn btn--tertiary btn--sm"
          type="button"
          [id]="idDe('subir')"
          [disabled]="disabled() || !podeSubir()"
          [attr.aria-label]="'Mover ' + nome() + ' para cima'"
          (click)="mover.emit(-1)"
        >
          <i class="pi pi-arrow-up" aria-hidden="true"></i> Subir
        </button>
        <button
          class="btn btn--tertiary btn--sm"
          type="button"
          [id]="idDe('descer')"
          [disabled]="disabled() || !podeDescer()"
          [attr.aria-label]="'Mover ' + nome() + ' para baixo'"
          (click)="mover.emit(1)"
        >
          <i class="pi pi-arrow-down" aria-hidden="true"></i> Descer
        </button>
        <button
          class="btn btn--tertiary btn--sm"
          type="button"
          [disabled]="disabled() || remocaoTravadaPor() !== null"
          [attr.aria-label]="'Remover o campo ' + nome()"
          [attr.aria-describedby]="remocaoTravadaPor() !== null ? idDe('remocao-travada') : null"
          (click)="remover.emit()"
        >
          <i class="pi pi-trash" aria-hidden="true"></i> Remover
        </button>
      </div>
    </article>
  `,
})
export class ItemDoFormularioComponent {
  readonly item = input.required<ItemDoFormulario>();
  /** A posição do item na seção, a partir de 1. */
  readonly posicao = input.required<number>();
  /** Os fatos que as condições do item podem citar. */
  readonly fatos = input.required<readonly FatoEscolhivel[]>();
  /** Prefixo dos ids — único na tela. */
  readonly idBase = input.required<string>();
  /** Se uma regra do formulário exige resposta deste campo (negação ou impedimento). */
  readonly exigeResposta = input<boolean>(false);
  readonly fatoDesativado = input<boolean>(false);
  readonly podeSubir = input<boolean>(false);
  readonly podeDescer = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  /** As recusas da API que apontam este item. */
  readonly erros = input<readonly string[]>([]);
  /** Os valores do domínio do próprio fato, quando conhecidos: os que as opções permitidas marcam. */
  readonly valoresConhecidos = input<readonly string[]>([]);
  /** Os campos anteriores de onde as opções da seleção podem vir: os de opções que cabem nas dele. */
  readonly fontesDeOpcoes = input<readonly { readonly codigo: string; readonly nome: string }[]>([]);
  /** As recusas da API que apontam uma restrição do campo. */
  readonly recusasDasRestricoes = input<readonly RecusaDaRestricao[]>([]);
  /** Os campos de UF anteriores, para o município escolher de onde vêm os municípios. */
  readonly ufs = input<readonly { readonly codigo: string; readonly nome: string }[]>([]);
  /** Se o impedimento cabe neste campo (finalidade, tipo e próprio fato citável). */
  readonly impedimentoPermitido = input<boolean>(false);
  /** O nível do título: 4 no item da seção, 5 no campo do grupo, que fica sob o título do grupo. */
  readonly nivelDoTitulo = input<4 | 5>(4);
  /** Por que o campo não pode ser removido — no processo, uma exigência ou outra regra o cita. */
  readonly remocaoTravadaPor = input<string | null>(null);
  /** Por que a obrigatoriedade e a exibição não se editam — o parentesco do grupo que inclui o candidato. */
  readonly travadoPor = input<string | null>(null);
  /** Os fatos que a condição do impedimento cita, o próprio campo primeiro. */
  readonly fatosDoImpedimento = input<readonly FatoEscolhivel[]>([]);

  readonly itemChange = output<ItemDoFormulario>();
  readonly mover = output<-1 | 1>();
  readonly remover = output<void>();

  protected readonly limites = LIMITES_DO_FORMULARIO;
  protected readonly obrigatoriedades = OBRIGATORIEDADES;
  protected readonly sempre = OBRIGATORIEDADE_SEMPRE;
  protected readonly quando = OBRIGATORIEDADE_QUANDO;
  protected readonly textoSemFatos =
    'Nenhum campo anterior pode ser citado: condições citam só campos que vêm antes deste.';

  protected readonly nome = computed(() => this.item().rotulo.trim() || this.item().fatoCodigo);
  protected readonly tipoDeCampo = computed(() => TIPOS_DE_CAMPO[this.item().tipoRenderizacao] ?? this.item().tipoRenderizacao);
  protected readonly rotuloVazio = computed(() => this.item().rotulo.trim() === '');
  protected readonly obrigatoriedade = computed(() => this.item().obrigatoriedade ?? OBRIGATORIEDADE_SEMPRE);
  protected readonly opcionalQueExigeResposta = computed(() => this.exigeResposta() && this.obrigatoriedade() !== OBRIGATORIEDADE_SEMPRE);

  protected readonly condicoesDaExibicao = linkedSignal<PredicadoNoWire, readonly CondicaoEmClausula[]>({
    source: () => this.item().precondicao,
    computation: recopiarSeMudouPorFora,
  });

  protected readonly condicoesDaObrigatoriedade = linkedSignal<PredicadoNoWire, readonly CondicaoEmClausula[]>({
    source: () => this.item().predicadoObrigatoriedade ?? null,
    computation: recopiarSeMudouPorFora,
  });

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected idDe(parte: string): string {
    return `${this.idBase()}-${parte}`;
  }

  protected problemas(condicoes: readonly CondicaoEmClausula[]): Readonly<Record<number, string | undefined>> {
    return problemasDasCondicoes(condicoes, this.fatos());
  }

  protected trocar(mudanca: Partial<ItemDoFormulario>): void {
    this.itemChange.emit({ ...this.item(), ...mudanca });
  }

  /** Fora de "obrigatório quando", o predicado sai: a API recusa predicado sem a condicional. */
  protected trocarObrigatoriedade(obrigatoriedade: string): void {
    const condicional = obrigatoriedade === OBRIGATORIEDADE_QUANDO;
    if (!condicional) this.condicoesDaObrigatoriedade.set([]);
    this.trocar({
      obrigatoriedade,
      predicadoObrigatoriedade: condicional ? paraPredicado(this.condicoesDaObrigatoriedade()) : null,
    });
  }

  protected trocarObrigatorioQuando(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoesDaObrigatoriedade.set(condicoes);
    this.trocar({ predicadoObrigatoriedade: paraPredicado(condicoes) });
  }

  protected trocarExibicao(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoesDaExibicao.set(condicoes);
    this.trocar({ precondicao: paraPredicado(condicoes) });
  }
}
