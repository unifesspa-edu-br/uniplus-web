import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { TagComponent } from '../tag/tag';

/** A exigência condicional vale só para quem está na situação que o edital descreve. */
const APLICABILIDADE_CONDICIONAL = 'CONDICIONAL';

/** Um documento que o processo exige, como o certame publicado o descreve. */
export interface DocumentoExigido {
  readonly rotulo: string;
  /** `GERAL` ou `CONDICIONAL`, como o certame publica a exigência. */
  readonly aplicabilidade?: string;
  /**
   * Como a exigência vale para o candidato, quando as respostas dele já foram avaliadas: no lugar de
   * dizer a quem ela se aplica.
   */
  readonly situacao?: string;
  readonly obrigatorio: boolean;
  readonly formatos: { readonly qualquer: boolean; readonly lista: readonly string[] | null };
  readonly modelo: {
    readonly nomeArquivo: string;
    readonly formato: string;
    readonly urlDownload: string;
  } | null;
}

/**
 * A lista dos documentos que o processo exige: o nome, se é obrigatório, a quem se aplica, os formatos
 * aceitos e o modelo para baixar, quando a exigência oferece um. O nome de cada documento é um `h4`: a
 * lista fica sempre sob um `h3` — a seção do formulário.
 */
@Component({
  selector: 'ui-lista-de-documentos',
  standalone: true,
  imports: [TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Um cartão por documento, com a obrigatoriedade escrita na etiqueta — não só pela cor (WCAG 1.4.1).
  styles: `
    .lista-de-documentos {
      display: grid;
      gap: var(--space-3);
      max-width: 68ch;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .lista-de-documentos__item {
      display: grid;
      gap: var(--space-1);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
    }
    .lista-de-documentos__cabeca {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }
    .lista-de-documentos__nome {
      margin: 0;
      font-size: inherit;
      font-weight: var(--weight-semibold);
      overflow-wrap: anywhere;
    }
    .lista-de-documentos__meta,
    .lista-de-documentos__vazia {
      margin: 0;
    }
    .lista-de-documentos__meta {
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }
    /* Sublinhado: link nu não pode depender só da cor (WCAG 1.4.1). */
    .lista-de-documentos__modelo {
      position: relative;
      display: inline-flex;
      align-items: center;
      align-self: flex-start;
      gap: var(--space-2);
      min-height: var(--touch-min);
      color: var(--text-link);
      font-weight: var(--weight-semibold);
      text-decoration: underline;
      text-underline-offset: 0.2em;
    }
    .lista-de-documentos__modelo:focus-visible {
      outline: none;
      border-radius: var(--radius-sm);
      box-shadow: var(--focus-ring);
    }
  `,
  template: `
    @if (documentos().length === 0) {
      <p class="lista-de-documentos__vazia">{{ semDocumentos() }}</p>
    } @else {
      <ul class="lista-de-documentos" role="list">
        @for (documento of documentos(); track $index) {
          <li class="lista-de-documentos__item">
            <div class="lista-de-documentos__cabeca">
              <h4 class="lista-de-documentos__nome">{{ documento.rotulo }}</h4>
              <!-- O termo para a exigência não obrigatória aguarda o PO: "Facultativo" é o que o portal já usa. -->
              <ui-tag [variant]="documento.obrigatorio ? 'warning' : 'neutral'">
                {{ documento.obrigatorio ? 'Obrigatório' : 'Facultativo' }}
              </ui-tag>
            </div>
            <p class="lista-de-documentos__meta">
              {{ aQuemSeAplica(documento) }} · {{ formatos(documento) }}
            </p>
            <!--
              Navegação simples ao acervo público: o arquivo é servido com o nome do download, sem
              passar pela API — nada de fetch nem de CORS.
            -->
            @if (documento.modelo; as modelo) {
              <a class="lista-de-documentos__modelo" [href]="modelo.urlDownload">
                <i class="pi pi-download" aria-hidden="true"></i>
                Baixar o modelo ({{ modelo.formato }})
                <span class="sr-only">
                  de {{ documento.rotulo }}:
                  {{ modelo.nomeArquivo }}
                </span>
              </a>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class ListaDeDocumentosComponent {
  readonly documentos = input.required<readonly DocumentoExigido[]>();
  /** O que dizer quando a lista é vazia: só quem hospeda sabe o que a ausência significa ali. */
  readonly semDocumentos = input.required<string>();

  protected aQuemSeAplica(documento: DocumentoExigido): string {
    if (documento.situacao) return documento.situacao;
    return documento.aplicabilidade === APLICABILIDADE_CONDICIONAL
      ? 'Só para quem está na situação descrita no edital'
      : 'Todo candidato';
  }

  protected formatos(documento: DocumentoExigido): string {
    const lista = documento.formatos.lista ?? [];
    return documento.formatos.qualquer || lista.length === 0
      ? 'Qualquer formato'
      : lista.join(', ');
  }
}
