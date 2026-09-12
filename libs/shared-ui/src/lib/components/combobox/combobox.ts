import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/** Uma escolha da lista. `value` é o que sai; `label` é o que a pessoa lê. */
export interface UiComboboxOption {
  readonly value: string;
  readonly label: string;
}

/** Escolhas sob um título — a categoria do cadastro, o tipo, o que agrupar signifique. */
export interface UiComboboxGroup {
  readonly label: string;
  readonly options: readonly UiComboboxOption[];
}

let comboboxIdSeed = 0;

/**
 * Campo de escolha com busca embutida: digitar filtra a lista, e a escolha sai pelo valor.
 *
 * Existe porque buscar num campo e escolher em outro obriga a pessoa a fazer o trabalho de
 * correlacionar os dois — ela digita, olha para o lado, e o que digitou não diz o que sobrou.
 * Aqui o que se digita e o que se escolhe são o mesmo campo.
 *
 * Segue o padrão de combobox com lista do WAI-ARIA: o campo anuncia que abre uma lista, a
 * lista é um `listbox` com `option`s agrupadas, e a opção sob o cursor do teclado é apontada
 * por `aria-activedescendant` — o foco nunca sai do campo, que é o que deixa continuar
 * digitando enquanto se navega.
 *
 * Nativo, sem biblioteca: o catálogo do design system não traz este componente, e o que a
 * biblioteca de terceiros entregaria pronto é o comportamento — o visual teria de ser escrito
 * de qualquer forma, porque o tema dela não é o do produto (ADR-0023).
 */
@Component({
  selector: 'ui-combobox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:mousedown)': 'aoClicarNoDocumento($event.target)' },
  template: `
    <div class="combobox" [class.is-open]="aberto()">
      <input
        class="input combobox__campo"
        type="text"
        role="combobox"
        autocomplete="off"
        [id]="campoId"
        [attr.aria-expanded]="aberto()"
        [attr.aria-controls]="listaId"
        [attr.aria-activedescendant]="aberto() && destacada() !== null ? opcaoId(destacada()!) : null"
        aria-autocomplete="list"
        [attr.aria-describedby]="contagemId"
        [attr.placeholder]="placeholder()"
        [disabled]="disabled()"
        [value]="texto()"
        (input)="digitar($any($event.target).value)"
        (keydown)="teclar($event)"
        (focus)="abrir()"
      />

      @if (aberto()) {
        <ul
          class="combobox__lista"
          role="listbox"
          [id]="listaId"
          [attr.aria-label]="rotulo()"
          [attr.aria-multiselectable]="multiplo() ? 'true' : null"
        >
          @for (grupo of gruposVisiveis(); track grupo.label) {
            <li role="presentation">
              <p class="combobox__grupo" [id]="grupoId(grupo.label)">{{ grupo.label }}</p>
              <ul role="group" [attr.aria-labelledby]="grupoId(grupo.label)">
                @for (opcao of grupo.options; track opcao.value) {
                  <li
                    class="combobox__opcao"
                    role="option"
                    [id]="opcaoId(opcao.value)"
                    [class.is-destacada]="destacada() === opcao.value"
                    [attr.aria-selected]="marcada(opcao.value)"
                    (mousedown)="escolherComOMouse($event, opcao.value)"
                    (mousemove)="destacada.set(opcao.value)"
                  >
                    {{ opcao.label }}
                  </li>
                }
              </ul>
            </li>
          }
          @if (alcancadas() === 0) {
            <li class="combobox__vazio" role="presentation">{{ textoSemResultado() }}</li>
          }
        </ul>
      }
    </div>

    <!--
      A contagem é anunciada a cada busca: quem não enxerga a lista precisa saber se o que
      digitou alcançou alguma coisa antes de apertar a seta para baixo.
    -->
    <p class="field__hint" role="status" [id]="contagemId">{{ contagem() }}</p>
  `,
})
export class ComboboxComponent {
  private readonly hospedeiro = inject(ElementRef<HTMLElement>);
  private readonly semente = (comboboxIdSeed += 1);

  readonly campoId = `ui-combobox-${this.semente}`;
  protected readonly listaId = `ui-combobox-lista-${this.semente}`;
  protected readonly contagemId = `ui-combobox-contagem-${this.semente}`;

  /** Como a lista se chama para quem usa leitor de tela. */
  readonly rotulo = input.required<string>();
  readonly grupos = input.required<readonly UiComboboxGroup[]>();
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
  readonly disabled = input<boolean>(false);
  /** O que dizer quando a busca não alcança nada — o assunto é de quem usa o campo. */
  readonly textoSemResultado = input<string>('Nada encontrado.');

  /**
   * Aceita mais de uma escolha. Neste modo a lista não fecha ao escolher — quem marca três
   * modalidades não quer reabrir a lista três vezes — e o campo mostra o que já foi marcado.
   */
  readonly multiplo = input(false, { transform: booleanAttribute });
  readonly values = input<readonly string[]>([]);

  readonly valueChange = output<string>();
  readonly valuesChange = output<readonly string[]>();

  protected readonly aberto = signal(false);
  protected readonly destacada = signal<string | null>(null);

  /** O que está escrito no campo: a busca em curso, ou o rótulo do que já foi escolhido. */
  private readonly busca = signal<string | null>(null);

  protected readonly texto = computed(() => {
    const digitado = this.busca();
    if (digitado !== null) return digitado;

    if (this.multiplo()) {
      // Os rótulos do que está marcado, na ordem em que a lista os apresenta: o campo
      // fechado é o resumo da escolha, e é por ele que se confere sem reabrir.
      const marcados = new Set(this.values());
      return this.todasAsOpcoes()
        .filter((opcao) => marcados.has(opcao.value))
        .map((opcao) => opcao.label)
        .join(', ');
    }

    const escolhido = this.value();
    if (escolhido === '') return '';
    return this.todasAsOpcoes().find((opcao) => opcao.value === escolhido)?.label ?? '';
  });

  /** Se a opção está marcada — no modo simples, a escolha; no múltiplo, uma das escolhas. */
  protected marcada(value: string): boolean {
    return this.multiplo() ? this.values().includes(value) : this.value() === value;
  }

  private readonly todasAsOpcoes = computed<readonly UiComboboxOption[]>(() =>
    this.grupos().flatMap((grupo) => grupo.options),
  );

  /**
   * Os grupos que sobram depois da busca. Ela alcança o rótulo da opção e o do grupo — quem
   * digita "renda" quer tanto a categoria quanto cada comprovante dentro dela —, e ignora
   * acento e caixa, que é como as pessoas digitam.
   */
  protected readonly gruposVisiveis = computed<readonly UiComboboxGroup[]>(() => {
    const termo = normalizar(this.busca() ?? '');
    if (termo === '') return this.grupos();

    return this.grupos()
      .map((grupo) => ({
        ...grupo,
        options: normalizar(grupo.label).includes(termo)
          ? grupo.options
          : grupo.options.filter((opcao) => normalizar(opcao.label).includes(termo)),
      }))
      .filter((grupo) => grupo.options.length > 0);
  });

  protected readonly alcancadas = computed(() =>
    this.gruposVisiveis().reduce((total, grupo) => total + grupo.options.length, 0),
  );

  protected readonly contagem = computed(() => {
    const total = this.alcancadas();
    const termo = this.busca() ?? '';
    if (termo === '') {
      return total === 1 ? '1 opção disponível.' : `${total} opções disponíveis.`;
    }
    if (total === 0) return `Nada encontrado para “${termo}”.`;
    return total === 1 ? `1 opção casa com “${termo}”.` : `${total} opções casam com “${termo}”.`;
  });

  /** A lista, achatada na ordem em que aparece — é por ela que as setas andam. */
  private readonly navegaveis = computed<readonly string[]>(() =>
    this.gruposVisiveis().flatMap((grupo) => grupo.options.map((opcao) => opcao.value)),
  );

  protected opcaoId(value: string): string {
    return `${this.campoId}-op-${value}`;
  }

  protected grupoId(label: string): string {
    return `${this.campoId}-gr-${label.replace(/\W+/g, '-').toLowerCase()}`;
  }

  protected abrir(): void {
    if (this.disabled()) return;
    this.aberto.set(true);
  }

  protected digitar(termo: string): void {
    this.busca.set(termo);
    this.aberto.set(true);
    // Sem destacar nada: com a lista apenas sugerida, quem aperta a seta para baixo espera
    // chegar à PRIMEIRA opção. Destacar ao digitar faria a primeira seta pular para a
    // segunda, e um Enter distraído escolheria o que ninguém apontou.
    this.destacada.set(null);
  }

  /**
   * `mousedown`, e não `click`: o clique só chega depois que o campo perde o foco, e é o
   * `blur` que fecha a lista — a opção sairia debaixo do cursor antes de ser escolhida.
   */
  protected escolherComOMouse(evento: MouseEvent, value: string): void {
    evento.preventDefault();
    this.escolher(value);
  }

  protected teclar(evento: KeyboardEvent): void {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!this.aberto()) {
        this.aberto.set(true);
        return;
      }
      this.andar(evento.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (evento.key === 'Home' || evento.key === 'End') {
      if (!this.aberto()) return;
      evento.preventDefault();
      const lista = this.navegaveis();
      this.destacada.set((evento.key === 'Home' ? lista[0] : lista[lista.length - 1]) ?? null);
      return;
    }

    if (evento.key === 'Enter') {
      const alvo = this.destacada();
      if (!this.aberto() || alvo === null) return;
      evento.preventDefault();
      this.escolher(alvo);
      return;
    }

    if (evento.key === 'Escape') {
      // Fecha sem escolher, e devolve o campo ao que ele mostrava antes da busca.
      evento.preventDefault();
      this.fechar();
      return;
    }

    if (evento.key === 'Tab') this.fechar();
  }

  private andar(passo: number): void {
    const lista = this.navegaveis();
    if (lista.length === 0) return;

    const atual = lista.indexOf(this.destacada() ?? '');
    // Sem nada destacado, a seta para baixo começa no primeiro e a de cima no último.
    const proximo =
      atual === -1
        ? passo > 0
          ? 0
          : lista.length - 1
        : (atual + passo + lista.length) % lista.length;
    this.destacada.set(lista[proximo]);
  }

  private escolher(value: string): void {
    if (this.multiplo()) {
      const marcados = this.values();
      this.valuesChange.emit(
        marcados.includes(value)
          ? marcados.filter((item) => item !== value)
          : [...marcados, value],
      );
      // A lista fica aberta e o termo é limpo: marcar a próxima parte da lista inteira.
      this.busca.set(null);
      return;
    }

    this.valueChange.emit(value);
    this.busca.set(null);
    this.destacada.set(null);
    this.aberto.set(false);
  }

  private fechar(): void {
    this.busca.set(null);
    this.destacada.set(null);
    this.aberto.set(false);
  }

  /**
   * Clique fora fecha. Ouvir no documento, e não o `blur` do campo, porque o clique numa
   * opção passa pelo `blur` antes de virar escolha.
   */
  protected aoClicarNoDocumento(alvo: EventTarget | null): void {
    if (!this.aberto()) return;
    if (alvo instanceof Node && this.hospedeiro.nativeElement.contains(alvo)) return;
    this.fechar();
  }
}

/** Sem acento e sem caixa: é como as pessoas digitam, e não é como o cadastro grava. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
