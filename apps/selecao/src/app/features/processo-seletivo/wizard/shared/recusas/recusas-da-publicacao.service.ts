import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import {
  identificadoresDoErro,
  paginaDoErro,
  type IdentificadorDoItem,
  type ProblemDetails,
  type ProblemValidationError,
} from '@uniplus/shared-core/http';

import type { WizardDraft } from '../../modelos/rascunho.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { mesmoConteudo } from '../conteudo-canonico';
import { NumeracaoDasRespostasRecusadas } from './numeracao-das-respostas-recusadas';
import type { RecusaOrdenada } from './ordem-das-recusas';

/** O `campo` da recusa que a API deu sem apontar campo. */
export const SEM_CAMPO = '';

/** A recusa da publicação, com os identificadores dos itens de lista que o campo atravessa. */
export interface RecusaDaPublicacao extends RecusaOrdenada {
  readonly identificadores: readonly IdentificadorDoItem[];
}

/** O que a causa diz: o campo (ou `SEM_CAMPO`), o código, a mensagem e os identificadores. */
function dadosDaCausa(erro: ProblemValidationError) {
  return {
    campo: erro.field ?? SEM_CAMPO,
    codigo: erro.code,
    mensagem: erro.message,
    identificadores: identificadoresDoErro(erro),
  };
}

/**
 * Todas as causas (`errors[]`) da resposta recusada, na ordem em que a API as deu, com o campo
 * que ela nomeou (ponteiro no documento) ou `SEM_CAMPO` quando é uma causa geral.
 */
export function recusasDaResposta(
  problema: ProblemDetails,
  resposta: number,
): RecusaDaPublicacao[] {
  return (problema.errors ?? []).map((erro, ordem) => ({
    ...dadosDaCausa(erro),
    pagina: paginaDoErro(problema, erro.code),
    ordem,
    resposta,
    origem: 'publicacao',
    aConferir: false,
  }));
}

/** O que a última resposta recusada deixou: as causas, o código e o título dela, o processo e o rascunho que conferiu. */
interface UltimaTentativa {
  readonly recusas: readonly RecusaDaPublicacao[];
  readonly codigo: string;
  readonly titulo: string;
  readonly geracao: number;
  readonly rascunho: WizardDraft;
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

  /** O cronograma que a publicação conferiu, enquanto a resposta vale: o que as recusas apontaram. */
  readonly cronogramaDaResposta = computed(() => this.vigente()?.rascunho.cronograma ?? null);

  /** A recusa a que a pessoa pediu "Ir ao campo" e que o Cronograma ainda não levou ao campo. */
  readonly destino = signal<RecusaDaPublicacao | null>(null);

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
    this.destino.set(null);
  }
}
