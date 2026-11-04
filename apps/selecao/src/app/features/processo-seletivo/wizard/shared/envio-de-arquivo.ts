import { isApiOk, type ProblemDetails, destinoExpirado } from '@uniplus/shared-core/http';
import type {
  FinalidadeDoDocumento,
  IniciarEnvioDoDocumentoAPublicarDto,
} from '@uniplus/shared-data/selecao';

import type { UploadItem } from '../processo-seletivo.models';
import type { EnvioDoAnexo } from './anexos-do-edital/envio-do-anexo.service';

/** O que o envio de um arquivo lê e escreve no item que a tela exibe. */
export type EstadoDoEnvio = Pick<
  UploadItem,
  | 'fase'
  | 'progress'
  | 'documentoAPublicarId'
  | 'expiraEm'
  | 'enviado'
  | 'confirmacaoIndefinida'
  | 'mensagemErro'
>;

/** Onde o envio guarda o que acontece com o arquivo: o item da lista de quem o escolheu. */
export interface AlvoDoEnvio {
  /** O estado atual do item; `undefined` quando o item já saiu da lista. */
  estado(): EstadoDoEnvio | undefined;
  atualizar(alteracao: Partial<EstadoDoEnvio>): void;
}

export interface OpcoesDoEnvioDeArquivo {
  readonly envio: EnvioDoAnexo;
  readonly arquivo: File;
  readonly finalidade: FinalidadeDoDocumento;
  /** O tipo de mídia que o envio declara; `null` quando o formato não serve a este uso. */
  readonly tipoDeMidia: string | null;
  /** O que dizer quando o formato do arquivo não é aceito. */
  readonly recusaDoFormato: string;
  /** O texto da recusa do servidor, resolvido pelo mecanismo padrão de mensagens. */
  readonly explicar: (problema: ProblemDetails) => string;
  /**
   * Se o envio ainda interessa a quem o pediu. A tela do editor sobrevive à troca de processo, e a
   * resposta de um envio disparado para o anterior não pode escrever no atual.
   */
  readonly vale: () => boolean;
}

/**
 * O envio de UM arquivo ao storage, nas três fases (iniciar, PUT direto, confirmar), guardando no
 * item a fase que falhou para a nova tentativa recomeçar do ponto certo.
 *
 * Quem escolhe o arquivo decide onde o estado vive (o rascunho do wizard, o formulário de um
 * ato); aqui só se sabe como o envio avança. Os bytes e a URL pré-assinada ficam na instância,
 * nunca no item: a URL é credencial de acesso ao storage.
 */
export class EnvioDeArquivo {
  private destino: IniciarEnvioDoDocumentoAPublicarDto | null = null;
  private emCurso = false;
  private confirmado = false;

  constructor(private readonly opcoes: OpcoesDoEnvioDeArquivo) {}

  get arquivo(): File {
    return this.opcoes.arquivo;
  }

  /** O arquivo foi confirmado: não há mais o que enviar nem os bytes a guardar. */
  get foiConfirmado(): boolean {
    return this.confirmado;
  }

  private get vale(): boolean {
    return this.opcoes.vale();
  }

  async executar(processoId: string, alvo: AlvoDoEnvio): Promise<void> {
    if (this.emCurso) return;

    this.emCurso = true;
    try {
      await this.percorrer(processoId, alvo);
    } finally {
      this.emCurso = false;
    }
  }

  private async percorrer(processoId: string, alvo: AlvoDoEnvio): Promise<void> {
    const atual = alvo.estado();
    if (atual === undefined) return;

    // O arquivo já chegou ao storage numa tentativa anterior: repetir o PUT seria desperdício e
    // esbarraria numa URL possivelmente vencida. Só a confirmação falta.
    if (soFaltaConfirmar(atual) && atual.documentoAPublicarId !== undefined) {
      await this.confirmar(processoId, alvo, atual.documentoAPublicarId);
      return;
    }

    let destino = this.destino;
    if (destino === null || destinoExpirado(destino)) {
      if (this.opcoes.tipoDeMidia === null) {
        this.falhar(alvo, this.opcoes.recusaDoFormato);
        return;
      }

      this.atualizar(alvo, { fase: 'iniciando', progress: 0, mensagemErro: undefined });
      const { resultado } = await this.opcoes.envio.iniciar(processoId, {
        finalidade: this.opcoes.finalidade,
        nomeArquivo: this.opcoes.arquivo.name,
        tipoDeMidia: this.opcoes.tipoDeMidia,
      });
      if (!this.vale) return;
      if (!isApiOk(resultado)) {
        this.falhar(alvo, this.opcoes.explicar(resultado.problem));
        return;
      }
      destino = resultado.data;
      this.destino = destino;
      this.atualizar(alvo, {
        documentoAPublicarId: destino.documentoAPublicarId,
        expiraEm: destino.expiraEm,
      });
    }

    this.atualizar(alvo, { fase: 'enviando' });
    const envio = await this.opcoes.envio.enviarArquivo(destino, this.opcoes.arquivo, (progress) =>
      this.atualizar(alvo, { progress }),
    );
    if (!this.vale) return;
    if (!envio.ok) {
      // A assinatura recusada não volta a valer: a retentativa pede outra URL.
      if (envio.expirada) {
        this.destino = null;
        this.atualizar(alvo, { documentoAPublicarId: undefined, expiraEm: undefined });
        this.falhar(alvo, 'O endereço de envio não é mais válido. Tente novamente para obter um novo.');
        return;
      }
      this.falhar(alvo, 'Falha ao enviar o arquivo. Verifique a conexão e tente novamente.');
      return;
    }

    this.atualizar(alvo, { enviado: true, progress: 100 });
    // A URL cumpriu o papel; some da memória para não ficar credencial viva à toa.
    this.destino = null;
    await this.confirmar(processoId, alvo, destino.documentoAPublicarId);
  }

  private async confirmar(
    processoId: string,
    alvo: AlvoDoEnvio,
    documentoAPublicarId: string,
  ): Promise<void> {
    this.atualizar(alvo, { fase: 'confirmando', progress: 100 });
    const { resultado, inconclusiva } = await this.opcoes.envio.confirmar(
      processoId,
      documentoAPublicarId,
    );
    if (!this.vale) return;

    if (!isApiOk(resultado)) {
      const mensagem = this.opcoes.explicar(resultado.problem);
      this.atualizar(alvo, { confirmacaoIndefinida: inconclusiva });
      this.falhar(
        alvo,
        inconclusiva
          ? `${mensagem} Não é possível saber se o arquivo foi registrado; use "Tentar novamente" para repetir a mesma confirmação.`
          : mensagem,
      );
      return;
    }

    this.atualizar(alvo, {
      fase: 'confirmado',
      progress: 100,
      mensagemErro: undefined,
      confirmacaoIndefinida: false,
    });
    this.confirmado = true;
  }

  /** Funil de toda escrita: só escreve enquanto o envio ainda interessa a quem o pediu. */
  private atualizar(alvo: AlvoDoEnvio, alteracao: Partial<EstadoDoEnvio>): void {
    if (!this.vale) return;
    alvo.atualizar(alteracao);
  }

  private falhar(alvo: AlvoDoEnvio, mensagem: string): void {
    this.atualizar(alvo, { fase: 'erro', mensagemErro: mensagem });
  }
}

/** O arquivo já chegou ao storage: da tentativa só resta a confirmação, que não usa os bytes. */
export function soFaltaConfirmar(
  estado: Pick<EstadoDoEnvio, 'enviado' | 'documentoAPublicarId'>,
): boolean {
  return estado.enviado === true && estado.documentoAPublicarId !== undefined;
}
