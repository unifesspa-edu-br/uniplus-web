import { Injectable, inject } from '@angular/core';
import { isApiOk } from '@uniplus/shared-core/http';

import { ProcessoSeletivoStore } from '../processo-seletivo.store';
import { CadastroInicialService } from './cadastro-inicial.service';

/**
 * Relê a classificação do processo para atualizar o que ele congelou no servidor. Se a leitura
 * falhar, de qualquer jeito, a referência fica marcada como velha: quem acabou de gravar não pode
 * ter a gravação desfeita por uma leitura que não deu certo.
 *
 * Leituras podem se sobrepor — a gravação da Eliminação, a varredura da publicação, o botão do
 * aviso —, e só a mais recente decide: a resposta de uma leitura superada, por outra leitura ou
 * por uma gravação da classificação, é descartada.
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
      if (isApiOk(detalhe)) this.store.registrarClassificacaoLida(detalhe.data.classificacao);
      else this.store.quadroPesoAreaEnemDesatualizado.set(true);
    } catch {
      if (superada()) return false;
      this.store.quadroPesoAreaEnemDesatualizado.set(true);
    }
    return true;
  }

  /**
   * Uma gravação da classificação começou: a leitura que já estava em curso traria a classificação
   * de antes dela e não pode decidir.
   */
  descartarLeiturasEmCurso(): void {
    this.ultimaLeitura++;
  }
}
