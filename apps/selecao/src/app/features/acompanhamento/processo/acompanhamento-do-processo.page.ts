import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import {
  EmptyStateComponent,
  FalhaDeLeituraComponent,
  PageHeaderComponent,
  SpinnerComponent,
  acompanharLeitura,
} from '@uniplus/shared-ui/components';

import { PERMISSOES_DOS_ATALHOS_DO_ACOMPANHAMENTO } from '../../../acesso/permissoes-das-telas';
import { TrilhaContextual } from '../../../trilha-contextual';
import { atalhosDoAcompanhamento } from './atalhos-do-acompanhamento';
import { ConsultaDoAcompanhamento } from './consulta-do-acompanhamento';

const TITULO_GENERICO = 'Acompanhamento';

/**
 * Página contextual do acompanhamento de um processo seletivo. A seção Acompanhamento é
 * apresentada diretamente, sem seletor de abas. Não consulta indicadores nem inscrições: o
 * conteúdo fica disponível à integração posterior, e a mensagem de ausência só aparece após o
 * sucesso da leitura, nunca no lugar de carregamento, recusa ou falha.
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
  providers: [ConsultaDoAcompanhamento],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './acompanhamento-do-processo.page.css',
  template: `
    @let situacao = consulta.situacao();
    <ui-page-header [heading]="titulo()">
      <div uiPageActions class="acompanhamento__acoes">
        <a class="btn btn--tertiary" routerLink="/dashboard">Voltar ao painel</a>
        @for (atalho of atalhos(); track atalho.rotulo) {
          <a class="btn btn--secondary" [routerLink]="atalho.destino">{{ atalho.rotulo }}</a>
        }
      </div>
    </ui-page-header>

    <ui-falha-de-leitura
      titulo="Não foi possível carregar o processo seletivo"
      [leitura]="leitura"
    />

    @switch (situacao.estado) {
      @case ('lendo') {
        <p class="acompanhamento__espera" role="status">
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
          <p class="acompanhamento__vazio">
            Não há informações de acompanhamento disponíveis no momento.
          </p>
        </section>
      }
    }
  `,
})
export class AcompanhamentoDoProcessoPage {
  protected readonly consulta = inject(ConsultaDoAcompanhamento);
  private readonly permissoes = inject(PermissoesService);
  private readonly trilha = inject(TrilhaContextual);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** O nome só aparece depois do sucesso: nunca completa o cabeçalho com o processo anterior. */
  private readonly nome = computed(() => {
    const situacao = this.consulta.situacao();
    return situacao.estado === 'lido' ? situacao.processo.nome : null;
  });

  protected readonly leitura = acompanharLeitura({
    falha: computed(() =>
      this.consulta.situacao().estado === 'falha' ? 'Tente novamente.' : null,
    ),
    pendente: computed(() => this.consulta.situacao().estado === 'lendo'),
    recarregar: () => this.consulta.tentarNovamente(),
    destino: () => this.host.nativeElement.querySelector('h1'),
    recusada: computed(() =>
      ['nao-encontrado', 'acesso-negado'].includes(this.consulta.situacao().estado),
    ),
  });

  protected readonly titulo = computed(() => this.nome() ?? TITULO_GENERICO);

  protected readonly atalhos = computed(() => {
    const situacao = this.consulta.situacao();
    const pode =
      this.permissoes.estado() === 'carregada' &&
      this.permissoes.temAlguma(...PERMISSOES_DOS_ATALHOS_DO_ACOMPANHAMENTO);
    return situacao.estado === 'lido' ? atalhosDoAcompanhamento(situacao.processo, pode) : [];
  });

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((parametros) => this.consulta.abrir(parametros.get('id') ?? ''));
    effect(() => this.trilha.definir(trilhaDo(this.nome())));
    inject(DestroyRef).onDestroy(() => this.trilha.limpar());
  }
}

function trilhaDo(nome: string | null) {
  const painel = { label: 'Painel de processos', routerLink: '/dashboard' };
  return nome === null
    ? [painel, { label: TITULO_GENERICO }]
    : [painel, { label: nome }, { label: TITULO_GENERICO }];
}
