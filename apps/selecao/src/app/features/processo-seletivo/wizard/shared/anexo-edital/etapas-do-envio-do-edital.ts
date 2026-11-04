import { computed, inject, Injectable, signal } from '@angular/core';
import { ProblemI18nService, destinoExpirado } from '@uniplus/shared-core/http';
import { IniciarEnvioDoDocumentoAPublicarDto } from '@uniplus/shared-data/selecao';

import { UploadItem } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { EnvioDoEdital } from '../envio-do-edital.service';

const ENVIO_EM_ANDAMENTO =
  'Há um envio de edital em andamento. Aguarde a conclusão antes de escolher outro arquivo.';
const EDITAL_JA_ANEXADO =
  'O edital já foi anexado e não pode ser substituído. Para trocar o arquivo, cadastre um novo processo seletivo.';
const CONFIRMACAO_SEM_RESPOSTA =
  'A confirmação do edital anterior ficou sem resposta e pode ter sido registrada. Use "Tentar novamente" antes de escolher outro arquivo.';
const SEM_PROCESSO =
  'O cadastro do processo precisa estar concluído antes de anexar o edital. Volte à identificação e avance.';
const URL_DE_ENVIO_EXPIRADA =
  'O endereço de envio não é mais válido. Tente novamente para obter um novo.';
const FALHA_NO_ENVIO = 'Falha ao enviar o arquivo. Verifique a conexão e tente novamente.';

/** O arquivo já chegou ao storage: da tentativa só resta a confirmação, que não usa os bytes. */
function soFaltaConfirmar(item: UploadItem): boolean {
  return item.enviado === true && item.documentoAPublicarId !== undefined;
}

/**
 * O envio do edital em três fases: iniciar, enviar ao storage e confirmar. Cada falha registra a
 * sua, para a retentativa recomeçar do ponto certo, porque repetir a confirmação de um objeto que
 * nunca chegou ao storage, ou repetir um PUT cuja URL expirou, não funciona.
 *
 * É dono do anexo em curso: o arquivo escolhido, a iniciação com a URL assinada e a recusa que a
 * tela mostra. Toda escrita no anexo passa por aqui e só vale enquanto o editor tratar do processo
 * em que o envio começou.
 */
@Injectable()
export class EtapasDoEnvioDoEdital {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly envioDoEdital = inject(EnvioDoEdital);
  private readonly problemI18n = inject(ProblemI18nService);

  readonly uploadError = signal<string | null>(null);

  /** Impede que uma segunda escolha atropele o envio em andamento. */
  private operacaoEmCurso = false;
  private iniciacaoAtual: IniciarEnvioDoDocumentoAPublicarDto | null = null;
  private geracaoDoAnexo: number | null = null;

  /** O arquivo escolhido e o processo em que o foi: o arquivo de um processo não vale em outro. */
  private readonly arquivoEmMemoria = signal<{ arquivo: File; geracao: number } | null>(null);
  private readonly arquivoSelecionado = computed(() => {
    const emMemoria = this.arquivoEmMemoria();
    return emMemoria !== null && emMemoria.geracao === this.store.geracao()
      ? emMemoria.arquivo
      : null;
  });

  readonly anexo = computed<UploadItem | undefined>(
    () => this.store.draft().identificacao.uploads[0],
  );
  private readonly anexoConfirmado = computed(() => this.anexo()?.fase === 'confirmado');
  private readonly anexoEmCurso = computed(() => {
    const fase = this.anexo()?.fase;
    return fase === 'iniciando' || fase === 'enviando' || fase === 'confirmando';
  });

  /**
   * O anexo fica indisponível enquanto qualquer gravação está em curso, depois de confirmado, e
   * também quando a confirmação ficou sem resposta: o documento pode já estar selado no servidor, e
   * substituí-lo criaria um segundo edital imutável.
   */
  readonly anexoBloqueado = computed(
    () => this.anexo()?.confirmacaoIndefinida === true || this.travadoSalvoConfirmacaoIndefinida(),
  );

  /** O que trava o anexo além da confirmação sem resposta, que é justamente o que a retomada resolve. */
  private readonly travadoSalvoConfirmacaoIndefinida = computed(
    () =>
      this.anexoEmCurso() ||
      this.anexoConfirmado() ||
      // Anexar é escrita, e o servidor recusa a de processo fora de rascunho.
      !this.store.aceitaEdicao() ||
      // Enviar outro durante a escolha entre confirmados criaria um terceiro documento imutável.
      this.store.documentosParaEscolha().length > 0 ||
      // Sem saber se já há edital confirmado, anexar é apostar: a API aceita um segundo.
      this.store.avisoDocumentos() !== null,
  );

  /** A retomada precisa do processo e de algo a repetir: o arquivo na memória, ou o PUT já feito. */
  readonly podeRetomar = computed(() => {
    const item = this.anexo();
    return (
      item !== undefined &&
      this.store.processoSeletivoId() !== null &&
      !this.travadoSalvoConfirmacaoIndefinida() &&
      (this.arquivoSelecionado() !== null || soFaltaConfirmar(item))
    );
  });

  /** A validação de formato e tamanho é do `ui-file-upload`, que só entrega arquivo aprovado. */
  escolher(arquivos: readonly File[]): void {
    const arquivo = arquivos[0];
    if (arquivo !== undefined) void this.anexar(arquivo);
  }

  async anexar(arquivo: File): Promise<void> {
    // A recusa vem antes de a geração ser recarimbada: fazê-lo antes desarmaria a guarda do envio
    // que ainda corre, e as respostas dele passariam a escrever como se fossem do processo atual.
    if (this.operacaoEmCurso) {
      this.uploadError.set(ENVIO_EM_ANDAMENTO);
      return;
    }
    this.geracaoDoAnexo = this.store.geracao();

    const recusa = this.recusaPorAnexoExistente();
    if (recusa !== null) {
      this.uploadError.set(recusa);
      return;
    }

    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      this.uploadError.set(SEM_PROCESSO);
      return;
    }

    this.uploadError.set(null);
    await this.comOperacaoEmCurso(async () => {
      this.arquivoEmMemoria.set({ arquivo, geracao: this.store.geracao() });
      this.iniciacaoAtual = null;
      this.registrarAnexo(arquivo);
      await this.executarUpload(processoId, arquivo);
    });
  }

  /** Retoma da fase que falhou, sem repetir o que já concluiu. */
  async retomar(): Promise<void> {
    if (this.operacaoEmCurso) return;
    const processoId = this.store.processoSeletivoId();
    if (processoId === null || !this.podeRetomar()) return;

    // A resposta de uma retomada iniciada aqui só escreve enquanto o editor tratar deste processo.
    this.geracaoDoAnexo = this.store.geracao();
    this.uploadError.set(null);
    await this.comOperacaoEmCurso(() => this.executarUpload(processoId, this.arquivoSelecionado()));
  }

  /** Só antes da confirmação: o documento confirmado é imutável no backend. */
  remover(): void {
    if (this.anexoBloqueado()) return;
    this.uploadError.set(null);
    this.arquivoEmMemoria.set(null);
    this.store.patchObjectSection('identificacao', { uploads: [] });
  }

  /** A recusa de anexar sobre um anexo que já existe: cada confirmado vira um documento imutável a mais. */
  private recusaPorAnexoExistente(): string | null {
    if (this.anexoConfirmado()) return EDITAL_JA_ANEXADO;
    if (this.anexo()?.confirmacaoIndefinida === true) return CONFIRMACAO_SEM_RESPOSTA;
    return null;
  }

  private async comOperacaoEmCurso(corpo: () => Promise<void>): Promise<void> {
    this.operacaoEmCurso = true;
    try {
      await corpo();
    } finally {
      this.operacaoEmCurso = false;
    }
  }

  private registrarAnexo(arquivo: File): void {
    const item: UploadItem = {
      id: crypto.randomUUID(),
      name: arquivo.name,
      extension: 'pdf',
      progress: 0,
      fase: 'iniciando',
    };
    this.store.patchObjectSection('identificacao', { uploads: [item] });
  }

  private async executarUpload(processoId: string, arquivo: File | null): Promise<void> {
    const atual = this.anexo();
    if (atual === undefined) return;

    // Só a confirmação falta, e repeti-la com a mesma chave recupera o replay.
    if (soFaltaConfirmar(atual) && atual.documentoAPublicarId !== undefined) {
      await this.confirmar(processoId, atual.documentoAPublicarId);
      return;
    }
    if (arquivo === null) return;

    const iniciacao = await this.iniciar(processoId, arquivo);
    if (iniciacao === null) return;

    if (!(await this.enviar(iniciacao, arquivo))) return;
    await this.confirmar(processoId, iniciacao.documentoAPublicarId);
  }

  /** A iniciação em curso, ou uma nova quando não há ou a anterior expirou; `null` se ela falhou. */
  private async iniciar(
    processoId: string,
    arquivo: File,
  ): Promise<IniciarEnvioDoDocumentoAPublicarDto | null> {
    if (this.iniciacaoAtual !== null && !destinoExpirado(this.iniciacaoAtual)) {
      return this.iniciacaoAtual;
    }

    this.atualizarAnexo({ fase: 'iniciando', progress: 0, mensagemErro: undefined });
    const inicio = await this.envioDoEdital.iniciarUpload(processoId, arquivo.name);
    if (!inicio.ok) {
      this.falharAnexo(this.problemI18n.resolve(inicio.problem).title);
      return null;
    }

    this.iniciacaoAtual = inicio.iniciacao;
    this.atualizarAnexo({
      documentoAPublicarId: inicio.iniciacao.documentoAPublicarId,
      expiraEm: inicio.iniciacao.expiraEm,
    });
    return inicio.iniciacao;
  }

  private async enviar(
    iniciacao: IniciarEnvioDoDocumentoAPublicarDto,
    arquivo: File,
  ): Promise<boolean> {
    this.atualizarAnexo({ fase: 'enviando' });
    const envio = await this.envioDoEdital.enviarArquivo(iniciacao, arquivo, (pct) =>
      this.atualizarAnexo({ progress: pct }),
    );
    if (!envio.ok) {
      this.falharNoEnvio(envio.expirada);
      return false;
    }

    this.atualizarAnexo({ enviado: true, progress: 100 });
    // A URL cumpriu o papel; some da memória para não ficar credencial viva à toa.
    this.iniciacaoAtual = null;
    return true;
  }

  /** A assinatura recusada não volta a valer, então o caminho é pedir outra URL. */
  private falharNoEnvio(expirada: boolean): void {
    if (!expirada) {
      this.falharAnexo(FALHA_NO_ENVIO);
      return;
    }
    this.iniciacaoAtual = null;
    this.atualizarAnexo({ documentoAPublicarId: undefined, expiraEm: undefined });
    this.falharAnexo(URL_DE_ENVIO_EXPIRADA);
  }

  private async confirmar(processoId: string, documentoAPublicarId: string): Promise<void> {
    this.atualizarAnexo({ fase: 'confirmando', progress: 100 });
    const confirmacao = await this.envioDoEdital.confirmarUpload(processoId, documentoAPublicarId);
    if (!confirmacao.ok) {
      const indefinida = this.envioDoEdital.temConfirmacaoPendente();
      const titulo = this.problemI18n.resolve(confirmacao.problem).title;
      this.atualizarAnexo({ confirmacaoIndefinida: indefinida });
      this.falharAnexo(
        indefinida
          ? `${titulo} Não é possível saber se o edital foi registrado; use "Tentar novamente" para repetir a mesma confirmação.`
          : titulo,
      );
      return;
    }

    this.atualizarAnexo({
      fase: 'confirmado',
      progress: 100,
      mensagemErro: undefined,
      confirmacaoIndefinida: false,
    });
  }

  /**
   * O funil de toda escrita do anexo, e por isso o lugar da guarda: a página do editor sobrevive à
   * troca de endereço, e um envio disparado para o processo anterior escreveria o edital dele no
   * processo atual.
   */
  private atualizarAnexo(patch: Partial<UploadItem>): void {
    if (this.geracaoDoAnexo !== null && this.geracaoDoAnexo !== this.store.geracao()) return;

    const atual = this.anexo();
    if (atual === undefined) return;
    this.store.patchObjectSection('identificacao', { uploads: [{ ...atual, ...patch }] });
  }

  private falharAnexo(mensagem: string): void {
    this.atualizarAnexo({ fase: 'erro', mensagemErro: mensagem });
  }
}
