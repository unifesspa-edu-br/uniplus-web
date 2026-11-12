import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  effect,
  inject,
  input,
} from '@angular/core';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import type { ItemDaJanelaDto } from '@uniplus/shared-data/autorizacao';
import { TagComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { CatalogoDePermissoesStore } from '../versoes/catalogo-de-permissoes.store';
import { situacaoDoItem } from './rotulos-da-janela';

/** As concessões da janela, com a situação de cada uma; a ação por linha vem do `ng-template` projetado. */
@Component({
  selector: 'cfg-tabela-da-janela',
  standalone: true,
  imports: [NgTemplateOutlet, TagComponent, DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-responsive">
      <table>
        <caption class="sr-only">
          {{
            legenda()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Pessoa</th>
            <th scope="col">Escopo</th>
            <th scope="col">Versão atual</th>
            <th scope="col">Válida até</th>
            <th scope="col">Acréscimo</th>
            <th scope="col">Situação</th>
            @if (acao(); as modelo) {
              <th scope="col">{{ tituloDaAcao() }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (item of itens(); track item.concessaoId) {
            <tr [attr.data-concessao-id]="item.concessaoId">
              <td data-label="Pessoa">
                {{ item.beneficiarioNome ?? 'Pessoa sem nome informado' }}
                @if (item.ehDoLeitor) {
                  <span class="cfg-muted">(você)</span>
                }
              </td>
              <td data-label="Escopo">{{ nomeDoEscopo()(item) }}</td>
              <td data-label="Versão atual">{{ item.versaoAtual ?? 'Sem versão' }}</td>
              <td data-label="Válida até">
                {{ item.validaAte ? (item.validaAte | dateBr: 'datetime') : 'Sem prazo' }}
              </td>
              <td data-label="Acréscimo">
                @for (codigo of item.acrescimo; track codigo) {
                  <code class="ui-code" [attr.title]="codigo">{{ nomeDaPermissao()(codigo) }}</code>
                  {{ ' ' }}
                } @empty {
                  Nenhum
                }
                @if (item.exigeProtecaoDeDados) {
                  <span class="cfg-muted">Passa pelo Representante do controlador.</span>
                }
              </td>
              <td data-label="Situação">
                <ui-tag [variant]="situacao(item).variante">{{ situacao(item).texto }}</ui-tag>
              </td>
              @if (acao(); as modelo) {
                <td [attr.data-label]="tituloDaAcao()">
                  <ng-container
                    [ngTemplateOutlet]="modelo"
                    [ngTemplateOutletContext]="{ $implicit: item }"
                  />
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class TabelaDaJanelaComponent {
  readonly itens = input.required<readonly ItemDaJanelaDto[]>();
  readonly legenda = input.required<string>();
  readonly nomeDoEscopo = input.required<(item: ItemDaJanelaDto) => string>();
  readonly tituloDaAcao = input('Decisão');
  protected readonly acao = contentChild<TemplateRef<{ $implicit: ItemDaJanelaDto }>>('acao');
  private readonly catalogo = inject(CatalogoDePermissoesStore);
  private readonly permissoes = inject(PermissoesService);
  private readonly podeConsultarOCatalogo = computed(() =>
    this.permissoes.tem(PERMISSAO.autorizacao.permissoesConsultarCatalogo),
  );
  /** O nome legível da permissão; sem acesso ao catálogo, o próprio código. */
  protected readonly nomeDaPermissao = computed(() => {
    const porCodigo = this.podeConsultarOCatalogo() ? this.catalogo.porCodigo() : null;
    return (codigo: string): string => porCodigo?.get(codigo)?.nome ?? codigo;
  });

  constructor() {
    effect(() => {
      if (this.podeConsultarOCatalogo()) this.catalogo.garantir();
    });
  }

  protected situacao(item: ItemDaJanelaDto) {
    return situacaoDoItem(item.situacao);
  }
}
