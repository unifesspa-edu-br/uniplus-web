import { Injectable, type Signal, inject, signal } from '@angular/core';
import {
  ChaveDeSubstituicao,
  type DestinoPreAssinado,
  ProblemI18nService,
  type ProblemDetails,
  SignedUploadClient,
  comChave,
  destinoExpirado,
  enviarAoStorage,
  isApiOk,
} from '@uniplus/shared-core/http';
import { InscricoesApi } from '@uniplus/shared-data/selecao';
import {
  type AlvoDoEnvio,
  type ArquivoEnviado,
  type DesfechoDaRemocao,
  type DesfechoDoEnvio,
  type EnvioDeDocumentos,
  tipoDeMidiaDoArquivo,
} from '@uniplus/shared-ui/components';

const FORMATO_NAO_ACEITO = 'O formato do arquivo não é aceito.';
const FALHA_NO_ARMAZENAMENTO = 'Falha ao enviar o arquivo. Verifique a conexão e tente novamente.';
const ENDERECO_VENCIDO =
  'O endereço de envio não é mais válido. Tente novamente para obter um novo.';
const STATUS_DE_SERVIDOR = 500;
/** O PUT falhou sem resposta do armazenamento: rede fora do ar. */
const SEM_RESPOSTA = 0;

/** Onde um arquivo parou: o que já se sabe dele para a nova tentativa recomeçar do ponto certo. */
interface Tentativa {
  /** A exigência para a qual a tentativa nasceu: o mesmo arquivo para outra exigência recomeça. */
  readonly chaveDoAlvo: string;
  readonly chaveDaIniciacao: ChaveDeSubstituicao;
  readonly chaveDaConfirmacao: ChaveDeSubstituicao;
  destino: (DestinoPreAssinado & { readonly arquivoId: string }) | null;
  /** Os bytes já chegaram ao armazenamento: só a confirmação falta. */
  enviado: boolean;
}

/**
 * O envio dos documentos exigidos da inscrição ao armazenamento: a API registra o arquivo pendente, o
 * navegador envia os bytes direto à URL pré-assinada e a API confirma lendo o objeto.
 */
@Injectable()
export class EnvioDeDocumentosDaInscricao {
  private readonly api = inject(InscricoesApi);
  private readonly upload = inject(SignedUploadClient);
  private readonly problemas = inject(ProblemI18nService);

  /** O envio dos documentos da inscrição do candidato neste processo. */
  paraOProcesso(processoId: string): EnvioDeDocumentos {
    return new EnvioNoProcesso(processoId, this.api, this.upload, (problema) =>
      this.mensagemDe(problema),
    );
  }

  private mensagemDe(problema: ProblemDetails): string {
    const mensagem = this.problemas.resolve(problema);
    return mensagem.detail ?? mensagem.title;
  }
}

class EnvioNoProcesso implements EnvioDeDocumentos {
  private readonly confirmados = signal<readonly ArquivoEnviado[]>([]);
  readonly arquivos: Signal<readonly ArquivoEnviado[]> = this.confirmados.asReadonly();
  private readonly contagemDeMudancas = signal(0);
  readonly mudancas: Signal<number> = this.contagemDeMudancas.asReadonly();
  /** Uma tentativa por arquivo escolhido: repetir o mesmo `File` retoma dela. */
  private readonly tentativas = new WeakMap<File, Tentativa>();
  private readonly chavesDaRemocao = new Map<string, ChaveDeSubstituicao>();

  constructor(
    private readonly processoId: string,
    private readonly api: InscricoesApi,
    private readonly upload: SignedUploadClient,
    private readonly explicar: (problema: ProblemDetails) => string,
  ) {}

  async enviar(
    alvo: AlvoDoEnvio,
    arquivo: File,
    aoAndar: Parameters<EnvioDeDocumentos['enviar']>[2],
  ): Promise<DesfechoDoEnvio> {
    const tipoDeMidia = tipoDeMidiaDoArquivo(arquivo.name);
    if (tipoDeMidia === null) {
      return { ok: false, mensagem: FORMATO_NAO_ACEITO, podeTentarDeNovo: false };
    }
    const tentativa = this.tentativaDe(arquivo, alvo);

    if (!tentativa.enviado) {
      let destino = tentativa.destino;
      if (destino === null || destinoExpirado(destino)) {
        aoAndar('iniciando', 0);
        const pedido = {
          exigenciaId: alvo.exigenciaId,
          ocorrenciaId: alvo.ocorrenciaId,
          apresentacaoId: null,
          tipoDeMidia,
          tamanhoBytes: arquivo.size,
        };
        const { resultado, inconclusiva } = await comChave(
          tentativa.chaveDaIniciacao,
          pedido,
          (contexto) => this.api.iniciarEnvioDeDocumento(this.processoId, pedido, contexto),
        );
        if (!isApiOk(resultado)) {
          return this.recusa(resultado.problem, inconclusiva);
        }
        destino = resultado.data;
        tentativa.destino = destino;
      }

      aoAndar('enviando', 0);
      const envio = await enviarAoStorage(this.upload, destino, arquivo, (progresso) =>
        aoAndar('enviando', progresso),
      );
      if (!envio.ok) {
        // A assinatura recusada não volta a valer: a nova tentativa pede outra URL.
        if (envio.expirada) tentativa.destino = null;
        return {
          ok: false,
          mensagem: envio.expirada ? ENDERECO_VENCIDO : FALHA_NO_ARMAZENAMENTO,
          // O armazenamento que recusa o conteúdo (400, 413) recusará de novo; falha de rede e de servidor passam.
          podeTentarDeNovo:
            envio.expirada || envio.status === SEM_RESPOSTA || envio.status >= STATUS_DE_SERVIDOR,
        };
      }
      tentativa.enviado = true;
    }

    // A URL cumpriu o papel; a confirmação só precisa do id do arquivo.
    const arquivoId = tentativa.destino?.arquivoId;
    if (arquivoId === undefined) {
      return { ok: false, mensagem: FALHA_NO_ARMAZENAMENTO, podeTentarDeNovo: true };
    }
    aoAndar('confirmando', 100);
    const { resultado, inconclusiva } = await comChave(
      tentativa.chaveDaConfirmacao,
      arquivoId,
      (contexto) => this.api.confirmarEnvioDeDocumento(this.processoId, arquivoId, contexto),
    );
    if (!isApiOk(resultado)) return this.recusa(resultado.problem, inconclusiva);

    this.tentativas.delete(arquivo);
    const confirmado: ArquivoEnviado = {
      arquivoId: resultado.data.arquivoId,
      chave: alvo.chave,
      nome: arquivo.name,
      tipoDeMidia: resultado.data.tipoDeMidia,
      tamanhoBytes: Number(resultado.data.tamanhoBytes),
    };
    this.confirmados.update((lista) => [...lista, confirmado]);
    this.contagemDeMudancas.update((n) => n + 1);
    return { ok: true, arquivo: confirmado };
  }

  async remover(arquivoId: string): Promise<DesfechoDaRemocao> {
    // A chave acompanha o arquivo: repetir depois de uma resposta perdida recebe o replay, e não um 404.
    const chave = this.chavesDaRemocao.get(arquivoId) ?? new ChaveDeSubstituicao();
    this.chavesDaRemocao.set(arquivoId, chave);
    const { resultado, inconclusiva } = await comChave(chave, arquivoId, (contexto) =>
      this.api.removerArquivoDeDocumento(this.processoId, arquivoId, contexto),
    );
    if (!isApiOk(resultado)) {
      if (!inconclusiva) this.chavesDaRemocao.delete(arquivoId);
      return { ok: false, mensagem: this.explicar(resultado.problem) };
    }
    this.chavesDaRemocao.delete(arquivoId);
    this.confirmados.update((lista) => lista.filter((a) => a.arquivoId !== arquivoId));
    this.contagemDeMudancas.update((n) => n + 1);
    return { ok: true };
  }

  private tentativaDe(arquivo: File, alvo: AlvoDoEnvio): Tentativa {
    let tentativa = this.tentativas.get(arquivo);
    if (tentativa === undefined || tentativa.chaveDoAlvo !== alvo.chave) {
      tentativa = {
        chaveDoAlvo: alvo.chave,
        chaveDaIniciacao: new ChaveDeSubstituicao(),
        chaveDaConfirmacao: new ChaveDeSubstituicao(),
        destino: null,
        enviado: false,
      };
      this.tentativas.set(arquivo, tentativa);
    }
    return tentativa;
  }

  /**
   * Repetir só adianta quando a recusa não é do arquivo: falha de rede ou do servidor, inclusive o
   * antivírus fora do ar. Um arquivo recusado pelo conteúdo ou pela exigência precisa ser trocado.
   */
  private recusa(problema: ProblemDetails, inconclusiva: boolean): DesfechoDoEnvio {
    return {
      ok: false,
      mensagem: this.explicar(problema),
      podeTentarDeNovo: inconclusiva,
    };
  }
}
