import { Injectable, computed, inject, signal } from '@angular/core';
import { aguardarRecarga } from '../../shared/foco';
import { PesosEnemStore } from './pesos-enem.store';

export type EscritaDosPesosEnem = 'editando' | 'criando' | 'removendo';

/**
 * A trava única das escritas da tela: salvar a edição em linha, criar a resolução e removê-la
 * disputam o mesmo cadastro, então enquanto uma corre as outras não partem. Cada escrita pede a
 * trava no método que assina a operação; esta classe só guarda o estado, sem conhecer as
 * operações.
 */
@Injectable()
export class GravacaoDosPesosEnem {
  private readonly store = inject(PesosEnemStore);
  private readonly escrita = signal<EscritaDosPesosEnem | null>(null);
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  /** Inclui a espera pela recarga: a lista só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.escrita() !== null || this.recarga.aguardando());
  readonly salvandoEdicao = computed(() => this.escrita() === 'editando');
  readonly criando = computed(() => this.escrita() === 'criando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  private readonly desfecho = signal('');
  /** O andamento e o desfecho da escrita, para a região de status da página. */
  readonly anuncio = this.desfecho.asReadonly();

  anunciar(texto: string): void {
    this.desfecho.set(texto);
  }

  /** Pede a trava; `false` quando há escrita em curso ou recarga pendente. */
  tentar(tipo: EscritaDosPesosEnem): boolean {
    if (this.gravando()) {
      return false;
    }
    this.escrita.set(tipo);
    return true;
  }

  liberar(): void {
    this.escrita.set(null);
  }

  /** Recarrega a lista e mantém as ações indisponíveis até ela refletir o que foi gravado. */
  recarregar(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }
}
