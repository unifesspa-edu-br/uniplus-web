import { HttpContext, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ApiFailure,
  ProblemDetails,
  SignedUploadClient,
  idempotencyKey,
  isApiOk,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import {
  CriarProcessoSeletivoCommand,
  IniciarUploadDocumentoEditalDto,
  ProcessosSeletivosApi,
} from '@uniplus/shared-data/selecao';

/** Recusa nomeada por `ProblemDetails`, para o chamador exibir e decidir o retry. */
export interface FalhaOperacao {
  readonly ok: false;
  readonly problem: ProblemDetails;
}

export type ResultadoCriacao = { readonly ok: true; readonly processoSeletivoId: string } | FalhaOperacao;

export type ResultadoIniciacao =
  | { readonly ok: true; readonly iniciacao: IniciarUploadDocumentoEditalDto }
  | FalhaOperacao;

export type ResultadoConfirmacao = { readonly ok: true } | FalhaOperacao;

/**
 * Falha do envio ao storage. `expirada` separa o caso em que repetir o mesmo
 * PUT é inútil — a assinatura da URL não volta a valer.
 */
export interface EnvioFalhou {
  readonly ok: false;
  readonly status: number;
  readonly expirada: boolean;
}

export type ResultadoEnvio = { readonly ok: true } | EnvioFalhou;

const PROCESSING_CONFLICT = 'uniplus.idempotency.processing_conflict';
const NETWORK_ERROR = 'uniplus.client.network_error';

/**
 * Orquestra o cadastro inicial do Processo Seletivo e o anexo do edital,
 * escondendo dos componentes as duas mecânicas que erram fácil: quando a
 * `Idempotency-Key` pode ser reaproveitada e o que significa repetir cada fase
 * do upload.
 *
 * Uma chave por operação — criar, iniciar e confirmar são comandos distintos e
 * não compartilham chave.
 */
@Injectable()
export class CadastroInicialService {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly upload = inject(SignedUploadClient);

  private chaveCriacao = idempotencyKey.create();
  private chaveIniciacao = idempotencyKey.create();
  private chaveConfirmacao = idempotencyKey.create();

  /**
   * Comando de uma criação que ficou sem resposta definitiva (falha de rede ou
   * 5xx). O servidor pode tê-la executado, então a retentativa precisa repetir
   * o **mesmo corpo com a mesma chave** para receber o replay em vez de criar
   * um segundo processo. Enquanto isso não se resolve, editar os campos não
   * muda o que será reenviado — daí o congelamento na interface.
   */
  private criacaoPendente: CriarProcessoSeletivoCommand | null = null;

  /** Há criação sem resposta definitiva aguardando retentativa. */
  temCriacaoPendente(): boolean {
    return this.criacaoPendente !== null;
  }

  /**
   * Cria o processo em rascunho. O comando recebido já é um instantâneo do
   * rascunho: quem chama congela os campos antes, para que a resposta nunca
   * descreva um estado diferente do que foi enviado.
   */
  async criar(command: CriarProcessoSeletivoCommand): Promise<ResultadoCriacao> {
    const comando = this.criacaoPendente ?? command;
    const result = await firstValueFrom(this.api.criar(comando, contextoCom(this.chaveCriacao)));

    if (isApiOk(result)) {
      this.chaveCriacao = idempotencyKey.create();
      this.criacaoPendente = null;
      return { ok: true, processoSeletivoId: result.data };
    }

    const chaveAnterior = this.chaveCriacao;
    this.chaveCriacao = proximaChave(chaveAnterior, result);
    // Chave preservada significa resposta inconclusiva: o comando fica retido
    // para ser repetido igual. Chave nova significa recusa definitiva, e o
    // próximo envio parte do rascunho corrigido.
    this.criacaoPendente = this.chaveCriacao === chaveAnterior ? comando : null;
    return { ok: false, problem: result.problem };
  }

  /** Passo 1 do anexo: registro pendente + URL pré-assinada. */
  async iniciarUpload(processoSeletivoId: string): Promise<ResultadoIniciacao> {
    const result = await firstValueFrom(
      this.api.iniciarUploadDocumentoEdital(processoSeletivoId, contextoCom(this.chaveIniciacao)),
    );

    if (isApiOk(result)) {
      this.chaveIniciacao = idempotencyKey.create();
      return { ok: true, iniciacao: result.data };
    }

    this.chaveIniciacao = proximaChave(this.chaveIniciacao, result);
    return { ok: false, problem: result.problem };
  }

  /**
   * Passo 2: envia o arquivo direto ao storage, relatando o progresso em bytes.
   *
   * Este PUT não passa pelos interceptors da aplicação, então a falha chega
   * como erro HTTP de verdade. 403 é como o storage recusa assinatura inválida
   * — na prática, URL expirada: repetir o mesmo PUT nunca funciona, e o
   * chamador precisa recomeçar da iniciação.
   */
  enviarArquivo(
    iniciacao: IniciarUploadDocumentoEditalDto,
    arquivo: File,
    onProgresso: (percentual: number) => void,
  ): Promise<ResultadoEnvio> {
    return new Promise<ResultadoEnvio>((resolve) => {
      this.upload
        .enviar(iniciacao.urlUpload, arquivo, iniciacao.contentTypeExigido)
        .subscribe({
          next: (evento) => {
            if (evento.type === HttpEventType.UploadProgress) {
              onProgresso(percentualDe(evento.loaded, evento.total));
            }
          },
          error: (erro: unknown) => {
            const status = statusDe(erro);
            resolve({ ok: false, status, expirada: status === 403 });
          },
          complete: () => {
            onProgresso(100);
            resolve({ ok: true });
          },
        });
    });
  }

  /**
   * Confirmação que ficou sem resposta definitiva. O documento pode já estar
   * selado no servidor — imutável, portanto — e a única saída correta é repetir
   * esta mesma confirmação com a mesma chave até obter resposta. Trocar de
   * arquivo aqui criaria um segundo edital imutável e perderia a referência do
   * primeiro.
   */
  private confirmacaoPendente = false;

  /** Há confirmação sem resposta definitiva aguardando retentativa. */
  temConfirmacaoPendente(): boolean {
    return this.confirmacaoPendente;
  }

  /** Passo 3: a API valida o objeto no storage e sela o documento. */
  async confirmarUpload(
    processoSeletivoId: string,
    documentoEditalId: string,
  ): Promise<ResultadoConfirmacao> {
    const result = await firstValueFrom(
      this.api.confirmarUploadDocumentoEdital(
        processoSeletivoId,
        documentoEditalId,
        contextoCom(this.chaveConfirmacao),
      ),
    );

    if (isApiOk(result)) {
      this.chaveConfirmacao = idempotencyKey.create();
      this.confirmacaoPendente = false;
      return { ok: true };
    }

    const chaveAnterior = this.chaveConfirmacao;
    this.chaveConfirmacao = proximaChave(chaveAnterior, result);
    // Mesma leitura da criação: chave preservada é resposta inconclusiva.
    this.confirmacaoPendente = this.chaveConfirmacao === chaveAnterior;
    return { ok: false, problem: result.problem };
  }
}

/**
 * Regra de rotação da `Idempotency-Key`, por código antes de status: o filtro
 * do backend guarda a resposta de qualquer status abaixo de 500, então reenviar
 * um corpo corrigido com a mesma chave devolveria `body_mismatch` em vez de
 * processar o comando novo. As exceções vão na direção oposta —
 * `processing_conflict` e falha sem resposta pedem retry com a mesma chave,
 * porque a execução anterior ainda pode concluir.
 */
function proximaChave(chaveAtual: string, falha: ApiFailure): string {
  const { code, status } = falha.problem;

  // Só estes três casos deixam em aberto se o comando foi executado.
  if (code === PROCESSING_CONFLICT || code === NETWORK_ERROR || status >= 500) {
    return chaveAtual;
  }
  // Todo o resto é recusa definitiva — inclusive `body_mismatch` e o 413 de
  // corpo acima do limite do filtro de idempotência. Manter a chave nesses
  // casos prenderia a tela repetindo para sempre um comando que o servidor
  // nunca vai aceitar.
  return idempotencyKey.create();
}

function contextoCom(chave: string): HttpContext {
  return withIdempotencyKey(chave);
}

function percentualDe(loaded: number, total: number | undefined): number {
  if (total === undefined || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
}

function statusDe(erro: unknown): number {
  if (typeof erro === 'object' && erro !== null && 'status' in erro) {
    const status = (erro as { status: unknown }).status;
    return typeof status === 'number' ? status : 0;
  }
  return 0;
}
