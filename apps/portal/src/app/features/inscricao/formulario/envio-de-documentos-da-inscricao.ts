import { Injectable, type Signal, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  type ProblemDetails,
  ProblemI18nService,
  type ResultadoEnvio,
  SignedUploadClient,
  baixarPeloAcesso,
  enviarAoStorage,
  isApiOk,
} from '@uniplus/shared-core/http';
import { InscricoesApi } from '@uniplus/shared-data/selecao';
import {
  type AlvoDoEnvio,
  type ArquivoEnviado,
  type DesfechoDaRemocao,
  type DesfechoDoDownload,
  type DesfechoDoEnvio,
  type EnvioDeDocumentos,
  tipoDeMidiaDoArquivo,
} from '@uniplus/shared-inscricao/formulario';

import { ComandosDoEnvio } from './comandos-do-envio';
import { type DestinoDoArquivo, TentativaDeEnvio } from './tentativa-de-envio';

type RecusaDoEnvio = Extract<DesfechoDoEnvio, { readonly ok: false }>;

const FORMATO_RECUSADO: RecusaDoEnvio = {
  ok: false,
  mensagem: 'O formato do arquivo não é aceito.',
  podeTentarDeNovo: false,
};
const FALHA_NO_ARMAZENAMENTO: RecusaDoEnvio = {
  ok: false,
  mensagem: 'Falha ao enviar o arquivo. Verifique a conexão e tente novamente.',
  podeTentarDeNovo: true,
};
const ENDERECO_VENCIDO: RecusaDoEnvio = {
  ok: false,
  mensagem: 'O endereço de envio não é mais válido. Tente novamente para obter um novo.',
  podeTentarDeNovo: true,
};
const STATUS_DE_SERVIDOR = 500;
/** Outra gravação da inscrição passou na frente; repetir o mesmo pedido depois dela dá certo. */
const INSCRICAO_ALTERADA = 'uniplus.selecao.documento_da_inscricao.inscricao_alterada';
/** O PUT falhou sem resposta do armazenamento: rede fora do ar. */
const SEM_RESPOSTA = 0;

type AoAndar = Parameters<EnvioDeDocumentos['enviar']>[2];

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

/**
 * Repetir só adianta quando a recusa do armazenamento não é do arquivo: o armazenamento que recusa o
 * conteúdo (400, 413) recusará de novo; falha de rede e de servidor passam. Nulo quando os bytes chegaram.
 */
function recusaDoArmazenamento(armazenado: ResultadoEnvio): DesfechoDoEnvio | null {
  // Sem o ETag a API não tem como fixar a versão do objeto que o verificador confere.
  if (armazenado.ok) return armazenado.etag === null ? FALHA_NO_ARMAZENAMENTO : null;
  if (armazenado.expirada) return ENDERECO_VENCIDO;
  const semRespostaOuDoServidor =
    armazenado.status === SEM_RESPOSTA || armazenado.status >= STATUS_DE_SERVIDOR;
  return { ...FALHA_NO_ARMAZENAMENTO, podeTentarDeNovo: semRespostaOuDoServidor };
}

class EnvioNoProcesso implements EnvioDeDocumentos {
  private readonly confirmados = signal<readonly ArquivoEnviado[]>([]);
  readonly arquivos: Signal<readonly ArquivoEnviado[]> = this.confirmados.asReadonly();
  private readonly contagemDeMudancas = signal(0);
  private readonly emAndamento = signal(0);
  readonly ocupado: Signal<boolean> = computed(() => this.emAndamento() > 0);
  readonly mudancas: Signal<number> = this.contagemDeMudancas.asReadonly();
  /** Uma tentativa por arquivo escolhido: repetir o mesmo `File` retoma dela. */
  private readonly tentativas = new WeakMap<File, TentativaDeEnvio>();
  private readonly comandos: ComandosDoEnvio;

  constructor(
    private readonly processoId: string,
    private readonly api: InscricoesApi,
    private readonly upload: SignedUploadClient,
    private readonly explicar: (problema: ProblemDetails) => string,
  ) {
    this.comandos = new ComandosDoEnvio(processoId, api);
  }

  enviar(alvo: AlvoDoEnvio, arquivo: File, aoAndar: AoAndar): Promise<DesfechoDoEnvio> {
    return this.contando(() => this.enviarArquivo(alvo, arquivo, aoAndar));
  }

  remover(arquivoId: string): Promise<DesfechoDaRemocao> {
    return this.contando(() => this.removerArquivo(arquivoId));
  }

  async baixar(arquivoId: string): Promise<DesfechoDoDownload> {
    const desfecho = await baixarPeloAcesso(() =>
      firstValueFrom(this.api.obterAcessoDoArquivo(this.processoId, arquivoId)),
    );
    switch (desfecho.situacao) {
      case 'iniciado':
        return { ok: true };
      case 'recusado':
        return { ok: false, mensagem: this.explicar(desfecho.problem) };
    }
  }

  private async contando<T>(operacao: () => Promise<T>): Promise<T> {
    this.emAndamento.update((n) => n + 1);
    try {
      return await operacao();
    } finally {
      this.emAndamento.update((n) => n - 1);
    }
  }

  private async enviarArquivo(
    alvo: AlvoDoEnvio,
    arquivo: File,
    aoAndar: AoAndar,
  ): Promise<DesfechoDoEnvio> {
    const tentativa = this.tentativaDe(arquivo, alvo);
    if (tentativa === null) return FORMATO_RECUSADO;
    if (!tentativa.bytesEnviados) {
      const recusa = await this.levarOsBytes(arquivo, tentativa, aoAndar);
      if (recusa !== null) return recusa;
    }
    return this.confirmarOEnvio(arquivo, tentativa, aoAndar);
  }

  /** Nulo quando os bytes chegaram ao armazenamento; senão, o desfecho que encerra o envio. */
  private async levarOsBytes(
    arquivo: File,
    tentativa: TentativaDeEnvio,
    aoAndar: AoAndar,
  ): Promise<DesfechoDoEnvio | null> {
    const obtido = await this.destinoDoEnvio(tentativa, aoAndar);
    if ('recusa' in obtido) return obtido.recusa;

    aoAndar('enviando', 0);
    const armazenado = await enviarAoStorage(this.upload, obtido.destino, arquivo, (progresso) =>
      aoAndar('enviando', progresso),
    );
    tentativa.registrarArmazenamento(armazenado);
    return recusaDoArmazenamento(armazenado);
  }

  /**
   * O destino já pedido à API, ou um novo quando não há ou venceu. Iniciar já avança a revisão da
   * inscrição, mesmo que o envio não chegue ao fim.
   */
  private async destinoDoEnvio(
    tentativa: TentativaDeEnvio,
    aoAndar: AoAndar,
  ): Promise<{ destino: DestinoDoArquivo } | { recusa: DesfechoDoEnvio }> {
    const vigente = tentativa.destinoValido();
    if (vigente !== null) return { destino: vigente };
    aoAndar('iniciando', 0);
    const { resultado, inconclusiva } = await this.comandos.iniciar(tentativa);
    if (!isApiOk(resultado)) {
      return { recusa: this.recusa(resultado.problem, inconclusiva) };
    }
    tentativa.registrarDestino(resultado.data);
    this.revisaoAvancou();
    return { destino: resultado.data };
  }

  /** A URL cumpriu o papel: a confirmação só precisa do id do arquivo e do ETag que o PUT devolveu. */
  private async confirmarOEnvio(
    arquivo: File,
    tentativa: TentativaDeEnvio,
    aoAndar: AoAndar,
  ): Promise<DesfechoDoEnvio> {
    const arquivoId = tentativa.arquivoId;
    if (arquivoId === null) return FALHA_NO_ARMAZENAMENTO;
    aoAndar('confirmando', 100);
    const { resultado, inconclusiva } = await this.comandos.confirmar(arquivoId, tentativa);
    if (!isApiOk(resultado)) return this.recusa(resultado.problem, inconclusiva);
    this.tentativas.delete(arquivo);
    const confirmado = tentativa.arquivoConfirmado(resultado.data);
    this.incluirConfirmado(confirmado);
    return { ok: true, arquivo: confirmado };
  }

  private async removerArquivo(arquivoId: string): Promise<DesfechoDaRemocao> {
    const { resultado, inconclusiva } = await this.comandos.remover(arquivoId);
    if (isApiOk(resultado)) {
      this.retirarConfirmado(arquivoId);
      return { ok: true };
    }
    if (inconclusiva) this.revisaoAvancou();
    return { ok: false, mensagem: this.explicar(resultado.problem) };
  }

  private incluirConfirmado(arquivo: ArquivoEnviado): void {
    this.confirmados.update((lista) => [...lista, arquivo]);
    this.revisaoAvancou();
  }

  private retirarConfirmado(arquivoId: string): void {
    this.confirmados.update((lista) => lista.filter((a) => a.arquivoId !== arquivoId));
    this.revisaoAvancou();
  }

  /**
   * A página relê a revisão da inscrição para não salvar sobre a antiga: o comando a avançou ou, sem
   * resposta conclusiva, o servidor pode tê-la avançado.
   */
  private revisaoAvancou(): void {
    this.contagemDeMudancas.update((n) => n + 1);
  }

  private tentativaDe(arquivo: File, alvo: AlvoDoEnvio): TentativaDeEnvio | null {
    const tipoDeMidia = tipoDeMidiaDoArquivo(arquivo.name);
    if (tipoDeMidia === null) return null;
    const existente = this.tentativas.get(arquivo);
    if (existente?.serveAo(alvo)) return existente;
    const nova = new TentativaDeEnvio(alvo, arquivo.size, tipoDeMidia);
    this.tentativas.set(arquivo, nova);
    return nova;
  }

  /**
   * Repetir só adianta quando a recusa não é do arquivo: falha de rede ou do servidor, inclusive o
   * antivírus fora do ar. Um arquivo recusado pelo conteúdo ou pela exigência precisa ser trocado.
   */
  private recusa(problema: ProblemDetails, inconclusiva: boolean): DesfechoDoEnvio {
    if (inconclusiva) this.revisaoAvancou();
    return {
      ok: false,
      mensagem: this.explicar(problema),
      podeTentarDeNovo: inconclusiva || problema.code === INSCRICAO_ALTERADA,
    };
  }
}
