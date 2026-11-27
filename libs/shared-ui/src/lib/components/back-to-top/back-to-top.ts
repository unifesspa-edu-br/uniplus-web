import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NavigationEnd, Router, type Event as EventoDeRota } from '@angular/router';
import type { Subscription } from 'rxjs';
import { BackToTopScrollService } from './back-to-top.service';
import { alvoDoFocoAoTopo, prefereMovimentoReduzido } from './foco-ao-topo';
import { ObservacaoDoConteiner } from './observacao-do-conteiner';

/** Fração do intervalo rolável a partir da qual o botão aparece. */
const LIMITE_VISIBILIDADE = 0.3;

/**
 * Botão global "Voltar ao topo" do shell compartilhado.
 *
 * Observa o contêiner de rolagem principal do conteúdo — `main.page` por padrão
 * Ou o contêiner registrado por `uiBackToTopContainer` numa rota com
 * rolagem interna — e fica visível quando a posição atinge
 * `scrollTop / (scrollHeight - clientHeight) >= 0,30`. Acioná-lo leva
 * esse mesmo contêiner ao topo, sem animação sob `prefers-reduced-motion`
 * Rolagem de tabelas, diálogos, drawers ou da barra lateral não afeta o
 * botão porque o listener vive apenas no contêiner ativo.
 */
@Component({
  selector: 'ui-back-to-top',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'u-no-print' },
  template: `
    <button
      type="button"
      class="uni-back-to-top"
      [class.is-visible]="visivel()"
      [attr.aria-hidden]="visivel() ? null : 'true'"
      [attr.tabindex]="visivel() ? null : -1"
      aria-label="Voltar ao topo do conteúdo"
      (click)="voltarAoTopo()"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  `,
})
export class BackToTopComponent {
  /**
   * Contêiner de rolagem padrão do conteúdo. O shell passa `main.page`; uma rota
   * com rolagem principal interna sobrepõe isto via `uiBackToTopContainer`.
   */
  readonly defaultContainer = input<HTMLElement | null>(null);

  /**
   * Alvo do foco ao voltar ao topo, para quando o contêiner de rolagem não pode
   * recebê-lo (ex.: `<html>`, que não tem `tabindex`). Sem ele, vale o próprio
   * contêiner se declarar `tabindex`.
   */
  readonly focoAoTopo = input<HTMLElement | null>(null);

  private readonly scrollService = inject(BackToTopScrollService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly visivel = signal(false);

  /** O contêiner efetivamente observado: o registrado pela rota, ou o padrão. */
  private readonly containerAtivo = computed<HTMLElement | null>(
    () => this.scrollService.containerPrincipal() ?? this.defaultContainer(),
  );

  private navTimer: ReturnType<typeof setTimeout> | null = null;
  private destruido = false;
  private readonly observacao = new ObservacaoDoConteiner(() => this.recalcular());

  constructor() {
    this.reconciliarQuandoOConteinerMuda();
    const inscricao = this.router.events.subscribe((evento) => this.aoNavegar(evento));
    this.destroyRef.onDestroy(() => this.aoDestruir(inscricao));
  }

  /**
   * Religa listener e observer e recalcula a visibilidade sempre que o contêiner
   * ativo muda de referência: troca de rota que monta ou desmonta um
   * `uiBackToTopContainer`, ou o `main.page` do shell ficando disponível depois
   * do primeiro render. Fica fora do ciclo de detecção em curso porque
   * `reconciliar()` grava `visivel`, o que no meio da verificação de mudanças do
   * Angular dispararia NG0100.
   */
  private reconciliarQuandoOConteinerMuda(): void {
    effect(() => {
      this.containerAtivo();
      untracked(() => queueMicrotask(() => this.reconciliar()));
    });
  }

  /**
   * `main.page` é o mesmo elemento entre rotas do app (o `ui-app-shell` não é
   * recriado), então o efeito acima não dispara na navegação. Os filhos que o
   * ResizeObserver acompanha, porém, foram trocados pelo conteúdo da rota nova:
   * religa para reapontar o observer, além de recalcular.
   *
   * `setTimeout`, não `queueMicrotask`: o conteúdo da rota nova só entra no DOM
   * na detecção de mudanças que segue o `NavigationEnd`; medir antes pegaria os
   * filhos e as dimensões da rota anterior. Redirects encadeados coalescem num
   * único religamento.
   */
  private aoNavegar(evento: EventoDeRota): void {
    if (!(evento instanceof NavigationEnd)) return;
    this.cancelarReligamentoPendente();
    this.navTimer = setTimeout(() => {
      this.navTimer = null;
      this.reconciliar();
    });
  }

  private cancelarReligamentoPendente(): void {
    if (this.navTimer !== null) clearTimeout(this.navTimer);
  }

  private aoDestruir(inscricao: Subscription): void {
    this.destruido = true;
    this.cancelarReligamentoPendente();
    inscricao.unsubscribe();
    this.observacao.parar();
  }

  /** Religa listener + observer ao contêiner ativo e recalcula a visibilidade. */
  private reconciliar(): void {
    if (this.destruido) return;
    // `visivel` é reconciliado pelo `recalcular()` que segue toda religação,
    // inclusive para contêiner `null`.
    this.observacao.observar(this.containerAtivo());
    this.recalcular();
  }

  /** Recalcula a visibilidade pelo percentual rolado do contêiner ativo. */
  recalcular(): void {
    const alvo = this.containerAtivo();
    if (alvo === null) {
      this.visivel.set(false);
      return;
    }
    const intervalo = alvo.scrollHeight - alvo.clientHeight;
    this.visivel.set(intervalo > 0 && alvo.scrollTop / intervalo >= LIMITE_VISIBILIDADE);
  }

  protected voltarAoTopo(): void {
    const alvo = this.containerAtivo();
    if (alvo === null) return;
    const behavior = prefereMovimentoReduzido() ? 'auto' : 'smooth';
    alvo.scrollTo({ top: 0, behavior });
    alvoDoFocoAoTopo(alvo, this.defaultContainer(), this.focoAoTopo())?.focus({
      preventScroll: true,
    });
  }
}
