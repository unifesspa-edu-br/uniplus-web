import {
  CAMINHO_DA_EXIBICAO,
  CAMINHO_DO_PREDICADO_DA_OBRIGATORIEDADE,
  CAMINHO_DO_TIPO_DA_OBRIGATORIEDADE,
  camposDaInclusaoDoCandidato,
  type CamposEditadosDoFormulario,
} from './modelo/campos-editados';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';

import { ValorLegivelDirective } from '../valor-legivel/valor-legivel.directive';
import { type CondicaoEmClausula } from '../editor-de-condicoes/condicoes/condicoes-em-clausulas';
import {
  nomesDoCatalogo,
  type FatoEscolhivel,
} from '../editor-de-condicoes/condicoes/fatos-escolhiveis';
import { EditorDeCondicoesComponent } from '../editor-de-condicoes/editor-de-condicoes';
import { TagComponent } from '../tag/tag';
import { CamposDoGrupoComponent } from './grupo/campos-do-grupo';
import { OcorrenciasDoGrupoComponent, type MudancaDeContagem } from './grupo/ocorrencias-do-grupo';
import { incluirCandidatoComoMembro } from './modelo/candidato-como-membro';
import { fatosOferecidos, predicadosDasRegras } from './modelo/citacoes';
import {
  LIMITES_DO_FORMULARIO,
  OBRIGATORIEDADES,
  OBRIGATORIEDADE_QUANDO,
  OBRIGATORIEDADE_SEMPRE,
} from './modelo/constantes';
import { fatosCitaveisPeloGrupo, motivoDaRemocaoTravadaDoGrupo } from './modelo/grupos';
import { type RecusaDaRestricao } from './modelo/recusas';
import {
  type ConteudoDoFormulario,
  type FatoDoFormulario,
  type GrupoDoFormulario,
  type PredicadoNoWire,
} from './modelo/tipos';
import {
  paraPredicado,
  problemasDasCondicoes,
  recopiarSeMudouPorFora,
} from './predicado-em-edicao';

const ANUNCIO_DO_CANDIDATO_INCLUIDO =
  'O candidato passa a ser um dos membros: o parentesco é o primeiro campo, sempre obrigatório.';

/**
 * Um grupo repetível do formulário (UNI-REQ-0146): o candidato responde os mesmos campos para cada
 * membro — a composição familiar, por exemplo. Edita o rótulo, quantas ocorrências, se o próprio
 * candidato é um dos membros, quando o grupo é obrigatório e exibido, e os campos de cada
 * ocorrência. Devolve o grupo inteiro a cada mudança; a recusa vai como anúncio.
 */
@Component({
  selector: 'ui-grupo-do-formulario',
  standalone: true,
  imports: [
    ValorLegivelDirective,
    EditorDeCondicoesComponent,
    OcorrenciasDoGrupoComponent,
    CamposDoGrupoComponent,
    TagComponent,
  ],
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
        <ul class="editor-formulario__erros u-list">
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
            (input)="trocarRotulo(valorDe($event))"
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

      <ui-ocorrencias-do-grupo
        [grupo]="grupo()"
        [idBase]="idBase()"
        [disabled]="disabled()"
        (contagemChange)="trocarContagem($event)"
        (candidatoPedido)="alternarCandidato($event)"
      />

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

      <ui-campos-do-grupo
        [grupo]="grupo()"
        [conteudo]="conteudo()"
        [catalogo]="catalogo()"
        [idBase]="idBase()"
        [exigemResposta]="exigemResposta()"
        [disabled]="disabled()"
        [errosPorCampo]="errosPorCampo()"
        [recusasDasRestricoes]="recusasDasRestricoes()"
        [remocoesTravadas]="remocoesTravadas()"
        [fatosIndisponiveis]="fatosIndisponiveis()"
        (grupoChange)="emitir($event)"
        (camposEditados)="camposEditados.emit($event)"
        (anuncio)="anuncio.emit($event)"
      />

      @if (remocaoDoGrupoTravada(); as motivo) {
        <p class="field__hint" [id]="idDe('remocao-travada')">
          O grupo não pode ser removido: {{ motivo }}
        </p>
      }
    </article>
  `,
})
export class GrupoDoFormularioComponent {
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

  readonly camposEditados = output<CamposEditadosDoFormulario>();
  readonly grupoChange = output<GrupoDoFormulario>();
  readonly mover = output<-1 | 1>();
  readonly remover = output<void>();
  /** O que anunciar na região de status do editor: o acréscimo, o movimento ou a recusa. */
  readonly anuncio = output<string>();

  protected readonly limites = LIMITES_DO_FORMULARIO;
  protected readonly obrigatoriedades = OBRIGATORIEDADES;
  protected readonly quando = OBRIGATORIEDADE_QUANDO;

  protected readonly nome = computed(() => this.grupo().rotulo.trim() || this.grupo().codigo);
  protected readonly rotuloVazio = computed(() => this.grupo().rotulo.trim() === '');
  protected readonly obrigatoriedade = computed(
    () => this.grupo().regras.obrigatoriedade.tipo ?? OBRIGATORIEDADE_SEMPRE,
  );
  private readonly nomes = computed(() => nomesDoCatalogo(this.catalogo()));

  /** Remover o grupo leva os campos dele: o campo travado trava o grupo. */
  protected readonly remocaoDoGrupoTravada = computed(() =>
    motivoDaRemocaoTravadaDoGrupo(this.grupo(), this.remocoesTravadas()),
  );

  protected readonly fatosDoGrupo = computed(() =>
    fatosOferecidos(this.catalogo(), fatosCitaveisPeloGrupo(this.conteudo(), this.grupo()), [
      ...predicadosDasRegras(this.grupo().regras),
    ]),
  );

  protected readonly condicoesDaExibicao = linkedSignal<
    PredicadoNoWire,
    readonly CondicaoEmClausula[]
  >({
    source: () => this.grupo().regras.exibicao,
    computation: recopiarSeMudouPorFora,
  });

  protected readonly condicoesDaObrigatoriedade = linkedSignal<
    PredicadoNoWire,
    readonly CondicaoEmClausula[]
  >({
    source: () => this.grupo().regras.obrigatoriedade.predicado,
    computation: recopiarSeMudouPorFora,
  });

  protected idDe(parte: string): string {
    return `${this.idBase()}-${parte}`;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
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

  protected trocar(mudanca: Partial<GrupoDoFormulario>, campos: CamposEditadosDoFormulario): void {
    this.camposEditados.emit(campos);
    this.emitir({ ...this.grupo(), ...mudanca });
  }

  protected trocarRotulo(rotulo: string): void {
    this.trocar({ rotulo }, [['rotulo']]);
  }

  protected trocarContagem(mudanca: MudancaDeContagem): void {
    const ocorrencias = { ...this.grupo().ocorrencias, [mudanca.contagem]: mudanca.valor };
    this.trocar({ ocorrencias }, [['ocorrencias', mudanca.contagem]]);
  }

  /** Fora de "obrigatório quando", o predicado sai: a API recusa predicado sem a condicional. */
  protected trocarObrigatoriedade(tipo: string): void {
    const condicional = tipo === OBRIGATORIEDADE_QUANDO;
    if (!condicional) this.condicoesDaObrigatoriedade.set([]);
    const predicado = condicional ? paraPredicado(this.condicoesDaObrigatoriedade()) : null;
    this.trocar({ regras: { ...this.grupo().regras, obrigatoriedade: { tipo, predicado } } }, [
      CAMINHO_DO_TIPO_DA_OBRIGATORIEDADE,
      CAMINHO_DO_PREDICADO_DA_OBRIGATORIEDADE,
    ]);
  }

  protected trocarObrigatorioQuando(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoesDaObrigatoriedade.set(condicoes);
    const { regras } = this.grupo();
    const obrigatoriedade = { ...regras.obrigatoriedade, predicado: paraPredicado(condicoes) };
    this.trocar({ regras: { ...regras, obrigatoriedade } }, [
      CAMINHO_DO_PREDICADO_DA_OBRIGATORIEDADE,
    ]);
  }

  protected trocarExibicao(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoesDaExibicao.set(condicoes);
    const regras = { ...this.grupo().regras, exibicao: paraPredicado(condicoes) };
    this.trocar({ regras }, [CAMINHO_DA_EXIBICAO]);
  }

  protected alternarCandidato(ligado: boolean): void {
    if (ligado) this.incluirCandidato();
    else this.retirarCandidato();
  }

  private incluirCandidato(): void {
    const resultado = incluirCandidatoComoMembro(this.conteudo(), this.grupo(), {
      catalogo: this.catalogo(),
      nomes: this.nomes(),
      indisponiveis: this.fatosIndisponiveis(),
    });
    if (!resultado.ok) {
      this.anuncio.emit(resultado.recusa);
      return;
    }
    this.camposEditados.emit(camposDaInclusaoDoCandidato(resultado.grupo));
    this.emitir(resultado.grupo);
    this.anuncio.emit(ANUNCIO_DO_CANDIDATO_INCLUIDO);
  }

  private retirarCandidato(): void {
    const ocorrencias = { ...this.grupo().ocorrencias, incluiCandidato: false };
    this.trocar({ ocorrencias }, [['ocorrencias', 'incluiCandidato']]);
    this.anuncio.emit('O candidato deixa de ser um dos membros.');
  }
}
