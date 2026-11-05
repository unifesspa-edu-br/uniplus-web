import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { fatoEscolhivel } from '../../editor-de-condicoes/condicoes-de-fatos';
import { focarDepois } from '../foco';
import { ItemDoFormularioComponent } from '../item-do-formulario';
import { fatosDeMembroParaAcrescentar, nomesDosFatos } from '../modelo/catalogo-de-campos';
import { fatosOferecidos, predicadosSobreRespostasAnteriores } from '../modelo/citacoes';
import { LIMITES_DO_FORMULARIO } from '../modelo/constantes';
import {
  FATO_PARENTESCO,
  MAXIMO_DE_CAMPOS_DO_GRUPO,
  acrescentarCampoAoGrupo,
  camposDoGrupo,
  comCampoDoGrupo,
  moverCampoNoGrupo,
  quantidadeNoTeto,
  removerCampoDoGrupo,
  fatosCitaveisPeloCampoDoGrupo,
} from '../modelo/grupos';
import { type RecusaDaRestricao } from '../modelo/recusas';
import { fontesDasOpcoes } from '../modelo/restricoes-de-valor';
import {
  type ConteudoDoFormulario,
  type FatoDoFormulario,
  type GrupoDoFormulario,
  type ItemDoFormulario,
  type ResultadoDoGrupo,
} from '../modelo/tipos';

/**
 * Os campos de cada ocorrência de um grupo repetível — a lista, o que cada campo pode citar e o
 * acréscimo de campo. Devolve o grupo inteiro a cada mudança; a recusa e o efeito vão como anúncio.
 */
@Component({
  selector: 'ui-campos-do-grupo',
  standalone: true,
  imports: [ItemDoFormularioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../anfitriao.css',
  template: `
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
            (itemChange)="grupoChange.emit(comCampoDoGrupo(grupo(), $event))"
            (mover)="moverOCampo(campo, $event)"
            (remover)="removerOCampo(campo)"
          />
        </li>
      }
    </ol>

    <div class="editor-formulario__acrescentar">
      <div class="field">
        <label class="field__label" [for]="idBase() + '-acrescentar'"
          >Campo a acrescentar em {{ nome() }}</label
        >
        <select
          class="select"
          [id]="idBase() + '-acrescentar'"
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
  `,
})
export class CamposDoGrupoComponent {
  private readonly injector = inject(Injector);

  readonly grupo = input.required<GrupoDoFormulario>();
  /** O conteúdo inteiro: o que os campos do grupo podem citar depende do que vem antes. */
  readonly conteudo = input.required<ConteudoDoFormulario>();
  readonly catalogo = input.required<readonly FatoDoFormulario[]>();
  readonly idBase = input.required<string>();
  readonly exigemResposta = input<ReadonlySet<string>>(new Set());
  readonly disabled = input<boolean>(false);
  /** As recusas da API que apontam cada campo do grupo, pelo fato do campo. */
  readonly errosPorCampo = input<ReadonlyMap<string, readonly string[]>>(new Map());
  readonly recusasDasRestricoes = input<ReadonlyMap<string, readonly RecusaDaRestricao[]>>(
    new Map(),
  );
  /** Os campos que não podem sair, com o motivo. */
  readonly remocoesTravadas = input<ReadonlyMap<string, string>>(new Map());
  /** Os fatos de outra finalidade, que não podem entrar neste formulário. */
  readonly fatosIndisponiveis = input<readonly string[]>([]);

  readonly grupoChange = output<GrupoDoFormulario>();
  /** O que anunciar na região de status do editor: o acréscimo, o movimento ou a recusa. */
  readonly anuncio = output<string>();

  protected readonly escolhido = signal('');
  protected readonly nome = computed(() => this.grupo().rotulo.trim() || this.grupo().codigo);
  protected readonly campos = computed(() => camposDoGrupo(this.grupo()));
  private readonly nomes = computed(() => nomesDosFatos(this.catalogo()));
  protected readonly desativados = computed(
    () =>
      new Set(
        this.catalogo()
          .filter((fato) => !fato.ativo)
          .map((fato) => fato.codigo),
      ),
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

  protected readonly comCampoDoGrupo = comCampoDoGrupo;

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
      focarDepois(this.injector, `${this.idBase()}-acrescentar`);
      return `Campo “${campo.rotulo}” removido de ${this.nome()}.`;
    });
  }

  /** Aplica a edição aceita e anuncia o efeito, ou anuncia a recusa sem mexer no grupo. */
  private aplicar(resultado: ResultadoDoGrupo, depois: (grupo: GrupoDoFormulario) => string): void {
    if (!resultado.ok) {
      this.anuncio.emit(resultado.recusa);
      return;
    }
    this.grupoChange.emit(resultado.grupo);
    this.anuncio.emit(depois(resultado.grupo));
  }
}
