import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ProblemI18nService, isApiOk } from '@uniplus/shared-core/http';
import { DocumentoEditalDto, IniciarUploadDocumentoEditalDto } from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { UploadItem } from '../../processo-seletivo.models';
import { CadastroInicialService } from '../cadastro-inicial.service';
import { classificarDocumentos, descreverDocumento, uploadItemDe } from '../hidratacao';

/** Limite do documento do edital no domínio: 20 MB. */
const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;
const CONTENT_TYPE_PDF = 'application/pdf';

/**
 * Anexo do documento oficial do edital.
 *
 * Vive junto da publicação, não da identificação: o edital é o ato normativo
 * que publica o certame, e exigi-lo antes de haver configuração publicável
 * invertia a ordem — a ponto de o anexo ter virado o gesto que criava o
 * rascunho, porque a rota do documento pede um processo já existente.
 *
 * O envio tem três fases e cada falha registra a sua, para a retentativa
 * recomeçar do ponto certo: repetir a confirmação de um objeto que nunca
 * chegou ao storage, ou repetir um PUT cuja URL expirou, não funciona.
 */
@Component({
  selector: 'sel-anexo-edital',
  standalone: true,
  templateUrl: './anexo-edital.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnexoEditalComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);

  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;

  readonly dragging = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly reverificando = signal(false);

  /** Documento cujo acesso está sendo pedido, para o botão anunciar a espera. */
  readonly abrindoDocumento = signal<string | null>(null);

  /** Recusa da abertura, exibida junto do documento que falhou. */
  readonly erroDeAbertura = signal<string | null>(null);

  /** Impede que uma segunda escolha atropele o envio em andamento. */
  private operacaoEmCurso = false;
  private arquivoSelecionado: File | null = null;
  private iniciacaoAtual: IniciarUploadDocumentoEditalDto | null = null;

  /** Geração do editor quando o anexo em curso começou. */
  private geracaoDoAnexo: number | null = null;

  readonly anexo = computed<UploadItem | undefined>(
    () => this.store.draft().identificacao.uploads[0],
  );
  readonly anexoConfirmado = computed(() => this.anexo()?.fase === 'confirmado');
  readonly anexoEmCurso = computed(() => {
    const fase = this.anexo()?.fase;
    return fase === 'iniciando' || fase === 'enviando' || fase === 'confirmando';
  });

  /**
   * O anexo fica indisponível enquanto qualquer gravação está em curso, depois
   * de confirmado, e também quando a confirmação ficou sem resposta: nesse
   * último caso o documento pode já estar selado no servidor, e substituí-lo
   * criaria um segundo edital imutável.
   */
  readonly anexoBloqueado = computed(
    () =>
      this.anexoEmCurso() ||
      this.anexoConfirmado() ||
      this.store.salvando() ||
      this.anexo()?.confirmacaoIndefinida === true ||
      // Escolha entre documentos confirmados pendente: enviar outro criaria um
      // terceiro documento imutável e agravaria a ambiguidade que a escolha
      // existe para resolver.
      this.store.documentosParaEscolha().length > 0 ||
      // Leitura dos documentos falhou: não dá para saber se já há edital
      // confirmado, e a API aceita um segundo sem recusar. Enquanto a
      // verificação não passar, anexar é apostar — daí o botão de reverificar.
      this.store.avisoDocumentos() !== null,
  );

  /** O anexo exige o processo já criado: a rota é `/{id}/documentos-edital`. */
  private readonly semProcesso = computed(() => this.store.processoSeletivoId() === null);

  chooseFiles(): void {
    if (this.anexoBloqueado()) return;
    this.fileInput?.nativeElement.click();
  }

  /**
   * O `<input type="file">` é visualmente oculto mas continua focável — quem
   * navega por teclado chega nele sem passar pela zona de upload. O `disabled`
   * no template é o que de fato impede a escolha; esta guarda existe para o
   * caminho não depender só da marcação.
   */
  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = '';
    if (this.anexoBloqueado()) return;
    if (arquivo) void this.anexar(arquivo);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.anexoBloqueado()) return;
    const arquivo = event.dataTransfer?.files?.[0];
    if (arquivo) void this.anexar(arquivo);
  }

  private async anexar(arquivo: File): Promise<void> {
    // Sem esta guarda, uma segunda escolha durante o envio trocaria o arquivo
    // sob os pés do fluxo em andamento: o anexo exibiria o nome do primeiro e o
    // storage receberia os bytes do segundo — que o backend selaria como
    // documento imutável.
    //
    // A recusa vem antes de a geração ser recarimbada: fazê-lo antes desarmaria
    // a guarda do envio que ainda está correndo, e as respostas dele passariam
    // a escrever como se fossem do processo atual.
    if (this.operacaoEmCurso) {
      this.uploadError.set(
        'Há um envio de edital em andamento. Aguarde a conclusão antes de escolher outro arquivo.',
      );
      return;
    }

    this.geracaoDoAnexo = this.store.geracao();

    // O campo de arquivo é alcançável pelo teclado mesmo com a zona de upload
    // marcada como indisponível, então a recusa precisa estar aqui também:
    // cada anexo confirmado vira um documento imutável a mais no processo.
    if (this.anexoConfirmado()) {
      this.uploadError.set(
        'O edital já foi anexado e não pode ser substituído. Para trocar o arquivo, cadastre um novo processo seletivo.',
      );
      return;
    }
    if (this.anexo()?.confirmacaoIndefinida === true) {
      this.uploadError.set(
        'A confirmação do edital anterior ficou sem resposta e pode ter sido registrada. Use "Tentar novamente" antes de escolher outro arquivo.',
      );
      return;
    }

    const recusa = recusarArquivo(arquivo);
    if (recusa !== null) {
      this.uploadError.set(recusa);
      return;
    }

    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      this.uploadError.set(
        'O cadastro do processo precisa estar concluído antes de anexar o edital. Volte à identificação e avance.',
      );
      return;
    }

    this.uploadError.set(null);
    this.operacaoEmCurso = true;
    try {
      this.arquivoSelecionado = arquivo;
      this.iniciacaoAtual = null;
      this.registrarAnexo(arquivo);
      await this.executarUpload(processoId, arquivo);
    } finally {
      this.operacaoEmCurso = false;
    }
  }

  /** Retoma da fase que falhou, sem repetir o que já concluiu. */
  async retomarUpload(): Promise<void> {
    if (this.operacaoEmCurso) return;
    const arquivo = this.arquivoSelecionado;
    const processoId = this.store.processoSeletivoId();
    if (arquivo === null || processoId === null) return;

    this.operacaoEmCurso = true;
    try {
      await this.executarUpload(processoId, arquivo);
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

  private async executarUpload(processoId: string, arquivo: File): Promise<void> {
    const atual = this.anexo();
    if (atual === undefined) return;

    // O arquivo já chegou ao storage numa tentativa anterior: repetir o PUT
    // seria desperdício e esbarraria numa URL possivelmente expirada. Só a
    // confirmação falta, e repeti-la com a mesma chave recupera o replay.
    if (atual.enviado === true && atual.documentoEditalId !== undefined) {
      await this.confirmar(processoId, atual.documentoEditalId);
      return;
    }

    let iniciacao = this.iniciacaoAtual;
    if (iniciacao === null || iniciacaoExpirada(iniciacao)) {
      this.atualizarAnexo({ fase: 'iniciando', progress: 0, mensagemErro: undefined });
      const inicio = await this.cadastro.iniciarUpload(processoId);
      if (!inicio.ok) {
        this.falharAnexo(this.problemI18n.resolve(inicio.problem).title);
        return;
      }
      iniciacao = inicio.iniciacao;
      this.iniciacaoAtual = iniciacao;
      this.atualizarAnexo({
        documentoEditalId: iniciacao.documentoEditalId,
        expiraEm: iniciacao.expiraEm,
      });
    }

    this.atualizarAnexo({ fase: 'enviando' });
    const envio = await this.cadastro.enviarArquivo(iniciacao, arquivo, (pct) =>
      this.atualizarAnexo({ progress: pct }),
    );
    if (!envio.ok) {
      // A assinatura não volta a valer — nem por expiração, nem por divergência
      // de content type ou política do bucket. Em todos esses casos o caminho é
      // pedir outra URL, então a iniciação é descartada.
      if (envio.expirada) {
        this.iniciacaoAtual = null;
        this.atualizarAnexo({ documentoEditalId: undefined, expiraEm: undefined });
        this.falharAnexo(
          'O endereço de envio não é mais válido. Tente novamente para obter um novo.',
        );
        return;
      }
      this.falharAnexo('Falha ao enviar o arquivo. Verifique a conexão e tente novamente.');
      return;
    }

    this.atualizarAnexo({ enviado: true, progress: 100 });
    // A URL cumpriu o papel; some da memória para não ficar credencial viva à toa.
    this.iniciacaoAtual = null;
    await this.confirmar(processoId, iniciacao.documentoEditalId);
  }

  private async confirmar(processoId: string, documentoEditalId: string): Promise<void> {
    this.atualizarAnexo({ fase: 'confirmando', progress: 100 });
    const confirmacao = await this.cadastro.confirmarUpload(processoId, documentoEditalId);
    if (!confirmacao.ok) {
      const indefinida = this.cadastro.temConfirmacaoPendente();
      this.atualizarAnexo({ confirmacaoIndefinida: indefinida });
      this.falharAnexo(
        indefinida
          ? `${this.problemI18n.resolve(confirmacao.problem).title} Não é possível saber se o edital foi registrado; use "Tentar novamente" para repetir a mesma confirmação.`
          : this.problemI18n.resolve(confirmacao.problem).title,
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
   * Funil de toda escrita do fluxo de anexo — e, por isso, o lugar certo da
   * guarda: a página do editor sobrevive à troca de endereço, então um envio
   * disparado para o processo anterior continua respondendo depois que o
   * editor já trata de outro. Escrever ali vincularia o edital de um processo
   * ao outro.
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

  /** Só antes da confirmação: o documento confirmado é imutável no backend. */
  removeUpload(): void {
    if (this.anexoBloqueado()) return;
    this.arquivoSelecionado = null;
    this.store.patchObjectSection('identificacao', { uploads: [] });
  }

  /**
   * Trunca o nome do arquivo preservando a extensão no final.
   * Ex.: "edital_vestibular_2026_revisado_final_publicado.pdf" →
   *      "edital_vestibular_2026_revisado...publicado.pdf"
   */
  truncateFileName(name: string, maxLength = 36): string {
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex <= 1 || name.length <= maxLength) return name;
    const extension = name.slice(dotIndex);
    const base = name.slice(0, dotIndex);
    const available = maxLength - extension.length - 3;
    if (available < 1) return `...${extension}`;
    return `${base.slice(0, available)}...${extension}`;
  }

  /** Rótulo da fase, para o leitor de tela acompanhar o andamento. */
  descricaoFase(item: UploadItem): string {
    switch (item.fase) {
      case 'iniciando':
        return 'Preparando o envio';
      case 'enviando':
        return `Enviando: ${item.progress}%`;
      case 'confirmando':
        return 'Validando o arquivo';
      case 'confirmado':
        return 'Edital anexado';
      case 'erro':
        return item.mensagemErro ?? 'Falha no envio';
    }
  }

  /** Metadados que distinguem um confirmado do outro na escolha do oficial. */
  protected descrever(documento: DocumentoEditalDto): string {
    return descreverDocumento(documento);
  }

  /** Refaz a leitura que falhou, para o anexo deixar de ser uma aposta. */
  /**
   * Abre o PDF de um documento confirmado numa aba nova, pedindo o acesso à
   * API no clique.
   *
   * A URL assinada é credencial de acesso ao objeto: não vai para o store, não
   * é guardada em campo do componente e não vira `href` de link — o servidor a
   * emite por pedido justamente para que o prazo comece agora e para que ela
   * não sobreviva à ação. Sai daqui direto para `window.open` e nada mais a
   * retém.
   */
  async abrirDocumento(documentoEditalId: string): Promise<void> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null || this.abrindoDocumento() !== null) return;

    // A aba nasce aqui, ainda dentro do clique. Abri-la depois do `await`
    // custaria a ativação do usuário que o navegador exige, e o bloqueador de
    // pop-ups recusaria a abertura justamente no caminho feliz — sem erro de
    // API para explicar por que nada aconteceu.
    //
    // Sem `noopener` na chamada, e de propósito: com ele `window.open` devolve
    // `null` por especificação, e é justamente a referência que se precisa
    // para levar a aba ao endereço quando ele chegar. O desacoplamento vem
    // depois, zerando `opener` antes de navegar — mesmo efeito, na ordem que
    // este fluxo permite.
    const aba = window.open('', '_blank');
    if (aba === null) {
      // Recusa antes de pedir o acesso: a URL é emitida por requisição, com o
      // prazo correndo a partir dela, e pedir uma que não será usada é
      // exatamente o que o endpoint sob demanda existe para evitar. A URL
      // também não vira link na tela — deixaria de ser credencial de uso único
      // e passaria a viver no DOM.
      this.erroDeAbertura.set(
        'O navegador bloqueou a abertura do edital. Permita pop-ups para este endereço e tente de novo.',
      );
      return;
    }

    const geracao = this.store.geracao();
    this.abrindoDocumento.set(documentoEditalId);
    this.erroDeAbertura.set(null);
    try {
      const resultado = await this.cadastro.obterAcessoAoDocumento(processoId, documentoEditalId);

      // O editor pode ter passado a outro processo enquanto o acesso era
      // pedido; abrir agora mostraria o edital de um processo que já saiu da
      // tela.
      if (geracao !== this.store.geracao()) {
        aba.close();
        return;
      }

      if (!isApiOk(resultado)) {
        aba.close();
        this.erroDeAbertura.set(this.problemI18n.resolve(resultado.problem).title);
        return;
      }

      // Zerado antes de navegar: a aba passa a carregar um endereço assinado do
      // storage, fora do controle da aplicação, e não deve alcançar esta
      // janela pelo `window.opener`.
      aba.opener = null;
      aba.location.href = resultado.data.url;
    } catch (erro) {
      aba.close();
      throw erro;
    } finally {
      this.abrindoDocumento.set(null);
    }
  }

  async reverificarDocumentos(): Promise<void> {
    const id = this.store.processoSeletivoId();
    if (id === null || this.reverificando()) return;

    const geracao = this.store.geracao();
    this.reverificando.set(true);
    try {
      const resultado = await this.cadastro.listarDocumentos(id);
      // O editor pode ter passado a outro processo enquanto a leitura corria.
      if (geracao !== this.store.geracao() || !isApiOk(resultado)) return;

      const { vinculo, escolha } = classificarDocumentos(resultado.data);
      if (vinculo !== null) {
        this.store.patchObjectSection('identificacao', { uploads: [vinculo] });
      }
      this.store.documentosParaEscolha.set(escolha);
      this.store.avisoDocumentos.set(null);
    } finally {
      this.reverificando.set(false);
    }
  }

  /**
   * Decisão explícita entre documentos confirmados. O wizard nunca elege
   * sozinho: adotar o mais recente trocaria o edital do certame sem o operador
   * perceber.
   */
  escolherDocumentoConfirmado(documento: DocumentoEditalDto): void {
    this.store.patchObjectSection('identificacao', { uploads: [uploadItemDe(documento)] });
    this.store.documentosParaEscolha.set([]);
  }

  protected readonly aguardandoCadastro = this.semProcesso;
}

/** Recusa client-side do que o backend recusaria de todo modo. */
function recusarArquivo(arquivo: File): string | null {
  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? '';
  if (extensao !== 'pdf' || (arquivo.type !== '' && arquivo.type !== CONTENT_TYPE_PDF)) {
    return `Formato não permitido: "${arquivo.name}". O edital deve ser um arquivo PDF.`;
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return 'O edital excede o tamanho máximo permitido de 20 MB.';
  }
  if (arquivo.size === 0) {
    return 'O arquivo está vazio.';
  }
  return null;
}

/** A URL pré-assinada tem TTL curto; passado o prazo, só uma nova iniciação serve. */
function iniciacaoExpirada(iniciacao: IniciarUploadDocumentoEditalDto): boolean {
  const expiraEm = Date.parse(iniciacao.expiraEm);
  return Number.isNaN(expiraEm) || expiraEm <= Date.now();
}
