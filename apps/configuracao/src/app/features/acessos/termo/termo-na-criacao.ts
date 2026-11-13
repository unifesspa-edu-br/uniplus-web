import { Injectable, inject, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { TermosDeResponsabilidadeApi } from '@uniplus/shared-data/autorizacao';
import { LeituraDoTermo } from './leitura-do-termo';

/**
 * O termo vigente apresentado no pedido próprio sem documento, em que o envio é o aceite (ADR-0162).
 * Quando a API diz que a vigente mudou, a tela troca o texto, desmarca o aceite e avisa.
 */
@Injectable()
export class TermoNaCriacao {
  private readonly api = inject(TermosDeResponsabilidadeApi);
  private readonly leitura = new LeituraDoTermo();
  readonly versao = this.leitura.versao;
  readonly carregando = this.leitura.carregando;
  readonly erro = this.leitura.erro;
  readonly aviso = signal<string | null>(null);
  readonly aceite = new FormControl(false, {
    nonNullable: true,
    validators: [Validators.requiredTrue],
  });

  /** Lê a vigente na primeira vez em que o pedido passa a exigir o aceite. */
  garantir(): void {
    if (this.versao() === null && !this.carregando())
      void this.leitura.ler(() => this.api.vigente());
  }

  /** A versão que o envio apresenta, ou `null` enquanto não há versão lida e aceita. */
  apresentada(): string | null {
    const versao = this.versao();
    return versao !== null && this.aceite.value ? versao.id : null;
  }

  /** A vigente mudou: o texto novo substitui o anterior e o aceite precisa ser dado de novo. */
  async trocarPelaVigente(): Promise<void> {
    this.aceite.reset(false);
    if (!(await this.leitura.ler(() => this.api.vigente()))) return;
    const numero = this.versao()?.numero;
    this.aviso.set(
      `O termo de responsabilidade foi atualizado para a versão ${numero}. Leia o texto novo e marque o aceite de novo para enviar.`,
    );
  }
}
