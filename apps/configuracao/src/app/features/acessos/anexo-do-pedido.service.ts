import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ProblemI18nService,
  SignedUploadClient,
  abrirAcessoEmNovaAba,
  enviarAoStorage,
  isApiOk,
  type ProblemDetails,
  type ResultadoEnvio,
} from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PedidosDeConcessaoApi, type AnexoParaEnvioDto } from '@uniplus/shared-data/autorizacao';
import { mensagemDaRecusa } from './falha-de-servidor';

export type FaseDoEnvio = 'registrando' | 'enviando' | 'confirmando';

type AoAndar = (fase: FaseDoEnvio, percentual: number) => void;

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
  private readonly notificacoes = inject(NotificationService);

  async anexar(pedidoId: string, arquivo: File, aoAndar: AoAndar): Promise<DesfechoDoAnexo> {
    aoAndar('registrando', 0);
    const registro = await firstValueFrom(
      this.api.iniciarAnexo(pedidoId, arquivo.size, withIdempotencyKey()),
    );
    if (!isApiOk(registro)) return this.recusa(registro.problem);

    const envio = await this.enviar(registro.data, arquivo, aoAndar);
    if (!envio.ok) {
      return { ok: false, mensagem: envio.expirada ? ENDERECO_VENCIDO : FALHA_NO_ARMAZENAMENTO };
    }
    aoAndar('confirmando', 100);
    return this.confirmar(pedidoId, registro.data.id, envio.etag);
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

  /** Envia os bytes direto ao armazenamento, pela URL assinada que a API devolveu no registro. */
  private enviar(
    registro: AnexoParaEnvioDto,
    arquivo: File,
    aoAndar: AoAndar,
  ): Promise<ResultadoEnvio> {
    const { urlDeEnvio, tipoDeMidia, expiraEm } = registro;
    return enviarAoStorage(
      this.armazenamento,
      { urlUpload: urlDeEnvio, contentTypeExigido: tipoDeMidia, expiraEm },
      arquivo,
      (percentual) => aoAndar('enviando', percentual),
    );
  }

  /** Informa o ETag à API, que manda o arquivo à verificação. */
  private async confirmar(
    pedidoId: string,
    anexoId: string,
    etag: string | null,
  ): Promise<DesfechoDoAnexo> {
    const confirmacao = await firstValueFrom(
      this.api.confirmarAnexo(pedidoId, anexoId, etag, withIdempotencyKey()),
    );
    return isApiOk(confirmacao) ? { ok: true } : this.recusa(confirmacao.problem);
  }

  private recusa(problema: ProblemDetails): DesfechoDoAnexo {
    return { ok: false, mensagem: this.texto(problema) };
  }

  private texto(problema: ProblemDetails): string {
    return mensagemDaRecusa(this.problemas, this.notificacoes, problema);
  }
}
