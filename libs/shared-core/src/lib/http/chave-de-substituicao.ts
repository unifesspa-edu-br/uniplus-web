import { HttpContext } from '@angular/common/http';
import { ApiFailure } from './api-result';
import { deveRotacionarIdempotencyKey, idempotencyKey, withIdempotencyKey } from './idempotency';

/**
 * Decide e cria a chave do próximo envio: a regra de manter ou trocar é a de
 * `deveRotacionarIdempotencyKey`, que vive num lugar só. Quem mantém a chave repete o mesmo comando
 * sob a mesma chave; quem a troca começa um comando novo.
 */
export function proximaChave(chaveAtual: string, falha: ApiFailure): string {
  return deveRotacionarIdempotencyKey(falha.problem) ? idempotencyKey.create() : chaveAtual;
}

/**
 * `Idempotency-Key` de um comando que substitui a configuração inteira — a
 * taxa de inscrição, a distribuição de vagas.
 *
 * Uma chave retida vale para o corpo que o servidor viu, e reenviar outro sob
 * ela devolve `body_mismatch`. Como o comando substitui tudo, corrigir e
 * regravar sob chave nova não duplica nada: a chave gira assim que o corpo
 * muda. É o oposto da criação, que precisa repetir o mesmo envio sob a mesma
 * chave para não criar um segundo processo.
 */
export class ChaveDeSubstituicao {
  private chave = idempotencyKey.create();

  /** Corpo que a chave corrente acompanhou, ou `null` se nenhum. */
  private corpoEnviado: string | null = null;

  /** Contexto do envio, com chave nova quando o corpo difere do anterior. */
  contextoPara(corpo: unknown): HttpContext {
    const declaracao = JSON.stringify(corpo);
    if (this.corpoEnviado !== null && this.corpoEnviado !== declaracao) {
      this.chave = idempotencyKey.create();
    }
    this.corpoEnviado = declaracao;
    return withIdempotencyKey(this.chave);
  }

  /**
   * O servidor recusou. A chave só é preservada quando a execução anterior
   * ainda pode concluir; nesse caso o corpo fica retido, porque a retentativa
   * precisa repeti-lo igual.
   *
   * Devolve `true` quando a chave foi preservada — a recusa é inconclusiva
   * (erro de rede, 5xx, resposta fora do contrato com 2xx ou 3xx), e quem chama
   * não pode tratar o comando como "não aplicado": o servidor pode tê-lo
   * executado mesmo sem confirmar.
   */
  recusada(falha: ApiFailure): boolean {
    const anterior = this.chave;
    this.chave = proximaChave(anterior, falha);
    const inconclusiva = this.chave === anterior;
    if (!inconclusiva) this.corpoEnviado = null;
    return inconclusiva;
  }

  /** O comando terminou, ou o cadastro que ele tratava foi abandonado. */
  renovar(): void {
    this.chave = idempotencyKey.create();
    this.corpoEnviado = null;
  }
}
