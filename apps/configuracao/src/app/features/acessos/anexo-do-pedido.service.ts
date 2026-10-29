import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ProblemI18nService,
  SignedUploadClient,
  abrirAcessoEmNovaAba,
  enviarAoStorage,
  isApiOk,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { PedidosDeConcessaoApi } from '@uniplus/shared-data/autorizacao';
import { textoDaRecusa } from './mensagens-de-acesso';

export type FaseDoEnvio = 'registrando' | 'enviando' | 'confirmando';

export type DesfechoDoAnexo =
  | { readonly ok: true }
  | { readonly ok: false; readonly mensagem: string };

export type DesfechoDaAbertura =
  | 'aberta'
  | 'bloqueada'
  | 'abandonada'
  | { readonly recusa: string };

const FALHA_NO_ARMAZENAMENTO = 'Falha ao enviar o arquivo. Verifique a conexão e tente novamente.';
const ENDERECO_VENCIDO = 'O endereço de envio venceu. Tente novamente para obter um novo.';

/**
 * Anexa o PDF a um pedido: a API registra o anexo e devolve a URL assinada, o navegador envia os
 * bytes direto ao armazenamento e a API recebe o ETag para mandar o arquivo à verificação.
 */
@Injectable({ providedIn: 'root' })
export class AnexoDoPedidoService {
  private readonly api = inject(PedidosDeConcessaoApi);
  private readonly armazenamento = inject(SignedUploadClient);
  private readonly problemas = inject(ProblemI18nService);

  async anexar(
    pedidoId: string,
    arquivo: File,
    aoAndar: (fase: FaseDoEnvio, percentual: number) => void,
  ): Promise<DesfechoDoAnexo> {
    aoAndar('registrando', 0);
    const registro = await firstValueFrom(
      this.api.iniciarAnexo(pedidoId, arquivo.size, withIdempotencyKey()),
    );
    if (!isApiOk(registro)) return this.recusa(registro.problem);

    const { id, urlDeEnvio, tipoDeMidia, expiraEm } = registro.data;
    const envio = await enviarAoStorage(
      this.armazenamento,
      { urlUpload: urlDeEnvio, contentTypeExigido: tipoDeMidia, expiraEm },
      arquivo,
      (percentual) => aoAndar('enviando', percentual),
    );
    if (!envio.ok) {
      return { ok: false, mensagem: envio.expirada ? ENDERECO_VENCIDO : FALHA_NO_ARMAZENAMENTO };
    }

    aoAndar('confirmando', 100);
    const confirmacao = await firstValueFrom(
      this.api.confirmarAnexo(pedidoId, id, envio.etag, withIdempotencyKey()),
    );
    return isApiOk(confirmacao) ? { ok: true } : this.recusa(confirmacao.problem);
  }

  /** Abre o anexo verificado numa aba nova, pedindo a URL assinada no clique. */
  async abrir(
    pedidoId: string,
    anexoId: string,
    aindaVale: () => boolean,
  ): Promise<DesfechoDaAbertura> {
    const desfecho = await abrirAcessoEmNovaAba(
      () => firstValueFrom(this.api.acessoAoAnexo(pedidoId, anexoId)),
      aindaVale,
    );
    return desfecho.situacao === 'recusada'
      ? { recusa: this.texto(desfecho.problem) }
      : desfecho.situacao;
  }

  private recusa(problema: ProblemDetails): DesfechoDoAnexo {
    return { ok: false, mensagem: this.texto(problema) };
  }

  private texto(problema: ProblemDetails): string {
    return textoDaRecusa(this.problemas.resolve(problema));
  }
}
