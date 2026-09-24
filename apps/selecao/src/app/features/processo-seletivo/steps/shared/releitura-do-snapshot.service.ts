import { Injectable, inject, type WritableSignal } from '@angular/core';
import { isApiOk } from '@uniplus/shared-core/http';

import { ProcessoSeletivoStore } from '../processo-seletivo.store';
import { CadastroInicialService } from './cadastro-inicial.service';

/**
 * Relê a classificação e os critérios de desempate do processo para atualizar o que ele tem no
 * servidor. A leitura que falha, de qualquer jeito, não muda nada: o que estava em dúvida continua
 * em dúvida, e o que se sabia continua sabido — quem acabou de gravar não pode ter a gravação
 * desfeita por uma leitura que não deu certo.
 *
 * Leituras podem se sobrepor — a gravação da Eliminação, a varredura da publicação, o botão do
 * aviso —, e só a mais recente decide: a resposta de uma leitura superada, por outra leitura ou
 * por uma gravação que muda o que ela traz, é descartada.
 */
@Injectable()
export class ReleituraDoSnapshot {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicialService);
  private ultimaLeitura = 0;

  /** `true` quando esta leitura foi a que decidiu; `false` quando uma mais nova a superou. */
  async reler(): Promise<boolean> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) return false;

    const leitura = ++this.ultimaLeitura;
    const geracao = this.store.geracao();
    const superada = () => leitura !== this.ultimaLeitura || geracao !== this.store.geracao();
    try {
      const detalhe = await this.cadastro.obterDetalhe(processoId);
      if (superada()) return false;
      if (isApiOk(detalhe)) this.store.registrarGravadoLido(detalhe.data);
    } catch {
      if (superada()) return false;
    }
    return true;
  }

  /**
   * Começou uma gravação que muda o que a releitura traz — a classificação ou os critérios de
   * desempate: a leitura que já estava em curso traria o de antes dela e não pode decidir.
   */
  private descartarLeiturasEmCurso(): void {
    this.ultimaLeitura++;
  }

  /**
   * Roda uma gravação que muda o que a releitura traz, descartando a leitura em curso. `gravar`
   * registra o que a resposta ensina — inclusive que o gravado ficou por reler —, e a releitura
   * vem depois, dê a gravação certo, seja recusada ou lance: a leitura descartada podia ser a que
   * resolveria o que já estava por reler. Menos na varredura da publicação, que relê uma vez no
   * fim, e depois de uma troca de processo, que traz a leitura dela.
   */
  async gravando<T>(gravar: () => Promise<T>): Promise<T> {
    const geracao = this.store.geracao();
    this.descartarLeiturasEmCurso();
    try {
      return await gravar();
    } finally {
      if (
        geracao === this.store.geracao() &&
        this.store.gravadoPorReler() &&
        !this.store.travamentoDeOrquestracao()
      ) {
        await this.reler();
      }
    }
  }
}

/**
 * "Reler o processo" a pedido do operador: uma releitura por vez, com `relendo` ligado enquanto
 * ela corre. `true` quando esta releitura decidiu; uma superada por outra, ou pela troca de
 * processo, não decidiu nada.
 */
export async function relerProcessoAPedido(
  releitura: Pick<ReleituraDoSnapshot, 'reler'>,
  relendo: WritableSignal<boolean>,
): Promise<boolean> {
  if (relendo()) return false;
  relendo.set(true);
  try {
    return await releitura.reler();
  } finally {
    relendo.set(false);
  }
}
