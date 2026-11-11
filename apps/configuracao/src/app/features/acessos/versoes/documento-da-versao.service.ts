import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ProblemI18nService,
  SignedUploadClient,
  abrirAcessoEmNovaAba,
  enviarAoStorage,
  isApiOk,
  type ApiResult,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  VersoesDoPerfilApi,
  type EnvioDoDocumentoDto,
  type VersaoPendenteDto,
} from '@uniplus/shared-data/autorizacao';
import { mensagemDaRecusa } from '../falha-de-servidor';

export type FaseDoEnvio = 'registrando' | 'enviando' | 'confirmando';

export type DesfechoDoDocumento =
  | { readonly ok: true }
  | { readonly ok: false; readonly mensagem: string };

export type DesfechoDaAbertura =
  | 'aberta'
  | 'bloqueada'
  | 'abandonada'
  | { readonly recusa: string };

export type AoAndar = (fase: FaseDoEnvio, percentual: number) => void;

const FALHA_NO_ARMAZENAMENTO = 'Falha ao enviar o arquivo. Verifique a conexão e tente novamente.';
const ENDERECO_VENCIDO = 'O endereço de envio venceu. Tente novamente para obter um novo.';
const SEM_DOCUMENTO_A_ENVIAR = 'A versão não aguarda um documento.';

/**
 * O documento instituidor da versão: a API registra o documento e devolve a URL assinada, o
 * navegador envia o PDF direto ao armazenamento e a API recebe o ETag para mandá-lo à verificação.
 */
@Injectable({ providedIn: 'root' })
export class DocumentoDaVersaoService {
  private readonly api = inject(VersoesDoPerfilApi);
  private readonly armazenamento = inject(SignedUploadClient);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);

  /** Envia o PDF para a URL que a criação da versão devolveu e confirma o envio. */
  async enviar(envio: EnvioDoDocumentoDto, arquivo: File, aoAndar: AoAndar): Promise<DesfechoDoDocumento> {
    const { perfilId, versaoId, urlDeEnvio, tipoDeMidia, expiraEm } = envio;
    const armazenado = await enviarAoStorage(
      this.armazenamento,
      { urlUpload: urlDeEnvio, contentTypeExigido: tipoDeMidia, expiraEm },
      arquivo,
      (percentual) => aoAndar('enviando', percentual),
    );
    if (!armazenado.ok) {
      return { ok: false, mensagem: armazenado.expirada ? ENDERECO_VENCIDO : FALHA_NO_ARMAZENAMENTO };
    }
    aoAndar('confirmando', 100);
    const confirmacao = await firstValueFrom(
      this.api.confirmarDocumento(perfilId, versaoId, armazenado.etag),
    );
    return isApiOk(confirmacao) ? { ok: true } : this.recusa(confirmacao.problem);
  }

  /**
   * Envia o PDF de uma versão pendente cujo documento ainda não seguiu: o que aguarda o envio ganha
   * outra URL, e o recusado pela verificação ganha outro documento.
   */
  async reenviar(
    perfilId: string,
    versao: VersaoPendenteDto,
    arquivo: File,
    aoAndar: AoAndar,
  ): Promise<DesfechoDoDocumento> {
    aoAndar('registrando', 0);
    const envio = await this.novoEnvio(perfilId, versao, arquivo);
    if (envio === null) return { ok: false, mensagem: SEM_DOCUMENTO_A_ENVIAR };
    return isApiOk(envio) ? this.enviar(envio.data, arquivo, aoAndar) : this.recusa(envio.problem);
  }

  /** Abre o documento verificado numa aba nova, pedindo a URL assinada no clique. */
  async abrir(perfilId: string, versaoId: string, aindaVale: () => boolean): Promise<DesfechoDaAbertura> {
    const desfecho = await abrirAcessoEmNovaAba(
      () => firstValueFrom(this.api.lerDocumento(perfilId, versaoId)),
      aindaVale,
    );
    return desfecho.situacao === 'recusada'
      ? { recusa: this.texto(desfecho.problem) }
      : desfecho.situacao;
  }

  private novoEnvio(
    perfilId: string,
    versao: VersaoPendenteDto,
    arquivo: File,
  ): Promise<ApiResult<EnvioDoDocumentoDto> | null> {
    const chave = withIdempotencyKey();
    if (versao.situacaoDoDocumento === 'recusado') {
      return firstValueFrom(this.api.novoDocumento(perfilId, versao.versaoId, arquivo.size, chave));
    }
    return versao.situacaoDoDocumento === 'aguardando_envio'
      ? firstValueFrom(this.api.reemitirEnvio(perfilId, versao.versaoId, chave))
      : Promise.resolve(null);
  }

  private recusa(problema: ProblemDetails): DesfechoDoDocumento {
    return { ok: false, mensagem: this.texto(problema) };
  }

  private texto(problema: ProblemDetails): string {
    return mensagemDaRecusa(this.problemas, this.notificacoes, problema);
  }
}
