import { signal } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import type { Subscription } from 'rxjs';

import type { FaseDoCronograma } from '../../processo-seletivo.models';
import type { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { mesmoConteudo } from '../../shared/conteudo-canonico';
import { faseDaConfiguracao, grupoDaConfiguracaoDaFase, type FaseConfigForm } from './fase-form';

/**
 * A fase do rascunho espelhada num formulário reativo, sem desfazer a digitação em curso: o
 * rascunho é reescrito a cada tecla pelo caminho de volta, e recriar os controles a cada uma
 * tiraria o foco do campo que está sendo preenchido.
 */
export class EspelhoDaFase {
  /** Formulário da fase aberta; `null` enquanto o cronograma está vazio. */
  readonly formulario = signal<FormGroup<FaseConfigForm> | null>(null);

  /**
   * O conteúdo do formulário, como signal, para que os valores derivados reajam à digitação.
   * Não é a fonte do dado, só a forma de o template acompanhar.
   */
  readonly versao = signal(0);

  /**
   * Enquanto o rascunho está sendo espelhado no formulário, o caminho de volta fica fechado:
   * sem isso, cada projeção dispararia uma escrita no rascunho, que dispararia outra projeção.
   */
  private espelhando = false;

  /** Assinatura do formulário vivo — trocar de fase descarta a anterior. */
  private assinatura: Subscription | null = null;

  private readonly store: ProcessoSeletivoStore;

  constructor(store: ProcessoSeletivoStore) {
    this.store = store;
  }

  espelhar(fase: FaseDoCronograma | null): void {
    if (fase === null) {
      this.encerrar();
      this.formulario.set(null);
      return;
    }

    const atual = this.formulario();
    if (atual !== null && mesmoConteudo(faseDaConfiguracao(atual), fase)) return;

    this.espelhando = true;
    try {
      const grupo = grupoDaConfiguracaoDaFase(fase);
      if (!this.store.aceitaEdicao()) grupo.disable({ emitEvent: false });

      this.encerrar();
      this.assinatura = grupo.valueChanges.subscribe(() => {
        this.versao.update((versao) => versao + 1);
        if (this.espelhando) return;
        this.escreverNoRascunho(faseDaConfiguracao(grupo));
      });

      this.formulario.set(grupo);
      this.versao.update((versao) => versao + 1);
    } finally {
      this.espelhando = false;
    }
  }

  encerrar(): void {
    this.assinatura?.unsubscribe();
    this.assinatura = null;
  }

  /** Substitui no rascunho só a fase aberta; as demais seguem como estão. */
  private escreverNoRascunho(fase: FaseDoCronograma): void {
    this.store.patchObjectSection('cronograma', {
      fases: this.store
        .draft()
        .cronograma.fases.map((atual) =>
          atual.faseCanonicaId === fase.faseCanonicaId ? fase : atual,
        ),
    });
  }
}
