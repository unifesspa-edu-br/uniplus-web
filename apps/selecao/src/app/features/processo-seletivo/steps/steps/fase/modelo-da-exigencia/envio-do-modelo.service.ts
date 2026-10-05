import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { SignedUploadClient, isApiOk, type ApiResult } from '@uniplus/shared-core/http';
import {
  ProcessosSeletivosApi,
  type IniciarEnvioDoModeloDeDocumentoDto,
  type IniciarEnvioDoModeloDeDocumentoRequest,
  type ModeloDeDocumentoDto,
} from '@uniplus/shared-data/selecao';

import { ChaveDeSubstituicao } from '../../../shared/chave-de-substituicao';
import { enviarAoStorage, type ResultadoEnvio } from '../../../shared/envio-pre-assinado';

/**
 * Os três passos do envio do modelo de documento e a conferência do confirmado, escondendo do
 * componente quando a `Idempotency-Key` pode ser reaproveitada.
 *
 * Provido por componente: cada exigência tem o seu envio, e as chaves não atravessam de uma para
 * outra. A chave segue o corpo — repetir a mesma iniciação ou a mesma confirmação depois de uma
 * resposta inconclusiva recebe o replay em vez de criar outro modelo; outro arquivo ou outro
 * modelo saem com chave nova.
 */
@Injectable()
export class EnvioDoModeloService {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly upload = inject(SignedUploadClient);

  private readonly chaveIniciacao = new ChaveDeSubstituicao();
  private readonly chaveConfirmacao = new ChaveDeSubstituicao();

  /** Passo 1: o modelo pendente e a URL pré-assinada. */
  iniciar(
    processoSeletivoId: string,
    request: IniciarEnvioDoModeloDeDocumentoRequest,
  ): Promise<RespostaDoComando<IniciarEnvioDoModeloDeDocumentoDto>> {
    return comChave(this.chaveIniciacao, request, (contexto) =>
      this.api.iniciarEnvioModeloDeDocumento(processoSeletivoId, request, contexto),
    );
  }

  /** Passo 2: os bytes direto ao storage. */
  enviarArquivo(
    destino: IniciarEnvioDoModeloDeDocumentoDto,
    arquivo: File,
    onProgresso: (percentual: number) => void,
  ): Promise<ResultadoEnvio> {
    return enviarAoStorage(this.upload, destino, arquivo, onProgresso);
  }

  /** Passo 3: a API valida o conteúdo, calcula o hash e sela o modelo. */
  confirmar(
    processoSeletivoId: string,
    modeloDeDocumentoId: string,
  ): Promise<RespostaDoComando<ModeloDeDocumentoDto>> {
    return comChave(this.chaveConfirmacao, modeloDeDocumentoId, (contexto) =>
      this.api.confirmarEnvioModeloDeDocumento(processoSeletivoId, modeloDeDocumentoId, contexto),
    );
  }

  /** O acesso de leitura ao modelo confirmado, emitido no pedido e com validade curta. */
  obterAcesso(processoSeletivoId: string, modeloDeDocumentoId: string) {
    return firstValueFrom(this.api.obterAcessoModeloDeDocumento(processoSeletivoId, modeloDeDocumentoId));
  }
}

/**
 * A resposta de um comando e se a recusa deixou em aberto se ele foi executado (rede, 5xx): o
 * modelo pode já existir no servidor, e a retentativa repete o mesmo comando com a mesma chave.
 */
export interface RespostaDoComando<T> {
  readonly resultado: ApiResult<T>;
  readonly inconclusiva: boolean;
}

async function comChave<T>(
  chave: ChaveDeSubstituicao,
  corpo: unknown,
  enviar: (contexto: HttpContext) => Observable<ApiResult<T>>,
): Promise<RespostaDoComando<T>> {
  const resultado = await firstValueFrom(enviar(chave.contextoPara(corpo)));
  if (isApiOk(resultado)) {
    chave.renovar();
    return { resultado, inconclusiva: false };
  }
  return { resultado, inconclusiva: chave.recusada(resultado) };
}
