import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  SignedUploadClient,
  enviarAoStorage,
  type ResultadoEnvio,
} from '@uniplus/shared-core/http';
import {
  FinalidadeDoDocumento,
  IniciarEnvioDoDocumentoAPublicarDto,
  ProcessosSeletivosApi,
} from '@uniplus/shared-data/selecao';

import { GravacaoDoProcesso } from './gravacao/gravacao-do-processo';
import type { ResultadoGravacao, ResultadoIniciacao } from './gravacao/resultado-da-gravacao';
import { TIPO_DE_MIDIA_DO_EDITAL } from './hidratacao';

/** O envio do documento do edital em três passos: iniciar, enviar ao storage e confirmar. */
@Injectable()
export class EnvioDoEdital {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly upload = inject(SignedUploadClient);
  private readonly gravacao = inject(GravacaoDoProcesso);

  /**
   * Documentos do edital já registrados no processo, para a retomada e para a reverificação depois
   * de uma leitura que falhou. Só o documento do edital: os anexos vivem na mesma coleção.
   */
  listarDocumentos(processoSeletivoId: string) {
    return firstValueFrom(
      this.api.listarDocumentosAPublicar(
        processoSeletivoId,
        FinalidadeDoDocumento.documentoDoEdital,
      ),
    );
  }

  /**
   * A URL vem assinada e com validade curta, e não é guardada: quem a tem abre o arquivo sem
   * passar por autorização de novo, por isso o servidor a emite por pedido.
   */
  obterAcessoAoDocumento(processoSeletivoId: string, documentoAPublicarId: string) {
    return firstValueFrom(
      this.api.obterAcessoDocumentoAPublicar(processoSeletivoId, documentoAPublicarId),
    );
  }

  /** Passo 1: registro pendente + URL pré-assinada. */
  async iniciarUpload(
    processoSeletivoId: string,
    nomeArquivo: string,
  ): Promise<ResultadoIniciacao> {
    const request = {
      finalidade: FinalidadeDoDocumento.documentoDoEdital,
      nomeArquivo,
      tipoDeMidia: TIPO_DE_MIDIA_DO_EDITAL,
    };
    const resultado = await this.gravacao.gravar('iniciacaoDoEdital', request, (contexto) =>
      this.api.iniciarEnvioDocumentoAPublicar(processoSeletivoId, request, contexto),
    );
    return resultado.ok ? { ok: true, iniciacao: resultado.dados } : resultado;
  }

  /** Passo 2: envia o arquivo direto ao storage. */
  enviarArquivo(
    iniciacao: IniciarEnvioDoDocumentoAPublicarDto,
    arquivo: File,
    onProgresso: (percentual: number) => void,
  ): Promise<ResultadoEnvio> {
    return enviarAoStorage(this.upload, iniciacao, arquivo, onProgresso);
  }

  /**
   * Confirmação sem resposta definitiva: o documento pode já estar selado e imutável, e a única
   * saída correta é repetir esta confirmação com a mesma chave. Trocar de arquivo criaria um
   * segundo edital e perderia a referência do primeiro.
   */
  temConfirmacaoPendente(): boolean {
    return this.gravacao.retidaPendente('confirmacaoDoEdital');
  }

  /** Passo 3: a API valida o objeto no storage e sela o documento. */
  confirmarUpload(
    processoSeletivoId: string,
    documentoAPublicarId: string,
  ): Promise<ResultadoGravacao> {
    return this.gravacao.gravarRetida('confirmacaoDoEdital', (contexto) =>
      this.api.confirmarEnvioDocumentoAPublicar(processoSeletivoId, documentoAPublicarId, contexto),
    );
  }
}
