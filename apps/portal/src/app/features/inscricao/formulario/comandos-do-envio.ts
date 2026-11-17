import { ChaveDeSubstituicao, type RespostaDoComando, comChave } from '@uniplus/shared-core/http';
import {
  type ArquivoDaApresentacaoDto,
  type InscricoesApi,
  type IniciarEnvioDeDocumentoDaInscricaoDto,
} from '@uniplus/shared-data/selecao';

import type { TentativaDeEnvio } from './tentativa-de-envio';

/** Os comandos do envio na API, um de cada vez, cada um sob a sua chave de idempotência. */
export class ComandosDoEnvio {
  /** Cada chamada avança a revisão da inscrição e disputaria com a outra: saem uma de cada vez. */
  private fila: Promise<unknown> = Promise.resolve();
  private readonly chavesDaRemocao = new Map<string, ChaveDeSubstituicao>();

  constructor(
    private readonly processoId: string,
    private readonly api: InscricoesApi,
  ) {}

  iniciar(
    tentativa: TentativaDeEnvio,
  ): Promise<RespostaDoComando<IniciarEnvioDeDocumentoDaInscricaoDto>> {
    const pedido = tentativa.pedidoDeIniciacao();
    return this.naFila(() =>
      comChave(tentativa.chaveDaIniciacao, pedido, (contexto) =>
        this.api.iniciarEnvioDeDocumento(this.processoId, pedido, contexto),
      ),
    );
  }

  confirmar(
    arquivoId: string,
    tentativa: TentativaDeEnvio,
  ): Promise<RespostaDoComando<ArquivoDaApresentacaoDto>> {
    const pedido = tentativa.pedidoDeConfirmacao();
    return this.naFila(() =>
      comChave(tentativa.chaveDaConfirmacao, pedido, (contexto) =>
        this.api.confirmarEnvioDeDocumento(this.processoId, arquivoId, pedido, contexto),
      ),
    );
  }

  async remover(arquivoId: string): Promise<RespostaDoComando<void>> {
    // A chave acompanha o arquivo: repetir depois de uma resposta perdida recebe o replay, e não um 404.
    const chave = this.chavesDaRemocao.get(arquivoId) ?? new ChaveDeSubstituicao();
    this.chavesDaRemocao.set(arquivoId, chave);
    const resposta = await this.naFila(() =>
      comChave(chave, arquivoId, (contexto) =>
        this.api.removerArquivoDeDocumento(this.processoId, arquivoId, contexto),
      ),
    );
    if (!resposta.inconclusiva) this.chavesDaRemocao.delete(arquivoId);
    return resposta;
  }

  private naFila<T>(chamada: () => Promise<T>): Promise<T> {
    const vez = this.fila.then(chamada, chamada);
    this.fila = vez.catch(() => undefined);
    return vez;
  }
}
