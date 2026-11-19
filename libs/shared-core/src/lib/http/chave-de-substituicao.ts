import { HttpContext } from '@angular/common/http';
import { ApiFailure } from './api-result';
import { CODIGO_ESPERA_ESGOTADA, idempotencyKey, withIdempotencyKey } from './idempotency';

const PROCESSING_CONFLICT = 'uniplus.idempotency.processing_conflict';
const NETWORK_ERROR = 'uniplus.client.network_error';

/**
 * Só estes casos deixam em aberto se o comando foi executado: conflito de processamento, falha sem
 * resposta e 5xx. O 503 de espera esgotada é a exceção entre os 5xx: nada foi executado e a
 * recusa fica guardada na chave, então repeti-la devolveria o mesmo 503.
 */
function deixaOComandoEmAberto({ code, status }: ApiFailure['problem']): boolean {
  if (code === CODIGO_ESPERA_ESGOTADA) return false;
  return code === PROCESSING_CONFLICT || code === NETWORK_ERROR || status >= 500;
}

/**
 * Regra de rotação da `Idempotency-Key`, por código antes de status: o filtro
 * do backend guarda a resposta de qualquer status abaixo de 500, então reenviar
 * um corpo corrigido com a mesma chave devolveria `body_mismatch` em vez de
 * processar o comando novo. As exceções vão na direção oposta —
 * `processing_conflict` e falha sem resposta pedem retry com a mesma chave,
 * porque a execução anterior ainda pode concluir. Todo o resto é recusa
 * definitiva, inclusive `body_mismatch` e o 413 de corpo acima do limite do filtro: manter a
 * chave prenderia a tela repetindo para sempre um comando que o servidor nunca vai aceitar.
 */
export function proximaChave(chaveAtual: string, falha: ApiFailure): string {
  return deixaOComandoEmAberto(falha.problem) ? chaveAtual : idempotencyKey.create();
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
   * (erro de rede ou 5xx), e quem chama não pode tratar o comando como "não
   * aplicado": o servidor pode tê-lo executado mesmo sem confirmar.
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
