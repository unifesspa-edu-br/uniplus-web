import {
  ChaveDeSubstituicao,
  type DestinoPreAssinado,
  type ResultadoEnvio,
  destinoExpirado,
} from '@uniplus/shared-core/http';
import type {
  ArquivoDaApresentacaoDto,
  ConfirmarEnvioDeDocumentoDaInscricaoRequest,
  IniciarEnvioDeDocumentoDaInscricaoRequest,
} from '@uniplus/shared-data/selecao';
import type { AlvoDoEnvio, ArquivoEnviado } from '@uniplus/shared-ui/components';

export type DestinoDoArquivo = DestinoPreAssinado & { readonly arquivoId: string };

/**
 * Onde um arquivo escolhido parou no envio a uma exigência: o que já se sabe dele para a nova tentativa
 * recomeçar do ponto certo. O mesmo arquivo para outra exigência é outra tentativa.
 */
export class TentativaDeEnvio {
  readonly chaveDaIniciacao = new ChaveDeSubstituicao();
  readonly chaveDaConfirmacao = new ChaveDeSubstituicao();
  private destino: DestinoDoArquivo | null = null;
  private etag: string | null = null;
  private enviado = false;

  constructor(
    private readonly alvo: AlvoDoEnvio,
    private readonly tamanhoBytes: number,
    private readonly tipoDeMidia: string,
  ) {}

  /** Os bytes já chegaram ao armazenamento: só a confirmação falta. */
  get bytesEnviados(): boolean {
    return this.enviado;
  }

  get arquivoId(): string | null {
    return this.destino?.arquivoId ?? null;
  }

  serveAo(alvo: AlvoDoEnvio): boolean {
    return this.alvo.chave === alvo.chave;
  }

  /** O destino já pedido à API, enquanto a URL pré-assinada não venceu. */
  destinoValido(): DestinoDoArquivo | null {
    return this.destino !== null && !destinoExpirado(this.destino) ? this.destino : null;
  }

  registrarDestino(destino: DestinoDoArquivo): void {
    this.destino = destino;
  }

  pedidoDeIniciacao(): IniciarEnvioDeDocumentoDaInscricaoRequest {
    return {
      exigenciaId: this.alvo.exigenciaId,
      ocorrenciaId: this.alvo.ocorrenciaId,
      apresentacaoId: null,
      tipoDeMidia: this.tipoDeMidia,
      tamanhoBytes: this.tamanhoBytes,
    };
  }

  /** A confirmação devolve à API o ETag do PUT, para fixar a versão do objeto que o verificador confere. */
  pedidoDeConfirmacao(): ConfirmarEnvioDeDocumentoDaInscricaoRequest {
    return { etag: this.etag };
  }

  registrarArmazenamento(armazenado: ResultadoEnvio): void {
    if (!armazenado.ok) {
      // A assinatura recusada não volta a valer: a nova tentativa pede outra URL.
      if (armazenado.expirada) this.destino = null;
      return;
    }
    if (armazenado.etag === null) return;
    this.etag = armazenado.etag;
    this.enviado = true;
  }

  arquivoConfirmado(confirmacao: ArquivoDaApresentacaoDto): ArquivoEnviado {
    return {
      arquivoId: confirmacao.arquivoId,
      apresentacaoId: confirmacao.apresentacaoId,
      chave: this.alvo.chave,
      tipoDeMidia: confirmacao.tipoDeMidia,
      // A API só informa o tamanho depois da verificação: vale o do arquivo escolhido.
      tamanhoBytes: this.tamanhoBytes,
      situacao: confirmacao.situacao.codigo,
      mensagem: confirmacao.mensagem,
      rotulo: confirmacao.rotulo,
      confirmadoEm: confirmacao.confirmadoEm,
    };
  }
}
