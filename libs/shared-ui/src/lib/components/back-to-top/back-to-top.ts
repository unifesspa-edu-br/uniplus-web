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
  private readonly aoRolar = (): void => this.recalcular();

  constructor() {
    // Religa listener e observer sempre que o contêiner ativo muda — troca de
    // rota que monta/desmonta um `uiBackToTopContainer`, ou o `main.page` do
    // shell ficando disponível depois do primeiro render.
    effect(() => {
      const alvo = this.containerAtivo();
      untracked(() => {
        this.religar(alvo);
        // Fora do ciclo de detecção em curso: recalcular aqui gravaria `visivel`
        // no meio da verificação de mudanças do Angular.
        queueMicrotask(() => this.recalcular());
      });
    });

    const inscricao = this.router.events.subscribe((evento) => {
      // O conteúdo da nova rota só entra no DOM no próximo tick; recalcular
      // agora usaria as dimensões da rota anterior (CA-10).
      if (evento instanceof NavigationEnd) queueMicrotask(() => this.recalcular());
    });

    this.destroyRef.onDestroy(() => {
      inscricao.unsubscribe();
      this.desligar();
    });
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
    // `main.page` é focável (`tabindex="-1"`): levar o foco ao topo dá ao leitor
    // de tela um ponto de partida consistente. Contêineres não-focáveis (ex.:
    // `.wiz-content`) apenas rolam.
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
