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

import {
  type CondicaoEmClausula,
  type FatoEscolhivel,
} from '../editor-de-condicoes/condicoes-de-fatos';
import { EditorDeCondicoesComponent } from '../editor-de-condicoes/editor-de-condicoes';
import { focarDepois } from '../editor-de-formulario/foco';
import {
  paraPredicado,
  problemasDasCondicoes,
  recopiarSeMudouPorFora,
} from '../editor-de-formulario/predicado-em-edicao';
import type { PredicadoNoWire } from '../editor-de-formulario/formulario-editavel';
import {
  CONSEQUENCIAS_ESCOLHIVEIS,
  CONSEQUENCIA_REENVIO,
  consequenciasDaFase,
} from '@uniplus/shared-utils';
import {
  documentoExigidoNovo,
  type DocumentoExigidoDoFormulario,
  type RecusasDoDocumento,
} from './documentos-exigidos';
import { NormasDaExigenciaComponent } from './normas-da-exigencia';

/** Uma opção de vocabulário: fase canônica ou tipo de documento, pelo código. */
export interface OpcaoDoDocumento {
  readonly codigo: string;
  readonly nome: string;
  /** Só da fase: se ela admite complementação, que a consequência de reenvio exige. */
  readonly permiteComplementacao?: boolean;
}

const SEM_RECUSAS: RecusasDoDocumento = { quando: [], demais: [] };

/**
 * Um documento exigido: a fase e o tipo de documento, se é obrigatório, a consequência de não o
 * apresentar, de quem é cobrado (as condições sobre fatos) e as normas que o sustentam. Devolve o
 * documento inteiro a cada mudança.
 */
@Component({
  selector: 'ui-documento-exigido',
  standalone: true,
  imports: [EditorDeCondicoesComponent, NormasDaExigenciaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="editor-formulario__item" [attr.aria-labelledby]="idDe('titulo')">
      <div class="editor-formulario__cabecalho">
        <h4 class="editor-formulario__titulo-item" [id]="idDe('titulo')">
          {{ posicao() }}. {{ nomeDoTipo() }}
        </h4>
        <code>{{ documento().tipoDocumentoCodigo }}</code>
        <div class="editor-formulario__acoes-do-cabecalho">
          <button
            class="btn btn--tertiary btn--sm"
            type="button"
            [id]="idDe('remover')"
            [disabled]="disabled()"
            [attr.aria-label]="
              'Remover a exigência de ' + nomeDoTipo() + ' na fase ' + nomeDaFase()
            "
            (click)="remover.emit()"
          >
            Remover
          </button>
        </div>
      </div>

      @if (recusas().demais.length > 0) {
        <ul class="editor-formulario__erros" role="alert">
          @for (erro of recusas().demais; track $index) {
            <li class="field__error">{{ erro }}</li>
          }
        </ul>
      }

      <div class="form-grid">
        <div class="field">
          <label class="field__label is-required" [for]="idDe('fase')">Fase</label>
          <select
            class="select"
            [id]="idDe('fase')"
            [disabled]="disabled()"
            (change)="trocarFase(valorDe($event))"
          >
            @for (fase of fasesComAGravada(); track fase.codigo) {
              <option [value]="fase.codigo" [selected]="fase.codigo === documento().faseCodigo">
                {{ fase.nome }}
              </option>
            }
          </select>
        </div>

        <div class="field">
          <label class="field__label is-required" [for]="idDe('tipo')">Tipo de documento</label>
          <select
            class="select"
            [id]="idDe('tipo')"
            [disabled]="disabled()"
            (change)="trocar({ tipoDocumentoCodigo: valorDe($event) })"
          >
            @for (tipo of tiposComOGravado(); track tipo.codigo) {
              <option
                [value]="tipo.codigo"
                [selected]="tipo.codigo === documento().tipoDocumentoCodigo"
              >
                {{ tipo.nome }}
              </option>
            }
          </select>
        </div>

        <div class="field">
          <label class="field__label is-required" [for]="idDe('consequencia')"
            >Se o candidato não apresentar</label
          >
          <select
            class="select"
            [id]="idDe('consequencia')"
            [disabled]="disabled()"
            (change)="trocar({ consequenciaIndeferimento: valorDe($event) })"
          >
            @for (consequencia of consequencias(); track consequencia.valor) {
              <option
                [value]="consequencia.valor"
                [selected]="consequencia.valor === documento().consequenciaIndeferimento"
              >
                {{ consequencia.rotulo }}
              </option>
            }
          </select>
        </div>

        <div class="field">
          <label class="checkbox">
            <input
              type="checkbox"
              [checked]="documento().obrigatorio"
              [disabled]="disabled()"
              (change)="trocarObrigatorio($event)"
            />
            <span class="checkbox__box" aria-hidden="true"></span>
            Documento obrigatório
          </label>
        </div>
      </div>

      <ui-editor-de-condicoes
        legenda="Exigido só de quem atende a condição"
        textoSemCondicao="Exigido de todo candidato."
        [condicoes]="condicoes()"
        [fatos]="fatos()"
        [idBase]="idDe('quando')"
        [disabled]="disabled()"
        [erros]="problemas()"
        (condicoesChange)="trocarCondicoes($event)"
      />
      @if (recusas().quando.length > 0) {
        <ul class="editor-formulario__erros" role="alert">
          @for (erro of recusas().quando; track $index) {
            <li class="field__error">{{ erro }}</li>
          }
        </ul>
      }

      <fieldset class="editor-formulario__bases">
        <legend class="label">Normas que sustentam a exigência</legend>
        <div class="form-grid">
          <ui-normas-da-exigencia
            [bases]="basesLegais()"
            [idBase]="idBase()"
            [disabled]="disabled()"
            (basesChange)="trocar({ basesLegais: $event })"
          />
        </div>
      </fieldset>
    </article>
  `,
})
export class DocumentoExigidoComponent {
  private readonly injector = inject(Injector);

  readonly documento = input.required<DocumentoExigidoDoFormulario>();
  readonly posicao = input.required<number>();
  readonly fases = input.required<readonly OpcaoDoDocumento[]>();
  readonly tipos = input.required<readonly OpcaoDoDocumento[]>();
  readonly fatos = input.required<readonly FatoEscolhivel[]>();
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);
  /** Os fatos que o modelo coleta ou conhece antes; a condição que cita outro é marcada antes do envio. Nulo: sem conferência. */
  readonly citaveis = input<ReadonlySet<string> | null>(null);
  readonly recusas = input<RecusasDoDocumento>(SEM_RECUSAS);

  readonly documentoChange = output<DocumentoExigidoDoFormulario>();
  readonly remover = output<void>();

  protected readonly condicoes = linkedSignal<PredicadoNoWire, readonly CondicaoEmClausula[]>({
    source: () => this.documento().quando,
    computation: recopiarSeMudouPorFora,
  });

  protected readonly basesLegais = computed(() => this.documento().basesLegais ?? []);
  protected readonly problemas = computed(() => {
    const citaveis = this.citaveis();
    const problemas = { ...problemasDasCondicoes(this.condicoes(), this.fatos()) };
    this.condicoes().forEach((condicao, indice) => {
      const semConferir =
        problemas[indice] !== undefined || citaveis === null || condicao.fato === '';
      if (!semConferir && !citaveis.has(condicao.fato)) {
        problemas[indice] = 'o modelo não coleta este fato nem o conhece antes dele';
      }
    });
    return problemas;
  });

  /** O código gravado aparece mesmo que o vocabulário não o traga mais, para não trocá-lo sem aviso. */
  protected readonly fasesComAGravada = computed(() =>
    comOGravado(this.fases(), this.documento().faseCodigo),
  );
  protected readonly tiposComOGravado = computed(() =>
    comOGravado(this.tipos(), this.documento().tipoDocumentoCodigo),
  );
  /** O reenvio só vale em fase resolvida que admite complementação: o servidor o recusa nas demais. */
  protected readonly consequencias = computed(() => {
    const gravada = this.documento().consequenciaIndeferimento;
    const fase = this.fases().find((opcao) => opcao.codigo === this.documento().faseCodigo);
    const oferecidas = consequenciasDaFase(CONSEQUENCIAS_ESCOLHIVEIS, fase?.permiteComplementacao);
    return oferecidas.some((consequencia) => consequencia.valor === gravada)
      ? oferecidas
      : [{ valor: gravada, rotulo: gravada }, ...oferecidas];
  });

  protected readonly nomeDoTipo = computed(() =>
    nomeDe(this.tipos(), this.documento().tipoDocumentoCodigo),
  );
  protected readonly nomeDaFase = computed(() => nomeDe(this.fases(), this.documento().faseCodigo));

  protected idDe(parte: string): string {
    return `${this.idBase()}-${parte}`;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected trocar(mudanca: Partial<DocumentoExigidoDoFormulario>): void {
    this.documentoChange.emit({ ...this.documento(), ...mudanca });
  }

  /** Em fase que não admite complementação o reenvio sai: a consequência volta à primeira oferecida. */
  protected trocarFase(faseCodigo: string): void {
    const fase = this.fases().find((opcao) => opcao.codigo === faseCodigo);
    const perdeOReenvio =
      fase?.permiteComplementacao !== true &&
      this.documento().consequenciaIndeferimento === CONSEQUENCIA_REENVIO;
    this.trocar(
      perdeOReenvio
        ? { faseCodigo, consequenciaIndeferimento: CONSEQUENCIAS_ESCOLHIVEIS[0].valor }
        : { faseCodigo },
    );
  }

  protected trocarObrigatorio(evento: Event): void {
    this.trocar({ obrigatorio: (evento.target as HTMLInputElement).checked });
  }

  protected trocarCondicoes(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoes.set(condicoes);
    this.trocar({ quando: paraPredicado(condicoes) });
  }
}

function comOGravado(
  opcoes: readonly OpcaoDoDocumento[],
  gravado: string,
): readonly OpcaoDoDocumento[] {
  return opcoes.some((opcao) => opcao.codigo === gravado)
    ? opcoes
    : [{ codigo: gravado, nome: `${gravado} (fora do vocabulário)` }, ...opcoes];
}

/** A escolha do administrador enquanto ela segue no vocabulário; do contrário, a primeira opção. */
function manterOuPrimeira(
  opcoes: readonly OpcaoDoDocumento[],
  escolhida: string | undefined,
): string {
  return opcoes.find((opcao) => opcao.codigo === escolhida)?.codigo ?? opcoes[0]?.codigo ?? '';
}

function nomeDe(opcoes: readonly OpcaoDoDocumento[], codigo: string): string {
  return opcoes.find((opcao) => opcao.codigo === codigo)?.nome ?? codigo;
}

/**
 * O conjunto padrão de documentos exigidos de um modelo de formulário: a lista de documentos, com
 * a inclusão de um novo (fase e tipo escolhidos) e a remoção de cada um. Não guarda estado:
 * recebe a lista e devolve a lista inteira a cada mudança.
 */
@Component({
  selector: 'ui-editor-de-documentos-exigidos',
  standalone: true,
  imports: [DocumentoExigidoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'editor-formulario' },
  template: `
    <section class="editor-formulario__etapa" [attr.aria-labelledby]="idDe('titulo')">
      <h3 class="editor-formulario__titulo-etapa" [id]="idDe('titulo')">
        Documentos exigidos (padrão)
      </h3>
      <p class="field__hint">
        A mudança vale só para processos aos quais o modelo for aplicado depois dela; os processos
        já criados mantêm os documentos que têm.
      </p>

      @if (recusasGerais().length > 0) {
        <ul class="editor-formulario__erros" role="alert">
          @for (erro of recusasGerais(); track $index) {
            <li class="field__error">{{ erro }}</li>
          }
        </ul>
      }

      @for (documento of documentos(); track $index) {
        <ui-documento-exigido
          [documento]="documento"
          [posicao]="$index + 1"
          [fases]="fases()"
          [tipos]="tipos()"
          [fatos]="fatos()"
          [citaveis]="citaveis()"
          [idBase]="idDe('doc-' + $index)"
          [disabled]="disabled()"
          [recusas]="recusas().get(documento) ?? semRecusas"
          (documentoChange)="trocar($index, $event)"
          (remover)="remover($index)"
        />
      } @empty {
        <p class="field__hint">Nenhum documento exigido por padrão.</p>
      }

      <div class="form-grid">
        <div class="field">
          <label class="field__label" [for]="idDe('nova-fase')">Fase do documento novo</label>
          <select
            class="select"
            [id]="idDe('nova-fase')"
            [disabled]="disabled()"
            (change)="faseNova.set(valorDe($event))"
          >
            @for (fase of fases(); track fase.codigo) {
              <option [value]="fase.codigo" [selected]="fase.codigo === faseNova()">
                {{ fase.nome }}
              </option>
            }
          </select>
        </div>
        <div class="field">
          <label class="field__label" [for]="idDe('novo-tipo')">Tipo do documento novo</label>
          <select
            class="select"
            [id]="idDe('novo-tipo')"
            [disabled]="disabled()"
            (change)="tipoNovo.set(valorDe($event))"
          >
            @for (tipo of tipos(); track tipo.codigo) {
              <option [value]="tipo.codigo" [selected]="tipo.codigo === tipoNovo()">
                {{ tipo.nome }}
              </option>
            }
          </select>
        </div>
      </div>
      <div class="editor-formulario__acrescentar">
        <button
          class="btn btn--secondary"
          type="button"
          [id]="idDe('acrescentar')"
          [disabled]="disabled() || !podeAcrescentar()"
          (click)="acrescentar()"
        >
          Acrescentar documento
        </button>
      </div>
    </section>
  `,
})
export class EditorDeDocumentosExigidosComponent {
  private readonly injector = inject(Injector);

  readonly documentos = input.required<readonly DocumentoExigidoDoFormulario[]>();
  /** As fases canônicas, pelo código. */
  readonly fases = input.required<readonly OpcaoDoDocumento[]>();
  /** Os tipos de documento do cadastro, pelo código. */
  readonly tipos = input.required<readonly OpcaoDoDocumento[]>();
  /** Os fatos que a condição pode citar: os que o modelo coleta, deriva ou conhece antes. */
  readonly fatos = input.required<readonly FatoEscolhivel[]>();
  readonly citaveis = input<ReadonlySet<string> | null>(null);
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);
  /** As recusas da API, pelo documento enviado. */
  readonly recusas = input<ReadonlyMap<DocumentoExigidoDoFormulario, RecusasDoDocumento>>(
    new Map(),
  );
  readonly recusasGerais = input<readonly string[]>([]);

  readonly documentosChange = output<readonly DocumentoExigidoDoFormulario[]>();

  protected readonly semRecusas = SEM_RECUSAS;
  protected readonly faseNova = linkedSignal<readonly OpcaoDoDocumento[], string>({
    source: this.fases,
    computation: (fases, anterior) => manterOuPrimeira(fases, anterior?.value),
  });
  protected readonly tipoNovo = linkedSignal<readonly OpcaoDoDocumento[], string>({
    source: this.tipos,
    computation: (tipos, anterior) => manterOuPrimeira(tipos, anterior?.value),
  });
  protected readonly podeAcrescentar = computed(
    () => this.faseNova() !== '' && this.tipoNovo() !== '',
  );

  protected idDe(parte: string): string {
    return `${this.idBase()}-${parte}`;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLSelectElement).value;
  }

  protected trocar(indice: number, documento: DocumentoExigidoDoFormulario): void {
    this.documentosChange.emit(
      this.documentos().map((atual, posicao) => (posicao === indice ? documento : atual)),
    );
  }

  protected acrescentar(): void {
    if (!this.podeAcrescentar()) return;
    const indice = this.documentos().length;
    this.documentosChange.emit([
      ...this.documentos(),
      documentoExigidoNovo(this.faseNova(), this.tipoNovo()),
    ]);
    focarDepois(this.injector, this.idDe(`doc-${indice}-fase`));
  }

  /** O foco vai ao botão de remover do documento seguinte, ao anterior, ou ao de acrescentar. */
  protected remover(indice: number): void {
    this.documentosChange.emit(this.documentos().filter((_, posicao) => posicao !== indice));
    focarDepois(
      this.injector,
      this.idDe(`doc-${indice}-remover`),
      this.idDe(`doc-${indice - 1}-remover`),
      this.idDe('acrescentar'),
    );
  }
}
