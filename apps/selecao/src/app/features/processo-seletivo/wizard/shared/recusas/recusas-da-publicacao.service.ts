import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { paginaDoErro, type ProblemDetails } from '@uniplus/shared-core/http';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { mesmoConteudo } from '../conteudo-canonico';
import { NumeracaoDasRespostasRecusadas } from './numeracao-das-respostas-recusadas';
import type { RecusaOrdenada } from './ordem-das-recusas';

/** O `campo` da recusa que a API deu sem apontar campo. */
export const SEM_CAMPO = '';

/**
 * Todas as causas (`errors[]`) da resposta recusada, na ordem em que a API as deu, com o campo
 * que ela nomeou (ponteiro no documento) ou `SEM_CAMPO` quando é uma causa geral.
 */
export function recusasDaResposta(problema: ProblemDetails, resposta: number): RecusaOrdenada[] {
  return (problema.errors ?? []).map((erro, ordem) => ({
    campo: erro.field ?? SEM_CAMPO,
    codigo: erro.code,
    mensagem: erro.message,
    pagina: paginaDoErro(problema, erro.code),
    ordem,
    resposta,
    origem: 'publicacao',
    aConferir: false,
  }));
}

/** O que a última resposta recusada deixou: as causas, o código e o título dela, o processo e o rascunho que conferiu. */
interface UltimaTentativa {
  readonly recusas: readonly RecusaOrdenada[];
  readonly codigo: string;
  readonly titulo: string;
  readonly geracao: number;
  readonly rascunho: unknown;
}

/** O código da resposta recusada e o título que o operador lê dela, já resolvido. */
export interface RespostaRecusada {
  readonly codigo: string;
  readonly titulo: string;
}

/**
 * A última resposta recusada da publicação, num só registro: as causas (`errors[]`), o código e o
 * título dela. A Revisão escreve, e a página é a dona porque o registro precisa sobreviver à troca
 * de passo e às releituras do checklist, que a Revisão faz sem tocar nele.
 *
 * O registro só é trocado por uma resposta da publicação: aceita, esvazia; recusada, a resposta
 * nova o substitui inteiro. Uma tentativa sem resposta (rede, tempo esgotado, resultado incerto)
 * não chega aqui e deixa tudo como está. Deixa de valer também quando muda o processo e quando o
 * servidor diz que o processo saiu do rascunho.
 */
@Injectable()
export class RecusasDaPublicacao {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly numeracao = inject(NumeracaoDasRespostasRecusadas);

  private readonly ultima = signal<UltimaTentativa | null>(null);

  private readonly vigente = computed(() => {
    const ultima = this.ultima();
    return ultima !== null && ultima.geracao === this.store.geracao() ? ultima : null;
  });

  /** As recusas da última resposta recusada, na ordem da API, enquanto ainda valem. */
  readonly recusas = computed(() => this.vigente()?.recusas ?? []);

  /** O código e o título da última resposta recusada, enquanto ainda valem; `null` sem recusa. */
  readonly resposta = computed<RespostaRecusada | null>(() => {
    const vigente = this.vigente();
    return vigente === null ? null : { codigo: vigente.codigo, titulo: vigente.titulo };
  });

  /**
   * O rascunho, inteiro, mudou depois da resposta recusada: a publicação confere todas as partes
   * do processo, então o que a recusa apontou pode já não valer, e só uma nova publicação diz.
   */
  readonly rascunhoAlterado = computed(() => {
    const vigente = this.vigente();
    if (vigente === null || vigente.recusas.length === 0) return false;
    const hoje = this.store.draft();
    return hoje !== vigente.rascunho && !mesmoConteudo(hoje, vigente.rascunho);
  });

  constructor() {
    effect(() => {
      if (this.store.processoForaDeRascunho()) untracked(() => this.limpar());
    });
  }

  /**
   * Substitui o registro inteiro pela resposta recusada, que ganha o número seguinte; `titulo` é
   * o texto que o operador lê dela.
   */
  registrar(problema: ProblemDetails, titulo: string): void {
    this.ultima.set({
      recusas: recusasDaResposta(problema, this.numeracao.proxima()),
      codigo: problema.code,
      titulo,
      geracao: this.store.geracao(),
      rascunho: this.store.draft(),
    });
  }

  limpar(): void {
    this.ultima.set(null);
  }
}
