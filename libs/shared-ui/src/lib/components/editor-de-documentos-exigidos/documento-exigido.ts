import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';

import {
  CONSEQUENCIAS_ESCOLHIVEIS,
  CONSEQUENCIA_REENVIO,
  consequenciasDaFase,
} from '@uniplus/shared-utils';
import { type CondicaoEmClausula } from '../editor-de-condicoes/condicoes/condicoes-em-clausulas';
import { type FatoEscolhivel } from '../editor-de-condicoes/condicoes/fatos-escolhiveis';
import { EditorDeCondicoesComponent } from '../editor-de-condicoes/editor-de-condicoes';
import type { PredicadoNoWire } from '../editor-de-formulario/modelo/tipos';
import {
  paraPredicado,
  problemasDasCondicoes,
  recopiarSeMudouPorFora,
} from '../editor-de-formulario/predicado-em-edicao';
import {
  type DocumentoExigidoDoFormulario,
  type OpcaoDoDocumento,
  type RecusasDoDocumento,
} from './documentos-exigidos';
import { NormasDoDocumentoComponent } from './normas-do-documento';

export const SEM_RECUSAS: RecusasDoDocumento = { quando: [], demais: [] };

/**
 * Um documento exigido: a fase e o tipo de documento, se é obrigatório, a consequência de não o
 * apresentar, de quem é cobrado (as condições sobre fatos) e as normas que o sustentam. Devolve o
 * documento inteiro a cada mudança.
 */
@Component({
  selector: 'ui-documento-exigido',
  standalone: true,
  imports: [EditorDeCondicoesComponent, NormasDoDocumentoComponent],
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
        <ul class="editor-formulario__erros u-list" role="alert">
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
        <ul class="editor-formulario__erros u-list" role="alert">
          @for (erro of recusas().quando; track $index) {
            <li class="field__error">{{ erro }}</li>
          }
        </ul>
      }

      <ui-normas-do-documento
        [bases]="basesLegais()"
        [idBase]="idBase()"
        [disabled]="disabled()"
        (basesChange)="trocar({ basesLegais: $event })"
      />
    </article>
  `,
})
export class DocumentoExigidoComponent {
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

function nomeDe(opcoes: readonly OpcaoDoDocumento[], codigo: string): string {
  return opcoes.find((opcao) => opcao.codigo === codigo)?.nome ?? codigo;
}
