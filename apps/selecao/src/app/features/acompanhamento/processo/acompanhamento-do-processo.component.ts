import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  EmptyStateComponent,
  FalhaDeLeituraComponent,
  PageHeaderComponent,
  SpinnerComponent,
  acompanharLeitura,
} from '@uniplus/shared-ui/components';

const TITULO_GENERICO = 'Acompanhamento';

const SITUACOES_RECUSADAS: ReadonlySet<SituacaoApresentada['estado']> = new Set([
  'nao-encontrado',
  'acesso-negado',
]);

/** Processo como a apresentação o conhece: só identificador e nome. */
export interface ProcessoDoAcompanhamento {
  readonly id: string;
  readonly nome: string;
}

/** O que a apresentação mostra; só `lido` carrega o processo, os demais nunca herdam um nome. */
export type SituacaoApresentada =
  | { readonly estado: 'lendo' }
  | { readonly estado: 'falha' }
  | { readonly estado: 'nao-encontrado' }
  | { readonly estado: 'acesso-negado' }
  | { readonly estado: 'lido'; readonly processo: ProcessoDoAcompanhamento };

/**
 * Apresentação da página de acompanhamento de um processo seletivo: cabeçalho, retorno ao painel e a
 * seção Acompanhamento, apresentada diretamente, sem seletor de aba única.
 *
 * Não lê a URL, não consulta HTTP nem decide permissões. Recebe a situação e o destino do painel (o
 * retorno é um link, que abre também em nova aba) e comunica `tentarNovamente`. Pontos de integração,
 * ambos exibidos só com o processo carregado: `[acoesDoProcesso]` (ações do cabeçalho) e
 * `[conteudoDoAcompanhamento]` (corpo da seção, no lugar da mensagem de ausência).
 */
@Component({
  selector: 'sel-acompanhamento-do-processo',
  standalone: true,
  imports: [
    EmptyStateComponent,
    FalhaDeLeituraComponent,
    PageHeaderComponent,
    RouterLink,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './acompanhamento-do-processo.component.css',
  template: `
    <ui-page-header [heading]="titulo()">
      <div uiPageActions class="acompanhamento__acoes">
        <a class="btn btn--tertiary" [routerLink]="destinoDoPainel()">Voltar ao painel</a>
        @if (situacao().estado === 'lido') {
          <ng-content select="[acoesDoProcesso]" />
        }
      </div>
    </ui-page-header>

    <ui-falha-de-leitura
      titulo="Não foi possível carregar o processo seletivo"
      [leitura]="leitura"
    />

    @switch (situacao().estado) {
      @case ('lendo') {
        <p class="acompanhamento__espera" role="status" aria-busy="true">
          <ui-spinner spinnerSize="sm" />
          Carregando processo seletivo…
        </p>
      }
      @case ('nao-encontrado') {
        <ui-empty-state heading="Processo seletivo não encontrado" />
      }
      @case ('acesso-negado') {
        <ui-empty-state
          variant="error"
          heading="Acesso negado"
          description="Você não tem permissão para acompanhar este processo seletivo."
        />
      }
      @case ('lido') {
        <section aria-labelledby="acompanhamento-secao">
          <h2 id="acompanhamento-secao" class="acompanhamento__secao">Acompanhamento</h2>
          <ng-content select="[conteudoDoAcompanhamento]">
            <p class="acompanhamento__vazio">
              Não há informações de acompanhamento disponíveis no momento.
            </p>
          </ng-content>
        </section>
      }
    }
  `,
})
export class AcompanhamentoDoProcessoComponent {
  readonly situacao = input.required<SituacaoApresentada>();

  readonly destinoDoPainel = input.required<string>();

  readonly tentarNovamente = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** O nome só aparece depois do sucesso: nunca completa o cabeçalho com o processo anterior. */
  private readonly nome = computed(() => {
    const situacao = this.situacao();
    return situacao.estado === 'lido' ? situacao.processo.nome : null;
  });

  protected readonly titulo = computed(() => this.nome() ?? TITULO_GENERICO);

  protected readonly leitura = acompanharLeitura({
    falha: computed(() => (this.situacao().estado === 'falha' ? 'Tente novamente.' : null)),
    pendente: computed(() => this.situacao().estado === 'lendo'),
    recarregar: () => this.tentarNovamente.emit(),
    destino: () => this.host.nativeElement.querySelector('h1'),
    recusada: computed(() => SITUACOES_RECUSADAS.has(this.situacao().estado)),
  });
}
