import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';

import { EditorDeCondicoesComponent } from '../editor-de-condicoes/editor-de-condicoes';
import {
  fatoEscolhivel,
  type CondicaoEmClausula,
  type FatoEscolhivel,
} from '../editor-de-condicoes/condicoes-de-fatos';
import { TagComponent } from '../tag/tag';
import {
  FATO_PARENTESCO,
  LIMITES_DO_FORMULARIO,
  MAXIMO_DE_CAMPOS_DO_GRUPO,
  OBRIGATORIEDADES,
  OBRIGATORIEDADE_QUANDO,
  OBRIGATORIEDADE_SEMPRE,
  acrescentarCampoAoGrupo,
  camposDoGrupo,
  comCampoDoGrupo,
  comCandidatoComoMembro,
  fatosCitaveisPeloCampoDoGrupo,
  fatosCitaveisPeloGrupo,
  fatosOferecidos,
  fatosDeMembroParaAcrescentar,
  fontesDasOpcoes,
  predicadosSobreRespostasAnteriores,
  motivoDaRemocaoTravadaDoGrupo,
  quantidadeNoTeto,
  moverCampoNoGrupo,
  removerCampoDoGrupo,
  type ConteudoDoFormulario,
  type FatoDoFormulario,
  type GrupoDoFormulario,
  type ItemDoFormulario,
  type PredicadoNoWire,
  type RecusaDaRestricao,
  type ResultadoDoGrupo,
} from './formulario-editavel';
import { focarDepois } from './foco';
import { ItemDoFormularioComponent } from './item-do-formulario';
import {
  paraPredicado,
  problemasDasCondicoes,
  recopiarSeMudouPorFora,
} from './predicado-em-edicao';

/**
 * Um grupo repetível do formulário (UNI-REQ-0146): o candidato responde os mesmos campos para cada
 * membro — a composição familiar, por exemplo. Edita o rótulo, quantas ocorrências, se o próprio
 * candidato é um dos membros, quando o grupo é obrigatório e exibido, e os campos de cada
 * ocorrência. Devolve o grupo inteiro a cada mudança; a recusa vai como anúncio.
 */
@Component({
  selector: 'ui-grupo-do-formulario',
  standalone: true,
  imports: [EditorDeCondicoesComponent, ItemDoFormularioComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="editor-formulario__item" [attr.aria-labelledby]="idDe('titulo')">
      <div class="editor-formulario__cabecalho">
        <h4 class="editor-formulario__titulo-item" [id]="idDe('titulo')">
          {{ posicao() }}. {{ nome() }}
        </h4>
        <ui-tag variant="info">Grupo repetível</ui-tag>
        <div
          class="editor-formulario__acoes-do-cabecalho"
          role="group"
          [attr.aria-label]="'Ações do grupo ' + nome()"
        >
          <button
            class="btn btn--tertiary btn--sm"
            type="button"
            [id]="idDe('subir')"
            [disabled]="disabled() || !podeSubir()"
            [attr.aria-label]="'Subir o grupo ' + nome()"
            (click)="mover.emit(-1)"
          >
            Subir
          </button>
          <button
            class="btn btn--tertiary btn--sm"
            type="button"
            [id]="idDe('descer')"
            [disabled]="disabled() || !podeDescer()"
            [attr.aria-label]="'Descer o grupo ' + nome()"
            (click)="mover.emit(1)"
          >
            Descer
          </button>
          <button
            class="btn btn--tertiary btn--sm"
            type="button"
            [disabled]="disabled() || remocaoDoGrupoTravada() !== null"
            [attr.aria-label]="'Remover o grupo ' + nome()"
            [attr.aria-describedby]="
              remocaoDoGrupoTravada() !== null ? idDe('remocao-travada') : null
            "
            (click)="remover.emit()"
          >
            Remover
          </button>
        </div>
      </div>

      @if (erros().length > 0) {
        <ul class="editor-formulario__erros">
          @for (erro of erros(); track $index) {
            <li class="field__error">{{ erro }}</li>
          }
        </ul>
      }

      <div class="form-grid">
        <div class="field" [class.is-error]="rotuloVazio()">
          <label class="field__label is-required" [for]="idDe('rotulo')">Rótulo do grupo</label>
          <input
            class="input"
            type="text"
            [id]="idDe('rotulo')"
            [value]="grupo().rotulo"
            [maxLength]="limites.rotulo"
            [disabled]="disabled()"
            [attr.aria-invalid]="rotuloVazio() ? 'true' : null"
            [attr.aria-describedby]="rotuloVazio() ? idDe('rotulo-erro') : null"
            (input)="trocar({ rotulo: valorDe($event) })"
          />
          @if (rotuloVazio()) {
            <span class="field__error" [id]="idDe('rotulo-erro')">O grupo precisa de rótulo.</span>
          }
        </div>

        <div class="field">
          <label class="field__label" [for]="idDe('obrigatoriedade')">Obrigatoriedade</label>
          <select
            class="select"
            [id]="idDe('obrigatoriedade')"
            [disabled]="disabled()"
            (change)="trocarObrigatoriedade(valorDe($event))"
          >
            @for (opcao of obrigatoriedades; track opcao.valor) {
              <option [value]="opcao.valor" [selected]="opcao.valor === obrigatoriedade()">
                {{ opcao.rotulo }}
              </option>
            }
          </select>
        </div>
      </div>

      <fieldset
        class="editor-formulario__restricao"
        [attr.aria-describedby]="problemaDasOcorrencias() ? idDe('ocorrencias-erro') : null"
      >
        <legend class="field__label">Ocorrências</legend>
        <div class="form-grid form-grid--pair">
          <div class="field">
            <label class="field__label" [for]="idDe('minimo')">Mínimo</label>
            <input
              class="input"
              type="text"
              inputmode="numeric"
              [id]="idDe('minimo')"
              [value]="grupo().minimo"
              [disabled]="disabled() || grupo().incluiCandidato"
              [attr.aria-describedby]="grupo().incluiCandidato ? idDe('candidato-nota') : null"
              (change)="trocarContagem('minimo', $event)"
            />
          </div>
          <div class="field">
            <label class="field__label" [for]="idDe('maximo')">Máximo</label>
            <input
              class="input"
              type="text"
              inputmode="numeric"
              [id]="idDe('maximo')"
              [value]="grupo().maximo ?? ''"
              [disabled]="disabled()"
              [attr.aria-describedby]="idDe('maximo-nota')"
              (change)="trocarContagem('maximo', $event)"
            />
            <span class="field__hint" [id]="idDe('maximo-nota')"
              >Em branco: sem limite de ocorrências.</span
            >
          </div>
        </div>
        @if (problemaDasOcorrencias(); as problema) {
          <p class="field__error" [id]="idDe('ocorrencias-erro')">{{ problema }}</p>
        }
        <label class="checkbox">
          <input
            type="checkbox"
            [checked]="grupo().incluiCandidato"
            [disabled]="disabled()"
            [attr.aria-describedby]="idDe('candidato-nota')"
            (change)="alternarCandidato($event)"
          />
          <span class="checkbox__box" aria-hidden="true"></span>
          O próprio candidato é um dos membros
        </label>
        <span class="field__hint" [id]="idDe('candidato-nota')">
          Como na composição familiar: o candidato responde a própria ocorrência, reconhecida pelo
          parentesco, e o grupo tem ao menos uma ocorrência.
        </span>
      </fieldset>

      @if (obrigatoriedade() === quando) {
        <ui-editor-de-condicoes
          legenda="Grupo obrigatório quando"
          textoSemCondicao="Declare ao menos uma condição: sem ela, escolha Obrigatório ou Opcional."
          [condicoes]="condicoesDaObrigatoriedade()"
          [fatos]="fatosDoGrupo()"
          [idBase]="idDe('obrigatorio-quando')"
          [disabled]="disabled()"
          [erros]="problemas(condicoesDaObrigatoriedade(), fatosDoGrupo())"
          (condicoesChange)="trocarObrigatorioQuando($event)"
        />
      }

      <ui-editor-de-condicoes
        legenda="Exibir o grupo só quando"
        textoSemCondicao="O grupo é exibido sempre."
        textoSemFatos="Nenhum campo anterior pode ser citado: o grupo cita só o que vem antes dele."
        [condicoes]="condicoesDaExibicao()"
        [fatos]="fatosDoGrupo()"
        [idBase]="idDe('exibicao')"
        [disabled]="disabled()"
        [erros]="problemas(condicoesDaExibicao(), fatosDoGrupo())"
        (condicoesChange)="trocarExibicao($event)"
      />

      <p class="field__hint">
        Campo ou grupo opcional não alimenta agregado: o processo recusa, ao congelar, o que
        deixaria o agregado dizer que nenhum membro tem o valor.
      </p>

      <ol
        class="editor-formulario__itens"
        [attr.aria-label]="'Campos de cada ocorrência de ' + nome()"
      >
        @for (campo of campos(); track campo.fatoCodigo; let indice = $index) {
          <li>
            <ui-item-do-formulario
              [item]="campo"
              [posicao]="indice + 1"
              [nivelDoTitulo]="5"
              [fatos]="fatosDoCampo().get(campo.fatoCodigo) ?? []"
              [idBase]="idDoCampo(campo.fatoCodigo)"
              [exigeResposta]="exigemResposta().has(campo.fatoCodigo)"
              [fatoDesativado]="desativados().has(campo.fatoCodigo)"
              [podeSubir]="indice > 0"
              [podeDescer]="indice < campos().length - 1"
              [disabled]="disabled()"
              [erros]="errosPorCampo().get(campo.fatoCodigo) ?? []"
              [valoresConhecidos]="valoresConhecidos().get(campo.fatoCodigo) ?? []"
              [fontesDeOpcoes]="fontesDeOpcoes().get(campo.fatoCodigo) ?? []"
              [recusasDasRestricoes]="recusasDasRestricoes().get(campo.fatoCodigo) ?? []"
              [travadoPor]="travaDo(campo)"
              [remocaoTravadaPor]="remocoesTravadas().get(campo.fatoCodigo) ?? null"
              (itemChange)="emitir(comCampoDoGrupo(grupo(), $event))"
              (mover)="moverOCampo(campo, $event)"
              (remover)="removerOCampo(campo)"
            />
          </li>
        }
      </ol>

      <div class="editor-formulario__acrescentar">
        <div class="field">
          <label class="field__label" [for]="idDe('acrescentar')"
            >Campo a acrescentar em {{ nome() }}</label
          >
          <select
            class="select"
            [id]="idDe('acrescentar')"
            [disabled]="disabled() || paraAcrescentar().length === 0 || noTeto()"
            (change)="escolhido.set(valorDe($event))"
          >
            <option value="" [selected]="escolha() === ''">Escolha o fato do membro</option>
            @for (fato of paraAcrescentar(); track fato.codigo) {
              <option [value]="fato.codigo" [selected]="escolha() === fato.codigo">
                {{ fato.nome }}
              </option>
            }
          </select>
        </div>
        <button
          class="btn btn--secondary btn--sm"
          type="button"
          [disabled]="disabled() || escolha() === '' || noTeto()"
          (click)="acrescentarOCampo()"
        >
          <i class="pi pi-plus" aria-hidden="true"></i> Acrescentar campo ao grupo
        </button>
      </div>

      @if (remocaoDoGrupoTravada(); as motivo) {
        <p class="field__hint" [id]="idDe('remocao-travada')">
          O grupo não pode ser removido: {{ motivo }}
        </p>
      }

      <div
        class="editor-formulario__acoes"
        role="group"
        [attr.aria-label]="'Ações do grupo ' + nome()"
      >
        <button
          class="btn btn--tertiary btn--sm"
          type="button"
          [id]="idDe('subir')"
          [disabled]="disabled() || !podeSubir()"
          [attr.aria-label]="'Subir o grupo ' + nome()"
          (click)="mover.emit(-1)"
        >
          <i class="pi pi-arrow-up" aria-hidden="true"></i> Subir
        </button>
        <button
          class="btn btn--tertiary btn--sm"
          type="button"
          [id]="idDe('descer')"
          [disabled]="disabled() || !podeDescer()"
          [attr.aria-label]="'Descer o grupo ' + nome()"
          (click)="mover.emit(1)"
        >
          <i class="pi pi-arrow-down" aria-hidden="true"></i> Descer
        </button>
        <button
          class="btn btn--tertiary btn--sm"
          type="button"
          [disabled]="disabled() || remocaoDoGrupoTravada() !== null"
          [attr.aria-label]="'Remover o grupo ' + nome()"
          [attr.aria-describedby]="
            remocaoDoGrupoTravada() !== null ? idDe('remocao-travada') : null
          "
          (click)="remover.emit()"
        >
          <i class="pi pi-trash" aria-hidden="true"></i> Remover grupo
        </button>
      </div>
    </article>
  `,
})
export class GrupoDoFormularioComponent {
  private readonly injector = inject(Injector);

  readonly grupo = input.required<GrupoDoFormulario>();
  /** O conteúdo inteiro: o que o grupo e os campos dele podem citar depende do que vem antes. */
  readonly conteudo = input.required<ConteudoDoFormulario>();
  readonly catalogo = input.required<readonly FatoDoFormulario[]>();
  readonly posicao = input.required<number>();
  readonly idBase = input.required<string>();
  readonly exigemResposta = input<ReadonlySet<string>>(new Set());
  readonly podeSubir = input<boolean>(false);
  readonly podeDescer = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  /** As recusas da API que apontam o grupo, e as que apontam cada campo dele. */
  readonly erros = input<readonly string[]>([]);
  readonly errosPorCampo = input<ReadonlyMap<string, readonly string[]>>(new Map());
  /** As recusas da API que apontam uma restrição de um campo do grupo, pelo fato do campo. */
  readonly recusasDasRestricoes = input<ReadonlyMap<string, readonly RecusaDaRestricao[]>>(
    new Map(),
  );
  /** Os campos que não podem sair, com o motivo. */
  readonly remocoesTravadas = input<ReadonlyMap<string, string>>(new Map());
  /** Os fatos de outra finalidade, que não podem entrar neste formulário. */
  readonly fatosIndisponiveis = input<readonly string[]>([]);

  readonly grupoChange = output<GrupoDoFormulario>();
  readonly mover = output<-1 | 1>();
  readonly remover = output<void>();
  /** O que anunciar na região de status do editor: o acréscimo, o movimento ou a recusa. */
  readonly anuncio = output<string>();

  protected readonly limites = LIMITES_DO_FORMULARIO;
  protected readonly obrigatoriedades = OBRIGATORIEDADES;
  protected readonly quando = OBRIGATORIEDADE_QUANDO;
  protected readonly comCampoDoGrupo = comCampoDoGrupo;

  protected readonly escolhido = signal('');
  protected readonly nome = computed(() => this.grupo().rotulo.trim() || this.grupo().codigo);
  protected readonly rotuloVazio = computed(() => this.grupo().rotulo.trim() === '');
  protected readonly obrigatoriedade = computed(
    () => this.grupo().obrigatoriedade ?? OBRIGATORIEDADE_SEMPRE,
  );
  protected readonly campos = computed(() => camposDoGrupo(this.grupo()));
  protected readonly desativados = computed(
    () =>
      new Set(
        this.catalogo()
          .filter((fato) => !fato.ativo)
          .map((fato) => fato.codigo),
      ),
  );
  private readonly nomes = computed(
    () => new Map(this.catalogo().map((fato) => [fato.codigo, fato.nome])),
  );

  /** Remover o grupo leva os campos dele: o campo travado trava o grupo. */
  protected readonly remocaoDoGrupoTravada = computed(() =>
    motivoDaRemocaoTravadaDoGrupo(this.grupo(), this.remocoesTravadas()),
  );
  protected readonly paraAcrescentar = computed(() =>
    fatosDeMembroParaAcrescentar(this.conteudo(), this.catalogo(), this.fatosIndisponiveis()),
  );
  protected readonly noTeto = computed(
    () =>
      quantidadeNoTeto(this.conteudo()) >= LIMITES_DO_FORMULARIO.itens ||
      this.grupo().subitens.length >= MAXIMO_DE_CAMPOS_DO_GRUPO,
  );
  protected readonly escolha = computed(() =>
    this.paraAcrescentar().some((fato) => fato.codigo === this.escolhido()) ? this.escolhido() : '',
  );

  protected readonly fatosDoGrupo = computed(() =>
    fatosOferecidos(this.catalogo(), fatosCitaveisPeloGrupo(this.conteudo(), this.grupo()), [
      this.grupo().exibicao,
      this.grupo().predicadoObrigatoriedade,
    ]),
  );

  protected readonly fatosDoCampo = computed(
    () =>
      new Map(
        this.campos().map((campo) => [
          campo.fatoCodigo,
          fatosOferecidos(
            this.catalogo(),
            fatosCitaveisPeloCampoDoGrupo(this.conteudo(), this.grupo(), campo.fatoCodigo),
            predicadosSobreRespostasAnteriores(campo),
          ),
        ]),
      ),
  );

  /** Os campos de onde as opções de cada campo podem vir: os citáveis por ele cujas opções cabem nas dele. */
  protected readonly fontesDeOpcoes = computed(
    () =>
      new Map(
        this.campos().map((campo) => [
          campo.fatoCodigo,
          fontesDasOpcoes(
            this.catalogo(),
            fatosCitaveisPeloCampoDoGrupo(this.conteudo(), this.grupo(), campo.fatoCodigo),
            campo.fatoCodigo,
          ).map((fonte) => ({ codigo: fonte.codigo, nome: fonte.nome })),
        ]),
      ),
  );

  protected readonly valoresConhecidos = computed(() => {
    const porCodigo = new Map(this.catalogo().map((fato) => [fato.codigo, fato]));
    return new Map(
      this.campos().map((campo) => {
        const fato = porCodigo.get(campo.fatoCodigo);
        const escolhivel = fato === undefined ? null : fatoEscolhivel(fato);
        return [
          campo.fatoCodigo,
          escolhivel?.tipoDominio === 'CATEGORICO_ESTATICO' ? escolhivel.valores : [],
        ] as const;
      }),
    );
  });

  protected readonly problemaDasOcorrencias = computed(() => {
    const minimo = Number(this.grupo().minimo);
    const maximo = this.grupo().maximo === null ? null : Number(this.grupo().maximo);
    if (!Number.isInteger(minimo) || minimo < 0)
      return 'O mínimo é um número inteiro, a partir de zero.';
    if (maximo !== null && (!Number.isInteger(maximo) || maximo < 1))
      return 'O máximo é um número inteiro, a partir de um.';
    return maximo !== null && maximo < minimo ? 'O máximo não pode ficar abaixo do mínimo.' : null;
  });

  protected readonly condicoesDaExibicao = linkedSignal<
    PredicadoNoWire,
    readonly CondicaoEmClausula[]
  >({
    source: () => this.grupo().exibicao,
    computation: recopiarSeMudouPorFora,
  });

  protected readonly condicoesDaObrigatoriedade = linkedSignal<
    PredicadoNoWire,
    readonly CondicaoEmClausula[]
  >({
    source: () => this.grupo().predicadoObrigatoriedade,
    computation: recopiarSeMudouPorFora,
  });

  protected idDe(parte: string): string {
    return `${this.idBase()}-${parte}`;
  }

  protected idDoCampo(fatoCodigo: string): string {
    return `${this.idBase()}-campo-${fatoCodigo}`;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  /** O parentesco do grupo que inclui o candidato é sempre exibido e obrigatório: é por ele que a ocorrência do candidato se reconhece. */
  protected travaDo(campo: ItemDoFormulario): string | null {
    return this.grupo().incluiCandidato && campo.fatoCodigo === FATO_PARENTESCO
      ? 'Sempre exibido e obrigatório: o grupo inclui o candidato, e é pelo parentesco que a ocorrência dele se reconhece.'
      : null;
  }

  protected problemas(
    condicoes: readonly CondicaoEmClausula[],
    fatos: readonly FatoEscolhivel[],
  ): Readonly<Record<number, string | undefined>> {
    return problemasDasCondicoes(condicoes, fatos);
  }

  protected emitir(grupo: GrupoDoFormulario): void {
    this.grupoChange.emit(grupo);
  }

  protected trocar(mudanca: Partial<GrupoDoFormulario>): void {
    this.emitir({ ...this.grupo(), ...mudanca });
  }

  /** O número quando é inteiro; o texto como veio quando não é, para o problema dizer o quê. Máximo em branco é sem limite. */
  protected trocarContagem(contagem: 'minimo' | 'maximo', evento: Event): void {
    const texto = this.valorDe(evento).trim();
    const valor =
      texto === ''
        ? contagem === 'maximo'
          ? null
          : 0
        : Number.isFinite(Number(texto))
          ? Number(texto)
          : texto;
    this.trocar({ [contagem]: valor });
  }

  protected trocarObrigatoriedade(obrigatoriedade: string): void {
    const condicional = obrigatoriedade === OBRIGATORIEDADE_QUANDO;
    if (!condicional) this.condicoesDaObrigatoriedade.set([]);
    this.trocar({
      obrigatoriedade,
      predicadoObrigatoriedade: condicional
        ? paraPredicado(this.condicoesDaObrigatoriedade())
        : null,
    });
  }

  protected trocarObrigatorioQuando(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoesDaObrigatoriedade.set(condicoes);
    this.trocar({ predicadoObrigatoriedade: paraPredicado(condicoes) });
  }

  protected trocarExibicao(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoesDaExibicao.set(condicoes);
    this.trocar({ exibicao: paraPredicado(condicoes) });
  }

  protected alternarCandidato(evento: Event): void {
    // O navegador marca a caixa antes da recusa: ela volta ao estado real, que só muda se a edição for aceita.
    (evento.target as HTMLInputElement).checked = this.grupo().incluiCandidato;
    this.aplicar(
      comCandidatoComoMembro(
        this.conteudo(),
        this.grupo(),
        !this.grupo().incluiCandidato,
        this.catalogo(),
        this.nomes(),
        this.fatosIndisponiveis(),
      ),
      (grupo) =>
        grupo.incluiCandidato
          ? 'O candidato passa a ser um dos membros: o parentesco é o primeiro campo, sempre obrigatório.'
          : 'O candidato deixa de ser um dos membros.',
    );
  }

  protected acrescentarOCampo(): void {
    const fato = this.paraAcrescentar().find((f) => f.codigo === this.escolha());
    if (fato === undefined) return;
    this.aplicar(acrescentarCampoAoGrupo(this.conteudo(), this.grupo(), fato), () => {
      this.escolhido.set('');
      focarDepois(this.injector, `${this.idDoCampo(fato.codigo)}-rotulo`);
      return `Campo “${fato.nome}” acrescentado ao fim de ${this.nome()}.`;
    });
  }

  protected moverOCampo(campo: ItemDoFormulario, direcao: -1 | 1): void {
    this.aplicar(
      moverCampoNoGrupo(this.grupo(), campo.fatoCodigo, direcao, this.nomes()),
      (grupo) => {
        const posicao =
          camposDoGrupo(grupo).findIndex((c) => c.fatoCodigo === campo.fatoCodigo) + 1;
        const prefixo = this.idDoCampo(campo.fatoCodigo);
        focarDepois(
          this.injector,
          `${prefixo}-${direcao < 0 ? 'subir' : 'descer'}`,
          `${prefixo}-${direcao < 0 ? 'descer' : 'subir'}`,
        );
        return `“${campo.rotulo}” movido para a posição ${posicao} de ${grupo.subitens.length} em ${this.nome()}.`;
      },
    );
  }

  protected removerOCampo(campo: ItemDoFormulario): void {
    const travado = this.remocoesTravadas().get(campo.fatoCodigo);
    if (travado !== undefined) {
      this.anuncio.emit(travado);
      return;
    }
    this.aplicar(removerCampoDoGrupo(this.grupo(), campo.fatoCodigo, this.nomes()), () => {
      focarDepois(this.injector, this.idDe('acrescentar'));
      return `Campo “${campo.rotulo}” removido de ${this.nome()}.`;
    });
  }

  /** Aplica a edição aceita e anuncia o efeito, ou anuncia a recusa sem mexer no grupo. */
  private aplicar(resultado: ResultadoDoGrupo, depois: (grupo: GrupoDoFormulario) => string): void {
    if (!resultado.ok) {
      this.anuncio.emit(resultado.recusa);
      return;
    }
    this.emitir(resultado.grupo);
    this.anuncio.emit(depois(resultado.grupo));
  }
}
