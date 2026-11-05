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

import { type FatoEscolhivel } from '../editor-de-condicoes/condicoes/fatos-escolhiveis';
import { focarDepois } from '../editor-de-formulario/foco';
import {
  documentoExigidoNovo,
  type DocumentoExigidoDoFormulario,
  type OpcaoDoDocumento,
  type RecusasDoDocumento,
} from './documentos-exigidos';
import { DocumentoExigidoComponent, SEM_RECUSAS } from './documento-exigido';

/** A escolha do administrador enquanto ela segue no vocabulário; do contrário, a primeira opção. */
function manterOuPrimeira(
  opcoes: readonly OpcaoDoDocumento[],
  escolhida: string | undefined,
): string {
  return opcoes.find((opcao) => opcao.codigo === escolhida)?.codigo ?? opcoes[0]?.codigo ?? '';
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
        <ul class="editor-formulario__erros u-list" role="alert">
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
