import { Injectable, computed, inject, signal } from '@angular/core';
import { aguardarRecarga } from '../../../shared/foco';
import { FALHA_INESPERADA } from '../mensagens-de-acesso';
import { LeituraDosPerfis } from './leitura-dos-perfis';

export type TipoDeEscrita = 'salvando' | 'situacao' | 'remocao' | 'cancelamento' | 'documento' | 'decisao' | 'janela';

/**
 * A escrita em curso na tela de perfis. Só uma por vez, e a próxima só começa quando a leitura
 * relida mostra o que foi gravado.
 */
@Injectable()
export class EscritaDoPerfil {
  private readonly leitura = inject(LeituraDosPerfis);
  private readonly corrente = signal<TipoDeEscrita | null>(null);
  private readonly recarga = aguardarRecarga(
    this.leitura.carregando,
    computed(() => this.leitura.mensagemDeErro() !== null),
  );
  readonly salvando = computed(() => this.corrente() === 'salvando');
  readonly alterandoSituacao = computed(() => this.corrente() === 'situacao');
  readonly removendo = computed(() => this.corrente() === 'remocao');
  readonly cancelando = computed(() => this.corrente() === 'cancelamento');
  readonly enviandoDocumento = computed(() => this.corrente() === 'documento');
  /** Inclui a espera pela releitura: a tela só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.corrente() !== null || this.recarga.aguardando());
  /** A recusa de uma ação que não tem formulário ou diálogo próprio para mostrá-la. */
  readonly erroDaAcao = signal<string | null>(null);

  /** Roda a escrita; a falha que não veio da API vai para `aoFalhar`. */
  async executar(
    tipo: TipoDeEscrita,
    tarefa: () => Promise<void>,
    aoFalhar: (mensagem: string) => void,
  ): Promise<void> {
    if (this.gravando()) return;
    this.corrente.set(tipo);
    try {
      await tarefa();
    } catch {
      aoFalhar(FALHA_INESPERADA);
    } finally {
      this.corrente.set(null);
    }
  }

  recarregar(): void {
    this.recarga.iniciar();
    this.leitura.recarregar();
  }
}
