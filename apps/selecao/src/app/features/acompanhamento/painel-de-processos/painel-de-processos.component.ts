import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  AlertComponent,
  DEFAULT_PAGE_SIZE_OPTIONS,
  EmptyStateComponent,
  ListFooterComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

/** Itens por página iniciais do painel; o operador troca pelo seletor do rodapé. */
export const TAMANHO_INICIAL_DO_PAINEL = 50;

/** Processo como o painel o apresenta: só identificador e nome. */
export interface ProcessoDoPainel {
  readonly id: string;
  readonly nome: string;
}

/**
 * Falha da consulta. `inicial` não deixa nada válido em tela; `navegacao`
 * aconteceu ao trocar de página e preserva a última página válida.
 */
export type FalhaDoPainel = 'inicial' | 'navegacao';

/** Condições em que a lista não pode ser mostrada, nem a paginação. */
export type RestricaoDoPainel = 'cursor-expirado' | 'acesso-negado';

/**
 * Apresentação do painel de processos seletivos (ADR-0017): recebe dados e estados de quem faz a
 * consulta e comunica as ações por outputs. Não consulta HTTP, não interpreta permissões nem
 * manipula cursores. Não apresenta total global, que a paginação por cursor não conhece.
 */
@Component({
  selector: 'sel-painel-de-processos',
  standalone: true,
  imports: [
    AlertComponent,
    EmptyStateComponent,
    ListFooterComponent,
    PageHeaderComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './painel-de-processos.component.css',
  template: `
    <ui-page-header heading="Painel de processos seletivos" />

    <div class="painel__corpo">
      @if (restricao() === 'acesso-negado') {
        <ui-empty-state
          variant="error"
          heading="Acesso negado"
          description="Você não tem permissão para acompanhar os processos seletivos."
        />
      } @else {
        <p class="painel__espera" role="status">
          @if (carregando()) {
            <ui-spinner spinnerSize="sm" />
            Carregando processos seletivos…
          }
        </p>

        @if (restricao() === 'cursor-expirado') {
          <ui-empty-state
            heading="A lista precisa ser atualizada"
            description="O tempo desta consulta expirou. Atualize a lista para voltar ao início."
          >
            <button
              type="button"
              class="btn btn--primary"
              data-acao="atualizar-lista"
              [attr.aria-disabled]="carregando() ? 'true' : null"
              (click)="aoAtualizarLista()"
            >
              Atualizar lista
            </button>
          </ui-empty-state>
        } @else if (falha() === 'inicial') {
          <ui-empty-state
            variant="error"
            heading="Não foi possível carregar os processos seletivos"
          >
            <button
              type="button"
              class="btn btn--primary"
              data-acao="tentar-novamente"
              [attr.aria-disabled]="carregando() ? 'true' : null"
              (click)="aoTentarNovamente()"
            >
              Tentar novamente
            </button>
          </ui-empty-state>
        } @else if (!aguardandoPrimeiraConsulta()) {
          @if (falha() === 'navegacao') {
            <ui-alert variant="warning" heading="Não foi possível carregar a outra página">
              Os processos abaixo são os da última página carregada.
              <div class="painel__nova-tentativa">
                <button
                  type="button"
                  class="btn btn--secondary btn--sm"
                  data-acao="tentar-novamente"
                  [attr.aria-disabled]="carregando() ? 'true' : null"
                  (click)="aoTentarNovamente()"
                >
                  Tentar novamente
                </button>
              </div>
            </ui-alert>
          }

          @if (processos().length > 0) {
            <ul
              class="painel__cartoes"
              aria-label="Processos seletivos"
              [attr.aria-busy]="carregando() ? 'true' : null"
            >
              @for (processo of processos(); track processo.id) {
                <li class="card painel__cartao">
                  <h2 class="card__title painel__nome">{{ processo.nome }}</h2>
                  <div class="card__footer">
                    <button
                      type="button"
                      class="btn btn--secondary btn--sm"
                      [attr.aria-label]="'Abrir acompanhamento de ' + processo.nome"
                      (click)="abrir.emit(processo.id)"
                    >
                      Abrir acompanhamento
                    </button>
                  </div>
                </li>
              }
            </ul>
          } @else if (falha() === null) {
            <ui-empty-state heading="Nenhum processo seletivo encontrado" />
          }

          <ui-list-footer
            navigationLabel="Paginação de processos seletivos"
            [pageSizeOptions]="opcoesDeTamanho"
            [pageSize]="tamanhoDePagina()"
            (pageSizeChange)="aoTrocarTamanho($event)"
            [hasRows]="processos().length > 0"
            [hasPrevious]="temAnterior()"
            [hasNext]="temProxima()"
            [isDisabled]="carregando()"
            (previous)="paginaAnterior.emit()"
            (next)="proximaPagina.emit()"
          />
        }
      }
    </div>
  `,
  host: { class: 'painel' },
})
export class PainelDeProcessosComponent {
  /** Itens da página, na ordem em que o consultante os entregou. */
  readonly processos = input<readonly ProcessoDoPainel[]>([]);
  readonly carregando = input<boolean>(false);
  readonly falha = input<FalhaDoPainel | null>(null);
  readonly restricao = input<RestricaoDoPainel | null>(null);
  readonly tamanhoDePagina = input<number>(TAMANHO_INICIAL_DO_PAINEL);
  readonly temAnterior = input<boolean>(false);
  readonly temProxima = input<boolean>(false);

  /** Identificador do processo escolhido. */
  readonly abrir = output<string>();
  readonly paginaAnterior = output<void>();
  readonly proximaPagina = output<void>();
  readonly tamanhoDePaginaChange = output<number>();
  readonly tentarNovamente = output<void>();
  readonly atualizarLista = output<void>();

  protected readonly opcoesDeTamanho = DEFAULT_PAGE_SIZE_OPTIONS;

  /** Espera inicial: sem nada para mostrar ainda, "vazio" seria resultado antecipado. */
  protected readonly aguardandoPrimeiraConsulta = computed(
    () => this.carregando() && this.processos().length === 0,
  );

  protected aoTentarNovamente(): void {
    if (!this.carregando()) {
      this.tentarNovamente.emit();
    }
  }

  protected aoAtualizarLista(): void {
    if (!this.carregando()) {
      this.atualizarLista.emit();
    }
  }

  protected aoTrocarTamanho(valor: number | null): void {
    if (valor !== null && valor !== this.tamanhoDePagina() && !this.carregando()) {
      this.tamanhoDePaginaChange.emit(valor);
    }
  }
}
