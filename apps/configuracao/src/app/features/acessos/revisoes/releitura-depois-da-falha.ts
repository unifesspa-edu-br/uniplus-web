import { computed, effect, inject, signal, untracked } from '@angular/core';
import { aguardarRecarga } from '../../../shared/foco';
import { LeituraDosPerfis } from '../versoes/leitura-dos-perfis';

/** O que a tela mostra no lugar da revisão enquanto ela não é relida com sucesso. */
export interface FalhaDaDecisao {
  readonly titulo: string;
  readonly texto: string;
}

/**
 * Depois de uma decisão de desfecho incerto (5xx, como o registro de acesso que não gravou, ou erro
 * sem resposta), a revisão sai da tela e é relida. Ela só volta com uma leitura bem-sucedida, para
 * que ninguém repita a ação sobre um estado que pode já ter mudado.
 *
 * Criar em contexto de injeção.
 */
export class ReleituraDepoisDaFalha {
  private readonly leitura = inject(LeituraDosPerfis);
  private readonly comFalhaDeLeitura = computed(() => this.leitura.mensagemDeErro() !== null);
  private readonly releitura = aguardarRecarga(this.leitura.carregando, this.comFalhaDeLeitura);
  private readonly atual = signal<FalhaDaDecisao | null>(null);
  readonly falha = this.atual.asReadonly();

  /** @param aoRestaurar recebe a falha quando a revisão volta, para o aviso que fica à vista. */
  constructor(aoRestaurar: (falha: FalhaDaDecisao) => void) {
    effect(() => {
      const falha = this.atual();
      if (falha === null || this.releitura.aguardando() || this.comFalhaDeLeitura()) return;
      untracked(() => {
        this.atual.set(null);
        aoRestaurar(falha);
      });
    });
  }

  iniciar(falha: FalhaDaDecisao): void {
    this.atual.set(falha);
    this.releitura.iniciar();
    this.leitura.recarregar();
  }
}
