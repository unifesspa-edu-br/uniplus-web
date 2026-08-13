import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProblemI18nService, extractNextCursor, isApiOk } from '@uniplus/shared-core/http';
import { UnidadeDto, UnidadesApi } from '@uniplus/shared-data/organizacao';
import { IniciarUploadDocumentoEditalDto, OrigemCandidatos } from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  OrigemCandidatosSelecionada,
  StepValidation,
  UploadItem,
} from '../../processo-seletivo.models';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';

/** Limite do documento do edital no domínio: 20 MB. */
const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;
const CONTENT_TYPE_PDF = 'application/pdf';

interface UnidadeOption {
  readonly id: string;
  readonly rotulo: string;
}

/**
 * Rótulos curtos de propósito: em 320 px, a largura intrínseca da opção mais
 * longa é o que decide o piso do campo. O sentido completo fica no texto de
 * apoio do campo, que quebra em várias linhas sem esticar nada.
 */
export const ORIGENS_CANDIDATOS: readonly {
  readonly value: OrigemCandidatosSelecionada;
  readonly label: string;
}[] = [
  { value: OrigemCandidatos.inscricaoPropria, label: 'Inscrição neste sistema' },
  { value: OrigemCandidatos.importacaoExterna, label: 'Importação externa' },
];

@Component({
  selector: 'sel-step-02-identificacao',
  standalone: true,
  templateUrl: './step-02-identificacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step02IdentificacaoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly unidadesApi = inject(UnidadesApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly dragging = signal(false);
  /** Campos inválidos detectados na última validação (chave → `.is-invalid`). */
  readonly invalidFields = signal<ReadonlySet<string>>(new Set());
  /** Mensagem de recusa do anexo, antes de qualquer requisição. `null` = sem erro. */
  readonly uploadError = signal<string | null>(null);
  readonly origens = ORIGENS_CANDIDATOS;

  readonly unidades = signal<readonly UnidadeOption[]>([]);
  readonly unidadesCarregando = signal(true);
  readonly unidadesErro = signal<string | null>(null);

  /**
   * Enquanto o cadastro inicial não existe, o operador pode corrigir tudo;
   * depois de criado, o contrato não expõe atualização de identificação, então
   * os campos que compuseram o comando ficam somente-leitura.
   */
  readonly camposDoComandoBloqueados = computed(() => this.store.cadastroInicialCongelado());
  /**
   * Uma criação sem resposta definitiva precisa ser repetida com o mesmo corpo,
   * senão a mesma chave devolve `body_mismatch` e a correção seguinte cria um
   * segundo processo. Editar não adiantaria — daí manter os campos travados,
   * aqui e no passo 1.
   */
  readonly criacaoIndefinida = this.store.criacaoIndefinida;
  readonly anexo = computed<UploadItem | undefined>(
    () => this.store.draft().identificacao.uploads[0],
  );
  readonly anexoConfirmado = computed(() => this.anexo()?.fase === 'confirmado');
  readonly anexoEmCurso = computed(() => {
    const fase = this.anexo()?.fase;
    return fase === 'iniciando' || fase === 'enviando' || fase === 'confirmando';
  });

  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;
  /** Arquivo escolhido, preservado em memória para permitir repetir o envio. */
  private arquivoSelecionado: File | null = null;
  /**
   * URL pré-assinada da iniciação corrente. Fica só em memória, nunca no
   * rascunho: é credencial de escrita no storage, com validade curta.
   */
  private iniciacaoAtual: IniciarUploadDocumentoEditalDto | null = null;
  /** Impede que uma segunda escolha de arquivo se atravesse na operação em curso. */
  private operacaoEmCurso = false;

  constructor() {
    this.carregarUnidades();
  }

  patch(
    field:
      | 'numero'
      | 'ano'
      | 'data'
      | 'orgao'
      | 'periodo'
      | 'nome'
      | 'unidadeAdministradoraId'
      | 'origemCandidatos',
    value: string | number | null,
  ): void {
    if (field === 'ano' && typeof value === 'number' && !Number.isFinite(value)) {
      value = null; // input numérico vazio
    }
    this.store.patchObjectSection('identificacao', { [field]: value });
  }

  carregarUnidades(): void {
    this.unidadesCarregando.set(true);
    this.unidadesErro.set(null);
    this.carregarPaginaDeUnidades();
  }

  private carregarPaginaDeUnidades(
    cursor?: string,
    acumuladas: readonly UnidadeOption[] = [],
  ): void {
    const consulta =
      cursor === undefined
        ? this.unidadesApi.listar()
        : this.unidadesApi.listar({ cursor, direction: 'next' });

    consulta.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        if (!isApiOk(result)) {
          this.exibirErroDeUnidades();
          return;
        }

        const unidades = [...acumuladas, ...result.data.map((item) => toOption(item))];
        const proximoCursor = extractNextCursor(result.headers.get('Link'));
        if (proximoCursor !== null) {
          this.carregarPaginaDeUnidades(proximoCursor, unidades);
          return;
        }

        this.unidades.set(unidades);
        this.unidadesCarregando.set(false);
      },
      error: () => this.exibirErroDeUnidades(),
    });
  }

  private exibirErroDeUnidades(): void {
    this.unidadesCarregando.set(false);
    this.unidadesErro.set(
      'Não foi possível carregar as unidades administradoras. Tente novamente.',
    );
  }

  openDatePicker(input: HTMLInputElement): void {
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

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
      this.anexo()?.confirmacaoIndefinida === true,
  );

  chooseFiles(): void {
    if (this.anexoBloqueado()) return;
    this.fileInput?.nativeElement.click();
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = '';
    if (arquivo) void this.anexar(arquivo);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.anexoBloqueado()) return;
    const arquivo = event.dataTransfer?.files?.[0];
    if (arquivo) void this.anexar(arquivo);
  }

  /**
   * Anexar o edital exige o processo já criado — a rota do documento é
   * `/{processoSeletivoId}/documentos-edital`. Por isso o anexo é o gatilho da
   * criação: sem isso, "Próximo" nunca criaria o processo (a validação barra
   * antes, exigindo o edital) e o operador ficaria preso.
   */
  private async anexar(arquivo: File): Promise<void> {
    // Sem esta guarda, uma segunda escolha durante a criação trocaria o arquivo
    // sob os pés do fluxo em andamento: o anexo exibiria o nome do primeiro e o
    // storage receberia os bytes do segundo — que o backend selaria como
    // documento imutável.
    if (this.operacaoEmCurso) return;

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

    // Campos do comando conferidos antes de registrar o anexo: faltando algum,
    // não há operação a retomar e a mensagem tem de apontar o que preencher.
    const faltando = this.camposFaltantesDoComando();
    if (faltando.length > 0) {
      this.uploadError.set(
        `Antes de anexar o edital, preencha: ${faltando.join(', ')}. O cadastro é criado no sistema neste momento.`,
      );
      return;
    }

    this.uploadError.set(null);
    this.operacaoEmCurso = true;
    try {
      this.arquivoSelecionado = arquivo;
      this.iniciacaoAtual = null;

      // O anexo é registrado antes da criação para que qualquer falha do fluxo
      // — inclusive a da própria criação — apareça no mesmo lugar, com o botão
      // de retomar.
      this.registrarAnexo(arquivo);

      const processoId = await this.garantirProcessoCriado();
      if (processoId === null) {
        this.falharAnexo(this.uploadError() ?? 'Não foi possível criar o cadastro inicial.');
        return;
      }

      await this.executarUpload(processoId, arquivo);
    } finally {
      this.operacaoEmCurso = false;
    }
  }

  /** Retoma da fase que falhou, sem repetir o que já concluiu. */
  async retomarUpload(): Promise<void> {
    if (this.operacaoEmCurso) return;
    const arquivo = this.arquivoSelecionado;
    if (arquivo === null) return;

    this.operacaoEmCurso = true;
    try {
      const processoId = this.store.processoSeletivoId() ?? (await this.garantirProcessoCriado());
      if (processoId === null) return;
      await this.executarUpload(processoId, arquivo);
    } finally {
      this.operacaoEmCurso = false;
    }
  }

  /**
   * Cria o processo se ainda não existe, a partir de um instantâneo do rascunho
   * — os campos ficam bloqueados durante a requisição, para que a resposta
   * nunca descreva um estado diferente do enviado.
   */
  private async garantirProcessoCriado(): Promise<string | null> {
    const existente = this.store.processoSeletivoId();
    if (existente !== null) return existente;
    if (this.store.salvando()) return null;

    const identificacao = this.store.draft().identificacao;
    const tipoProcessoOrigemId = this.store.draft().tipoProcesso.selected;
    const faltando = this.camposFaltantesDoComando();
    if (faltando.length > 0) {
      this.uploadError.set(
        `Antes de anexar o edital, preencha: ${faltando.join(', ')}. O cadastro é criado no sistema neste momento.`,
      );
      return null;
    }

    this.store.salvando.set(true);
    try {
      const resultado = await this.cadastro.criar({
        nome: identificacao.nome.trim(),
        tipoProcessoOrigemId,
        origemCandidatos: identificacao.origemCandidatos as OrigemCandidatos,
        unidadeAdministradoraOrigemId: identificacao.unidadeAdministradoraId,
      });

      if (!resultado.ok) {
        this.store.criacaoIndefinida.set(this.cadastro.temCriacaoPendente());
        this.uploadError.set(
          this.criacaoIndefinida()
            ? `${this.problemI18n.resolve(resultado.problem).title} Não é possível saber se o cadastro chegou a ser criado; use "Tentar novamente" para repetir o mesmo envio.`
            : this.problemI18n.resolve(resultado.problem).title,
        );
        return null;
      }

      this.store.criacaoIndefinida.set(false);
      this.store.processoSeletivoId.set(resultado.processoSeletivoId);
      return resultado.processoSeletivoId;
    } finally {
      this.store.salvando.set(false);
    }
  }

  /** Campos que compõem o comando de criação e ainda estão vazios. */
  private camposFaltantesDoComando(): string[] {
    const identificacao = this.store.draft().identificacao;
    const faltando: string[] = [];
    if (!this.store.draft().tipoProcesso.selected) faltando.push('tipo do processo (passo 1)');
    if (!identificacao.nome.trim()) faltando.push('nome do processo seletivo');
    if (!identificacao.unidadeAdministradoraId) faltando.push('unidade administradora');
    if (!identificacao.origemCandidatos) faltando.push('origem dos candidatos');
    return faltando;
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

  /**
   * Percorre as três fases do anexo. Cada falha registra a fase, para que o
   * retry recomece do ponto certo: repetir a confirmação de um objeto que nunca
   * chegou ao storage, ou repetir um PUT cuja URL expirou, nunca funciona.
   */
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

  private atualizarAnexo(patch: Partial<UploadItem>): void {
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
    const extension = name.slice(dotIndex); // ".pdf"
    const base = name.slice(0, dotIndex);
    const available = maxLength - extension.length - 3; // reserva espaço para "..."
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

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const id = this.store.draft().identificacao;
    const messages: string[] = [];
    const invalid = new Set<string>();

    if (!id.numero.trim()) {
      messages.push('Informe o número do edital.');
      invalid.add('numero');
    }
    if (!id.ano || id.ano < 2000) {
      messages.push('Informe o ano do edital.');
      invalid.add('ano');
    }
    if (!id.data) {
      messages.push('Informe a data do processo.');
      invalid.add('data');
    }
    if (!id.orgao.trim()) {
      messages.push('Informe a sigla do órgão expedidor.');
      invalid.add('orgao');
    }
    if (!id.periodo.trim()) {
      messages.push('Informe o período de ingresso.');
      invalid.add('periodo');
    }
    if (!id.nome.trim()) {
      messages.push('Informe o nome do processo seletivo.');
      invalid.add('nome');
    }
    if (!id.unidadeAdministradoraId) {
      messages.push('Selecione a unidade administradora.');
      invalid.add('unidadeAdministradoraId');
    }
    if (!id.origemCandidatos) {
      messages.push('Informe a origem dos candidatos.');
      invalid.add('origemCandidatos');
    }
    const anexo = id.uploads[0];
    if (anexo === undefined) {
      messages.push('Anexe o edital em PDF (obrigatório para auditoria).');
      invalid.add('uploads');
    } else if (anexo.fase !== 'confirmado') {
      messages.push('Aguarde a conclusão do envio do edital.');
      invalid.add('uploads');
    }

    this.invalidFields.set(invalid);
    return messages.length ? { valid: false, messages } : { valid: true };
  }

  /**
   * Commit assíncrono do passo: garante que o cadastro inicial exista antes de
   * avançar. Em uso normal o processo já foi criado no anexo; isto cobre o caso
   * de a criação ter falhado e o operador reagir pelo rodapé.
   */
  async persistir(): Promise<StepValidation> {
    if (this.store.processoSeletivoId() !== null) return { valid: true };

    const processoId = await this.garantirProcessoCriado();
    if (processoId === null) {
      return {
        valid: false,
        messages: [
          this.uploadError() ?? 'Não foi possível criar o cadastro inicial. Tente novamente.',
        ],
      };
    }
    return { valid: true };
  }
}

function toOption(unidade: UnidadeDto): UnidadeOption {
  return { id: unidade.id, rotulo: `${unidade.sigla} — ${unidade.nome}` };
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
