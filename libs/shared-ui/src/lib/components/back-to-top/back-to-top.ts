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
import { NavigationEnd, Router } from '@angular/router';
import { BackToTopScrollService } from './back-to-top.service';

/** Fração do intervalo rolável a partir da qual o botão aparece (CA-02/CA-03). */
const LIMITE_VISIBILIDADE = 0.3;

/**
 * Botão global "Voltar ao topo" do shell compartilhado.
 *
 * Observa o contêiner de rolagem principal do conteúdo — `main.page` por padrão
 * (CA-07), ou o contêiner registrado por `uiBackToTopContainer` numa rota com
 * rolagem interna (CA-08) — e fica visível quando a posição atinge
 * `scrollTop / (scrollHeight - clientHeight) >= 0,30` (CA-04). Acioná-lo leva
 * esse mesmo contêiner ao topo (CA-06), sem animação sob `prefers-reduced-motion`
 * (CA-16). Rolagem de tabelas, diálogos, drawers ou da barra lateral não afeta o
 * botão porque o listener vive apenas no contêiner ativo (CA-09).
 */
@Component({
  selector: 'ui-back-to-top',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  private readonly scrollService = inject(BackToTopScrollService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly visivel = signal(false);

  /** O contêiner efetivamente observado: o registrado pela rota, ou o padrão. */
  private readonly containerAtivo = computed<HTMLElement | null>(
    () => this.scrollService.containerPrincipal() ?? this.defaultContainer(),
  );

  private observado: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private navTimer: ReturnType<typeof setTimeout> | null = null;
  private destruido = false;
  private readonly aoRolar = (): void => this.recalcular();

  constructor() {
    // Religa listener + observer e recalcula a visibilidade sempre que o
    // contêiner ativo muda de referência — troca de rota que monta/desmonta um
    // `uiBackToTopContainer`, ou o `main.page` do shell ficando disponível
    // depois do primeiro render.
    effect(() => {
      this.containerAtivo();
      // Fora do ciclo de detecção em curso: `reconciliar()` grava `visivel`, o
      // que no meio da verificação de mudanças do Angular dispararia NG0100.
      untracked(() => queueMicrotask(() => this.reconciliar()));
    });

    const inscricao = this.router.events.subscribe((evento) => {
      // `main.page` é o mesmo elemento entre rotas do app (o `ui-app-shell` não
      // é recriado), então o efeito acima não dispara na navegação. Ainda assim
      // os filhos que o ResizeObserver acompanha foram trocados pelo conteúdo da
      // rota nova — religa para reapontar o observer, além de recalcular (CA-10).
      //
      // `setTimeout`, não `queueMicrotask`: o conteúdo da rota nova só entra no
      // DOM na detecção de mudanças que segue o `NavigationEnd`; medir/observar
      // antes disso pegaria os filhos e as dimensões da rota anterior. Redirects
      // encadeados coalescem num único religamento.
      if (evento instanceof NavigationEnd) {
        if (this.navTimer !== null) clearTimeout(this.navTimer);
        this.navTimer = setTimeout(() => {
          this.navTimer = null;
          this.reconciliar();
        });
      }
    });

    this.destroyRef.onDestroy(() => {
      this.destruido = true;
      if (this.navTimer !== null) clearTimeout(this.navTimer);
      inscricao.unsubscribe();
      this.desligar();
    });
  }

  /** Religa listener + observer ao contêiner ativo e recalcula a visibilidade. */
  private reconciliar(): void {
    if (this.destruido) return;
    this.religar(this.containerAtivo());
    this.recalcular();
  }

  /** Recalcula a visibilidade pelo percentual rolado do contêiner ativo (CA-04/CA-05). */
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
    alvo.scrollTo({ top: 0, behavior: this.movimentoReduzido() ? 'auto' : 'smooth' });
    // Leva o foco ao topo do contêiner para dar ao leitor de tela um ponto de
    // chegada. Exige `tabindex` no contêiner — `main.page` já tem `-1`; contratos
    // internos (`uiBackToTopContainer`) devem declarar o seu (ver `.wiz-content`).
    if (alvo.hasAttribute('tabindex')) alvo.focus({ preventScroll: true });
  }

  private religar(alvo: HTMLElement | null): void {
    this.desligar();
    this.observado = alvo;
    // `visivel` é reconciliado pelo `recalcular()` adiado que segue toda
    // religação — inclusive para `alvo === null`.
    if (alvo === null) return;

    alvo.addEventListener('scroll', this.aoRolar, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.recalcular());
      this.resizeObserver.observe(alvo);
      // O contêiner não muda de caixa quando o conteúdo interno cresce; observar
      // os filhos cobre a mudança relevante de dimensões (CA-18).
      for (const filho of Array.from(alvo.children)) this.resizeObserver.observe(filho);
    }
  }

  private desligar(): void {
    this.observado?.removeEventListener('scroll', this.aoRolar);
    this.observado = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private movimentoReduzido(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
