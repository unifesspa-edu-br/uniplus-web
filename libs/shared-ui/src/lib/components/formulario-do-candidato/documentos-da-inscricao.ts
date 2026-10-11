import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { AlertComponent } from '../alert/alert';
import { ListaDeDocumentosComponent } from '../lista-de-documentos/lista-de-documentos';
import { type DocumentoNaTela, type NoDeDocumentos, textoDoGrupo } from './documentos-avaliados';
import type { AvaliacaoNaTela, PendenciaDaAvaliacao } from './modalidades-avaliadas';

type GrupoDeDocumentos = Exclude<NoDeDocumentos, { tipo: 'DOCUMENTO' }>;

/** Um trecho de um nível da árvore: documentos seguidos, que formam uma lista, ou um grupo. */
type Trecho =
  | { readonly tipo: 'LISTA'; readonly documentos: readonly DocumentoNaTela[] }
  | { readonly tipo: 'GRUPO'; readonly grupo: GrupoDeDocumentos };

/**
 * Os documentos que o edital pede nesta fase diante das respostas dadas até agora, como a API os calcula
 * (ADR-0143): o que já é exigido, o que pode ser exigido conforme as respostas que faltam, e as escolhas
 * entre alternativas, em listas aninhadas com nome. Leva às perguntas que decidem os que ainda podem ser
 * exigidos.
 */
@Component({
  selector: 'ui-documentos-da-inscricao',
  standalone: true,
  imports: [AlertComponent, ListaDeDocumentosComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.aria-busy]': 'avaliacao().calculando' },
  styles: `
    .documentos-da-inscricao,
    .documentos-da-inscricao__grupo {
      display: grid;
      gap: var(--space-3);
      max-width: 68ch;
    }
    .documentos-da-inscricao p {
      margin: 0;
    }
    .documentos-da-inscricao__itens {
      display: grid;
      gap: var(--space-3);
      margin: 0;
      padding: 0 0 0 var(--space-4);
      border-inline-start: 2px solid var(--border-subtle);
      list-style: none;
    }
    .documentos-da-inscricao__atalhos {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
  `,
  template: `
    <ng-template #listaDeDocumentos let-documentos>
      <ui-lista-de-documentos [documentos]="documentos" [semDocumentos]="semDocumentos()" />
    </ng-template>

    <ng-template #grupoDeDocumentos let-grupo>
      <div class="documentos-da-inscricao__grupo">
        <p [id]="'documentos-' + grupo.chave">{{ texto(grupo) }}</p>
        <ul
          class="documentos-da-inscricao__itens"
          role="list"
          [attr.aria-labelledby]="'documentos-' + grupo.chave"
        >
          @for (item of grupo.itens; track $index) {
            <li>
              @if (item.tipo === 'DOCUMENTO') {
                <ng-container
                  *ngTemplateOutlet="listaDeDocumentos; context: { $implicit: [item.documento] }"
                />
              } @else {
                <ng-container *ngTemplateOutlet="grupoDeDocumentos; context: { $implicit: item }" />
              }
            </li>
          }
        </ul>
      </div>
    </ng-template>

    <div class="documentos-da-inscricao">
      @if (arvore() === null) {
        <p>Os documentos exigidos nesta fase são calculados a partir das respostas dadas.</p>
      } @else if (trechos().length === 0) {
        <p>{{ semDocumentos() }}</p>
      } @else {
        @for (trecho of trechos(); track $index) {
          @if (trecho.tipo === 'LISTA') {
            <ng-container
              *ngTemplateOutlet="listaDeDocumentos; context: { $implicit: trecho.documentos }"
            />
          } @else {
            <ng-container
              *ngTemplateOutlet="grupoDeDocumentos; context: { $implicit: trecho.grupo }"
            />
          }
        }
      }

      @if (pendencias().length > 0) {
        <p>Para saber se outros documentos são exigidos, falta responder:</p>
        <ul class="documentos-da-inscricao__atalhos">
          @for (pendencia of pendencias(); track pendencia.fatoCodigo) {
            <li>
              <button
                type="button"
                class="btn btn--tertiary btn--sm"
                (click)="irAoCampo.emit(pendencia.fatoCodigo)"
              >
                {{ pendencia.rotulo }}
              </button>
            </li>
          }
        </ul>
      }

      @if (avaliacao().erro; as erro) {
        <ui-alert variant="warning" [dynamic]="false">
          {{ erro }}
          <p>
            <button type="button" class="btn btn--secondary btn--sm" (click)="tentarDeNovo.emit()">
              Tentar de novo
            </button>
          </p>
        </ui-alert>
      }
    </div>
  `,
})
export class DocumentosDaInscricaoComponent {
  readonly avaliacao = input.required<AvaliacaoNaTela>();
  /** Os documentos desta fase, na árvore da escolha; nula antes da primeira avaliação dos documentos. */
  readonly arvore = input.required<readonly NoDeDocumentos[] | null>();
  /** O que falta responder para decidir os documentos desta fase que podem ser exigidos. */
  readonly pendencias = input<readonly PendenciaDaAvaliacao[]>([]);
  /** O que dizer quando nada é pedido nesta fase. */
  readonly semDocumentos = input.required<string>();

  /** O candidato escolheu a pergunta pendente: leva a ela. */
  readonly irAoCampo = output<string>();
  readonly tentarDeNovo = output<void>();

  /** O primeiro nível da árvore, com os documentos seguidos numa lista só. */
  protected readonly trechos = computed<readonly Trecho[]>(() => {
    const trechos: Trecho[] = [];
    for (const no of this.arvore() ?? []) {
      const ultimo = trechos.at(-1);
      if (no.tipo !== 'DOCUMENTO') {
        trechos.push({ tipo: 'GRUPO', grupo: no });
      } else if (ultimo?.tipo === 'LISTA') {
        trechos[trechos.length - 1] = {
          tipo: 'LISTA',
          documentos: [...ultimo.documentos, no.documento],
        };
      } else {
        trechos.push({ tipo: 'LISTA', documentos: [no.documento] });
      }
    }
    return trechos;
  });

  protected texto(grupo: GrupoDeDocumentos): string {
    return textoDoGrupo(grupo);
  }
}
