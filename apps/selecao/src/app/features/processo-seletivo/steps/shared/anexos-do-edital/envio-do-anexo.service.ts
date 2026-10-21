import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  SignedUploadClient,
  ChaveDeSubstituicao,
  comChave,
  type RespostaDoComando,
  enviarAoStorage,
  type ResultadoEnvio,
} from '@uniplus/shared-core/http';
import {
  ProcessosSeletivosApi,
  type DocumentoAPublicarDto,
  type IniciarEnvioDoDocumentoAPublicarDto,
  type IniciarEnvioDoDocumentoAPublicarRequest,
} from '@uniplus/shared-data/selecao';


/**
 * Os três passos do envio de UM anexo, escondendo do componente quando a `Idempotency-Key` pode
 * ser reaproveitada.
 *
 * Cada arquivo tem o seu: a chave segue o corpo, e dois anexos em envio ao mesmo tempo não podem
 * dividir a chave de iniciação nem a de confirmação. Repetir a mesma iniciação ou a mesma
 * confirmação depois de uma resposta inconclusiva recebe o replay em vez de criar outro documento
 * imutável.
 */
export class EnvioDoAnexo {
  private readonly chaveIniciacao = new ChaveDeSubstituicao();
  private readonly chaveConfirmacao = new ChaveDeSubstituicao();

  constructor(
    private readonly api: ProcessosSeletivosApi,
    private readonly upload: SignedUploadClient,
  ) {}

  /** Passo 1: o documento pendente e a URL pré-assinada. */
  iniciar(
    processoSeletivoId: string,
    request: IniciarEnvioDoDocumentoAPublicarRequest,
  ): Promise<RespostaDoComando<IniciarEnvioDoDocumentoAPublicarDto>> {
    return comChave(this.chaveIniciacao, request, (contexto) =>
      this.api.iniciarEnvioDocumentoAPublicar(processoSeletivoId, request, contexto),
    );
  }

  /** Passo 2: os bytes direto ao storage. */
  enviarArquivo(
    destino: IniciarEnvioDoDocumentoAPublicarDto,
    arquivo: File,
    onProgresso: (percentual: number) => void,
  ): Promise<ResultadoEnvio> {
    return enviarAoStorage(this.upload, destino, arquivo, onProgresso);
  }

  /** Passo 3: a API valida o conteúdo, calcula o hash e sela o documento. */
  confirmar(
    processoSeletivoId: string,
    documentoAPublicarId: string,
  ): Promise<RespostaDoComando<DocumentoAPublicarDto>> {
    return comChave(this.chaveConfirmacao, documentoAPublicarId, (contexto) =>
      this.api.confirmarEnvioDocumentoAPublicar(processoSeletivoId, documentoAPublicarId, contexto),
    );
  }
}

/** Abre os envios dos anexos e lê o que o processo publicou. Provido por componente. */
@Injectable()
export class AnexosDoEditalService {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly upload = inject(SignedUploadClient);

  /** Um envio novo, com as próprias chaves de idempotência. */
  abrirEnvio(): EnvioDoAnexo {
    return new EnvioDoAnexo(this.api, this.upload);
  }

  /** O acesso de leitura a um anexo confirmado, emitido no pedido e com validade curta. */
  obterAcesso(processoSeletivoId: string, documentoAPublicarId: string) {
    return firstValueFrom(this.api.obterAcessoDocumentoAPublicar(processoSeletivoId, documentoAPublicarId));
  }

  /** Os atos do processo, de onde se lê o que a versão vigente publicou como anexo. */
  listarAtos(processoSeletivoId: string) {
    return firstValueFrom(this.api.listarAtosDoProcesso(processoSeletivoId));
  }
}
