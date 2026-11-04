import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import type { EnvioDasRespostas } from '@uniplus/shared-ui/components';
import { deslocarDia, diaNoFuso, instanteDaHoraDeParede } from '@uniplus/shared-utils';

import { LeituraDaInscricao } from './leitura-da-inscricao';

/**
 * O dia contra o qual a tela confere os limites de data das respostas: o dia de agora, no fuso que o
 * formulário publica. Só muda quando o dia do envio vira, para as regras não se reavaliarem a cada tique
 * do relógio; o servidor confere de novo com o instante real de cada gravação. Provido pela página.
 */
@Injectable()
export class DiaDoEnvio {
  private readonly relogio = inject(RELOGIO);
  private readonly documento = inject(DOCUMENT);
  private readonly leitura = inject(LeituraDaInscricao);

  private readonly instante = signal(this.relogio());
  private viradaDoDia: ReturnType<typeof setTimeout> | null = null;

  /** O envio que a tela supõe para os limites de data, ou `null` enquanto o formulário não chegou. */
  readonly envio = computed<EnvioDasRespostas | null>(() => {
    const fuso = this.leitura.formulario()?.fusoDoEnvio;
    return fuso ? { instante: this.instante().toISOString(), fuso } : null;
  });

  constructor() {
    const conferirODia = (): void => this.acompanhar();
    const janela = this.documento.defaultView;
    this.documento.addEventListener('visibilitychange', conferirODia);
    janela?.addEventListener('focus', conferirODia);
    inject(DestroyRef).onDestroy(() => {
      this.documento.removeEventListener('visibilitychange', conferirODia);
      janela?.removeEventListener('focus', conferirODia);
      this.cancelarAViradaDoDia();
    });
    effect(() => {
      this.leitura.carregada();
      untracked(() => {
        this.instante.set(this.relogio());
        this.acompanhar();
      });
    });
  }

  /**
   * Mantém o dia do envio em dia: troca o instante quando o dia virou no fuso do envio e agenda a
   * próxima virada. A aba em segundo plano pode atrasar o timer, então a volta dela também confere.
   */
  private acompanhar(): void {
    const fuso = this.leitura.formulario()?.fusoDoEnvio;
    if (!fuso) return;
    const agora = this.relogio();
    if (diaNoFuso(agora, fuso) !== diaNoFuso(this.instante(), fuso)) this.instante.set(agora);
    this.agendarAViradaDoDia(agora, fuso);
  }

  private agendarAViradaDoDia(agora: Date, fuso: string): void {
    this.cancelarAViradaDoDia();
    const amanha = deslocarDia(diaNoFuso(agora, fuso), 0, 1);
    if (amanha === null) return;
    const [ano, mes, dia] = amanha.split('-').map(Number);
    const meiaNoite = instanteDaHoraDeParede(
      { ano, mes, dia, hora: 0, minuto: 0, segundo: 0 },
      fuso,
    );
    this.viradaDoDia = setTimeout(
      () => this.acompanhar(),
      Math.max(0, meiaNoite.getTime() - agora.getTime()),
    );
  }

  private cancelarAViradaDoDia(): void {
    if (this.viradaDoDia !== null) clearTimeout(this.viradaDoDia);
    this.viradaDoDia = null;
  }
}
