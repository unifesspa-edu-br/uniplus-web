import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, NgZone, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import type { PrazoDaCredencial } from '../models/prazo-da-credencial';
import { AuthService } from './auth.service';

/** Quanto antes do vencimento a pessoa é avisada: bem acima dos 20 segundos que o WCAG 2.2.1 exige. */
const ANTECEDENCIA_DO_AVISO_MS = 2 * 60 * 1000;
/** De quanto em quanto tempo o aviso aberto reconfere o tempo que falta. */
const INTERVALO_DE_ATUALIZACAO_MS = 30 * 1000;
const RENOVAR_SEMPRE = -1;

/** O que a pessoa pode fazer ao ser avisada: pedir mais tempo ou só entrar de novo. */
export type SituacaoDoAviso = 'podeContinuar' | 'soEntrandoDeNovo';

/**
 * Avisa, antes de a sessão acabar, em quanto tempo isso acontece. A hora de abrir o aviso vem do
 * prazo da credencial de renovação que o login já informou; o temporizador é só um lembrete e a
 * decisão é sempre tomada pela hora atual. O período máximo da sessão não se estende renovando:
 * nesse caso, ou quando o pedido de mais tempo não adianta, resta entrar de novo antes do fim.
 * Nada é guardado no navegador.
 */
@Injectable({ providedIn: 'root' })
export class AvisoDeVencimentoDaSessao {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly relogio = inject(RELOGIO);
  private readonly documento = inject(DOCUMENT);
  private readonly _restanteEmMs = signal<number | null>(null);
  private readonly _semMaisTempo = signal(false);
  private dispensadoAteOVencimento: number | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  /** Verdadeiro enquanto o aviso está aberto. */
  readonly aberto = computed(() => this._restanteEmMs() !== null);
  /** Quanto falta para a sessão acabar, em segundos, na última conferência. */
  readonly restanteEmSegundos = computed(() =>
    Math.max(0, Math.ceil((this._restanteEmMs() ?? 0) / 1000)),
  );
  readonly situacao = computed<SituacaoDoAviso>(() =>
    this._semMaisTempo() || this.auth.prazoDaCredencial()?.limite === 'periodoMaximo'
      ? 'soEntrandoDeNovo'
      : 'podeContinuar',
  );

  constructor() {
    effect(() => {
      this.auth.prazoDaCredencial();
      this.avaliar();
    });
    const pararDeOuvir = inject(NgZone).runOutsideAngular(() => this.ouvirOsRetornos());
    inject(DestroyRef).onDestroy(() => {
      pararDeOuvir();
      this.cancelar();
    });
  }

  /**
   * Pede mais tempo ao provedor. Se ele renovou e o prazo não avançou, não há mais o que estender e
   * passa a oferecer só entrar de novo; se a renovação falhou (rede, por exemplo), continua
   * oferecendo tentar de novo.
   */
  async continuar(): Promise<void> {
    const antes = this.auth.prazoDaCredencial()?.venceEm ?? 0;
    const renovou = await this.auth.refreshToken(RENOVAR_SEMPRE);
    const depois = this.auth.prazoDaCredencial()?.venceEm ?? 0;
    if (renovou && depois <= antes) this._semMaisTempo.set(true);
  }

  entrarDeNovo(): void {
    void this.auth.login(this.router.url);
  }

  /** Fecha o aviso e não o reabre para este mesmo vencimento. */
  dispensar(): void {
    this.dispensadoAteOVencimento = this.auth.prazoDaCredencial()?.venceEm ?? null;
    this.avaliar();
  }

  private ouvirOsRetornos(): () => void {
    const janela = this.documento.defaultView;
    const reavaliar = () => this.avaliar();
    janela?.addEventListener('online', reavaliar);
    janela?.addEventListener('pageshow', reavaliar);
    this.documento.addEventListener('visibilitychange', reavaliar);
    return () => {
      janela?.removeEventListener('online', reavaliar);
      janela?.removeEventListener('pageshow', reavaliar);
      this.documento.removeEventListener('visibilitychange', reavaliar);
    };
  }

  private avaliar(): void {
    this.cancelar();
    const prazo = this.auth.prazoDaCredencial();
    const restante = prazo === null ? 0 : prazo.venceEm - this.relogio().getTime();
    if (prazo === null || restante <= 0) {
      this.fechar();
    } else if (restante > ANTECEDENCIA_DO_AVISO_MS) {
      this.fechar();
      this.lembrarEm(restante - ANTECEDENCIA_DO_AVISO_MS);
    } else {
      this.abrirOuManter(prazo, restante);
    }
  }

  private abrirOuManter(prazo: PrazoDaCredencial, restante: number): void {
    if (this.dispensadoAteOVencimento === prazo.venceEm) {
      this._restanteEmMs.set(null);
      return;
    }
    this._restanteEmMs.set(restante);
    this.lembrarEm(Math.min(restante, INTERVALO_DE_ATUALIZACAO_MS));
  }

  private fechar(): void {
    this._restanteEmMs.set(null);
    this._semMaisTempo.set(false);
  }

  private lembrarEm(esperaEmMs: number): void {
    this.temporizador = setTimeout(() => this.avaliar(), esperaEmMs);
  }

  private cancelar(): void {
    if (this.temporizador !== null) clearTimeout(this.temporizador);
    this.temporizador = null;
  }
}
