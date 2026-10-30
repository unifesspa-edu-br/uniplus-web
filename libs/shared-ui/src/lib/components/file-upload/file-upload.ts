import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { formatarTamanhoDeArquivo } from '@uniplus/shared-utils';

type ValidationResult = { ok: true } | { ok: false; reason: string };

/** Onde o envio de um arquivo está: o componente só exibe, quem envia informa. */
export type FaseDoArquivo =
  | 'iniciando'
  | 'enviando'
  | 'confirmando'
  | 'verificando'
  | 'confirmado'
  | 'erro';

/** Um arquivo da lista, como o consumidor o reporta. */
export interface ArquivoEmEnvio {
  readonly id: string;
  readonly nome: string;
  readonly tamanhoBytes?: number;
  readonly fase: FaseDoArquivo;
  /** Percentual de 0 a 100. */
  readonly progresso: number;
  /** Texto da falha, exibido quando a fase é `erro`, ou o que se espera, quando é `verificando`. */
  readonly mensagem?: string | null;
  /** `false` quando repetir não adianta; o padrão é oferecer a nova tentativa. */
  readonly podeTentarDeNovo?: boolean;
  /** `false` quando o arquivo não pode mais sair da lista; o padrão é permitir. */
  readonly podeRetirar?: boolean;
  /** Descreve o arquivo no lugar do tamanho, quando quem envia sabe mais do que ele (formato, data do envio). */
  readonly detalhe?: string;
}

const BYTES_POR_MB = 1024 * 1024;
const PASSO_ANUNCIADO = 25;

/**
 * Zona de soltar arquivos com validação de tipo e tamanho no cliente.
 *
 * Tem dois jeitos de uso. No modo simples (sem `itens`) guarda um único arquivo em
 * `selectedFile`. No modo controlado (`itens` informado) o consumidor é dono do envio: o
 * componente valida o que foi escolhido, emite `arquivosEscolhidos` e exibe a lista com fase e
 * progresso de cada arquivo, reportados por quem envia. Não conhece API nem storage.
 */
@Component({
  selector: 'ui-file-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- O contêiner trata o drop que a zona não recebeu (lista, mensagens, ou a zona desabilitada,
         que não recebe eventos): sem isso o navegador abriria o arquivo solto. -->
    <div class="uni-uploader" [class.uni-uploader--compacto]="compacto()" (dragover)="aoArrastarSobre($event)" (drop)="aoSoltarForaDaZona($event)">
      @if (fieldLabel()) {
        <label [id]="labelId" [attr.for]="inputId" class="field__label" [class.is-required]="isRequired()">{{ fieldLabel() }}</label>
      }
      @if (!zonaOculta()) {
      <button
        #dropZone
        type="button"
        class="uni-uploader__drop"
        [class.is-dragging]="isDragging()"
        [disabled]="disabled()"
        [attr.aria-disabled]="disabled() ? 'true' : null"
        [attr.aria-labelledby]="fieldLabel() ? labelId + ' ' + dropTextId : null"
        [attr.aria-describedby]="describedBy()"
        (click)="openFilePicker()"
        (dragover)="$event.preventDefault(); onDragOver()"
        (dragleave)="onDragLeave()"
        (drop)="$event.preventDefault(); onDrop($event.dataTransfer?.files)"
      >
        <span class="uni-uploader__icon" aria-hidden="true">↑</span>
        <span [id]="dropTextId" class="uni-uploader__text">
          <span class="uni-uploader__title">{{ dropTitle() }}</span>
          <span class="uni-uploader__hint">{{ dropHint() }}</span>
        </span>
      </button>
      }
      <input
        #fileInput
        [id]="inputId"
        type="file"
        class="hidden"
        [accept]="acceptedFileTypes()"
        [multiple]="modoMultiplo()"
        [disabled]="disabled()"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-invalid]="comErro() ? 'true' : null"
        [attr.aria-required]="isRequired() ? 'true' : null"
        (change)="onFilesPicked(fileInput)"
      />
      @let lista = itens();
      @if (lista === null) {
        @let file = selectedFile();
        @if (file) {
          <div class="uni-uploader__item">
            <span class="uni-uploader__item-icon" aria-hidden="true">□</span>
            <span class="uni-uploader__item-body">
              <span class="uni-uploader__item-name">{{ file.name }}</span>
            </span>
            <button
              #removerArquivo
              type="button"
              class="btn btn--tertiary btn--sm"
              [disabled]="disabled()"
              (click)="removeFile()"
              aria-label="Remover arquivo"
            >
              Remover
            </button>
          </div>
        }
      } @else if (lista.length > 0) {
        <ul #listaDeArquivos tabindex="-1" class="uni-uploader__list" [attr.aria-label]="listaAccessibleName()">
          @for (arquivo of lista; track arquivo.id) {
            <li
              class="uni-uploader__item"
              [class.is-error]="arquivo.fase === 'erro'"
              [class.is-success]="arquivo.fase === 'confirmado'"
            >
              <div class="uni-uploader__item-body">
                <div class="uni-uploader__item-name" [title]="arquivo.nome">{{ arquivo.nome }}</div>
                @if (arquivo.detalhe ?? tamanhoDe(arquivo); as detalhe) {
                  <div class="uni-uploader__item-meta">{{ detalhe }}</div>
                }
                <div
                  class="uni-uploader__progress"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-label]="'Progresso do envio de ' + arquivo.nome"
                  [attr.aria-valuenow]="arquivo.progresso"
                  [attr.aria-valuetext]="textoDaFase(arquivo)"
                >
                  <div [style.width.%]="arquivo.progresso"></div>
                </div>
                <div class="uni-uploader__item-meta" aria-hidden="true">{{ textoDaFase(arquivo) }}</div>
                @if (arquivo.fase === 'erro') {
                  <small class="field__error" role="alert"
                    ><span class="sr-only">{{ arquivo.nome }}: </span
                    >{{ arquivo.mensagem || 'O envio não foi concluído.' }}</small
                  >
                } @else {
                  <div class="sr-only" role="status" aria-live="polite">{{ anuncioDaFase(arquivo) }}</div>
                }
              </div>
              <div class="uni-uploader__item-actions">
                @if (arquivo.fase === 'erro' && arquivo.podeTentarDeNovo !== false) {
                  <button
                    type="button"
                    class="btn btn--tertiary btn--sm"
                    [attr.aria-label]="'Tentar enviar novamente ' + arquivo.nome + sufixoDoContexto()"
                    (click)="repetir(arquivo.id)"
                  >
                    Tentar novamente
                  </button>
                }
                @if (permitirBaixar() && arquivo.fase === 'confirmado') {
                  <button
                    type="button"
                    class="btn btn--tertiary btn--sm"
                    [attr.aria-label]="'Baixar ' + arquivo.nome + sufixoDoContextoParaBaixar()"
                    (click)="baixar(arquivo.id)"
                  >
                    Baixar
                  </button>
                }
                @if (arquivo.podeRetirar !== false) {
                  <button
                    type="button"
                    class="btn btn--tertiary btn--sm"
                    [attr.aria-label]="'Remover ' + arquivo.nome + sufixoDoContexto()"
                    (click)="retirar(arquivo.id)"
                  >
                    Remover
                  </button>
                }
              </div>
            </li>
          }
        </ul>
      }
      @for (message of messages(); track $index) {
        <small
          [id]="idDaMensagem($index)"
          class="field__error"
          role="alert"
        >{{ message }}</small>
      }
    </div>
  `,
})
export class FileUploadComponent {
  // Garante IDs únicos por instância para isolar `for`/`aria-describedby`
  // quando há múltiplos `<ui-file-upload>` na mesma página.
  private static instanceCount = 0;
  private readonly injector = inject(Injector);
  private readonly instanceId = `ui-file-upload-${++FileUploadComponent.instanceCount}`;

  /** Id do campo de arquivo; o consumidor pode fixá-lo quando algo externo o referencia. */
  readonly idDoCampo = input<string | null>(null);

  get inputId(): string {
    return this.idDoCampo() ?? `${this.instanceId}-input`;
  }
  readonly errorId = `${this.instanceId}-error`;
  protected readonly labelId = `${this.instanceId}-label`;
  protected readonly dropTextId = `${this.instanceId}-drop`;

  readonly fieldLabel = input<string>('');
  /**
   * Distingue esta lista das outras da tela no nome da lista e das ações de cada arquivo. Sem
   * valor, vale o `fieldLabel`.
   */
  readonly nomeDaLista = input<string | null>(null);
  readonly acceptedFileTypes = input<string>('.pdf,.jpg,.jpeg,.png');
  readonly allowedMimeTypes = input<readonly string[]>([
    'application/pdf',
    'image/jpg',
    'image/jpeg',
    'image/png',
  ]);
  readonly acceptLabel = input<string>('PDF, JPG ou PNG');
  readonly maxSizeMb = input<number>(10);

  /** Aceita vários arquivos por escolha. Só vale no modo controlado (`itens`). */
  readonly multiple = input(false);
  /**
   * Teto de arquivos na lista, contando os já presentes; sem valor, não há teto. A conta usa
   * `itens` no instante da escolha, então o consumidor deve acrescentar os arquivos escolhidos à
   * lista de forma síncrona, dentro do tratamento de `arquivosEscolhidos`.
   */
  readonly maxFiles = input<number | null>(null);
  /**
   * Sistemas diferentes informam tipos MIME diferentes para o mesmo DOCX ou ODT (vazio, `zip`,
   * `octet-stream`). Com isto a extensão decide e `allowedMimeTypes` não é consultado; o conteúdo
   * é conferido pelo servidor.
   */
  readonly validarSoPelaExtensao = input(false);
  /** A zona em uma linha (ícone, chamada e restrições), para o formulário sem altura de sobra. */
  readonly compacto = input(false);
  /** Com um arquivo escolhido (modo simples), a zona some e volta quando o arquivo é retirado. */
  readonly ocultarZonaComArquivo = input(false);
  readonly disabled = input(false);
  readonly isRequired = input(false);
  /** Ids de elementos que descrevem o campo, lidos junto do nome pelo leitor de tela. */
  readonly descritoPor = input<string | null>(null);
  /** Recusa que nasce no consumidor (por exemplo, uma regra do fluxo) e deve aparecer junto. */
  readonly mensagemExterna = input<string | null>(null);

  /** Oferece Baixar nos arquivos confirmados da lista; desligada, a lista não ganha a ação. */
  readonly permitirBaixar = input(false);

  /** Lista de arquivos reportada pelo consumidor; `null` mantém o modo simples. */
  readonly itens = input<readonly ArquivoEmEnvio[] | null>(null);

  /** Arquivos aprovados na validação, a enviar. */
  readonly arquivosEscolhidos = output<readonly File[]>();
  readonly itemRetirado = output<string>();
  readonly tentarDeNovo = output<string>();
  readonly itemBaixado = output<string>();

  readonly selectedFile = model<File | null>(null);
  readonly isDragging = signal(false);
  readonly errors = signal<readonly string[]>([]);
  readonly messages = computed(() => {
    const externa = this.mensagemExterna();
    return externa ? [...this.errors(), externa] : this.errors();
  });

  readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly dropZone = viewChild<ElementRef<HTMLButtonElement>>('dropZone');
  private readonly removerArquivo = viewChild<ElementRef<HTMLButtonElement>>('removerArquivo');
  protected readonly zonaOculta = computed(
    () => this.ocultarZonaComArquivo() && this.itens() === null && this.selectedFile() !== null,
  );
  private readonly lista = viewChild<ElementRef<HTMLElement>>('listaDeArquivos');
  protected readonly comErro = computed(
    () => this.messages().length > 0 || (this.itens() ?? []).some((a) => a.fase === 'erro'),
  );

  /** Vários arquivos só valem no modo controlado, em que o consumidor guarda a lista. */
  protected readonly modoMultiplo = computed(() => this.multiple() && this.itens() !== null);
  readonly dropTitle = computed(() =>
    this.modoMultiplo()
      ? 'Arraste arquivos aqui ou selecione do computador'
      : 'Arraste um arquivo aqui ou selecione do computador',
  );
  readonly dropHint = computed(() => {
    const limite = this.maxFiles();
    const quantidade = this.modoMultiplo() && limite !== null ? ` - até ${limite} arquivos` : '';
    return `${this.acceptLabel()} - tamanho máximo: ${this.maxSizeMb()}MB${quantidade}`;
  });
  private readonly contexto = computed(() => this.nomeDaLista() || this.fieldLabel() || null);
  protected readonly listaAccessibleName = computed(() => {
    const contexto = this.contexto();
    return contexto ? `Arquivos: ${contexto}` : 'Arquivos';
  });
  protected readonly sufixoDoContexto = computed(() => {
    const contexto = this.contexto();
    return contexto ? ` — ${contexto}` : '';
  });
  protected readonly sufixoDoContextoParaBaixar = computed(() => {
    const contexto = this.contexto();
    return contexto ? ` de ${contexto}` : '';
  });
  readonly describedBy = computed(() => {
    const ids = [
      this.descritoPor(),
      ...this.messages().map((_, indice) => this.idDaMensagem(indice)),
    ].filter((id): id is string => !!id);
    return ids.length > 0 ? ids.join(' ') : null;
  });

  private readonly maxBytes = computed(() => this.maxSizeMb() * BYTES_POR_MB);
  private readonly acceptedExtensions = computed(() =>
    this.acceptedFileTypes()
      .split(',')
      .map((extension) => extension.trim().toLowerCase())
      .filter((extension) => extension.length > 0),
  );
  private readonly normalizedMimeTypes = computed(() =>
    this.allowedMimeTypes().map((type) => type.toLowerCase()),
  );
  private readonly maxSizeError = computed(
    () => `Arquivo excede o tamanho máximo de ${this.maxSizeMb()}MB.`,
  );
  private readonly typeNotAllowedError = computed(
    () => `Tipo de arquivo não permitido. Envie arquivos nos formatos: ${this.acceptedFileTypes()}`,
  );

  onDragOver(): void {
    if (this.disabled()) return;
    this.isDragging.set(true);
  }

  onDragLeave(): void {
    this.isDragging.set(false);
  }

  onDrop(files: FileList | readonly File[] | null | undefined): void {
    this.isDragging.set(false);
    if (this.disabled()) return;
    this.handleFiles(Array.from(files ?? []));
  }

  protected aoArrastarSobre(evento: DragEvent): void {
    evento.preventDefault();
    // Com o envio indisponível o cursor não deve sugerir que soltar o arquivo vale.
    if (this.disabled() && evento.dataTransfer) evento.dataTransfer.dropEffect = 'none';
  }

  protected aoSoltarForaDaZona(evento: DragEvent): void {
    // A zona já tratou (e marcou como tratado) o drop que recebeu.
    if (evento.defaultPrevented) return;
    evento.preventDefault();
    this.onDrop(evento.dataTransfer?.files);
  }

  onFilesPicked(input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (this.disabled()) return;
    this.handleFiles(files);
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.errors.set([]);
    this.focarZona();
  }

  openFilePicker(): void {
    if (this.disabled()) return;
    this.fileInput().nativeElement.click();
  }

  /** A primeira mensagem mantém o id estável da instância; as demais levam o índice. */
  protected idDaMensagem(indice: number): string {
    return indice === 0 ? this.errorId : `${this.errorId}-${indice}`;
  }

  protected retirar(id: string): void {
    this.errors.set([]);
    this.itemRetirado.emit(id);
    this.focarZona();
  }

  protected baixar(id: string): void {
    this.itemBaixado.emit(id);
  }

  protected repetir(id: string): void {
    this.errors.set([]);
    this.tentarDeNovo.emit(id);
    this.focarZona();
  }

  protected tamanhoDe(arquivo: ArquivoEmEnvio): string | null {
    const bytes = arquivo.tamanhoBytes;
    return bytes === undefined ? null : formatarTamanhoDeArquivo(bytes);
  }

  protected textoDaFase(arquivo: ArquivoEmEnvio): string {
    switch (arquivo.fase) {
      case 'iniciando':
        return 'Preparando o envio';
      case 'enviando':
        return `Enviando: ${arquivo.progresso}%`;
      case 'confirmando':
        return 'Validando o arquivo';
      case 'verificando':
        return arquivo.mensagem || 'Arquivo em verificação';
      case 'confirmado':
        return 'Envio concluído';
      case 'erro':
        return 'O envio não foi concluído';
    }
  }

  // O leitor de tela recebe o andamento em passos: anunciar cada percentual interromperia
  // quem lê a página a cada fração de segundo.
  protected anuncioDaFase(arquivo: ArquivoEmEnvio): string {
    const nome = arquivo.nome;
    if (arquivo.fase !== 'enviando') return `${nome}: ${this.textoDaFase(arquivo)}`;
    const passo = Math.floor(arquivo.progresso / PASSO_ANUNCIADO) * PASSO_ANUNCIADO;
    return `${nome}: enviando, ${passo}%`;
  }

  // Depois de retirar um arquivo o botão que tinha o foco some; devolver o foco à zona evita
  // que a navegação por teclado recomece do topo da página.
  // O consumidor pode desabilitar a zona em resposta ao próprio evento; o destino do foco é
  // decidido depois da renderização, e com a zona desabilitada a lista o recebe, para o foco não
  // cair no <body>.
  private focarZona(): void {
    afterNextRender(
      () => {
        const zona = this.dropZone()?.nativeElement;
        if (zona !== undefined && !zona.disabled) {
          zona.focus();
          return;
        }
        this.lista()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  // Validação client-side é UX/anti-engano. A fronteira real de segurança
  // (magic bytes, antivírus) é responsabilidade do servidor — ver ADR-012
  // (quarentena → ClamAV → bucket definitivo).
  private handleFiles(files: readonly File[]): void {
    if (files.length === 0) return;

    if (!this.modoMultiplo()) {
      if (files.length > 1) {
        this.errors.set(['Envie um arquivo por vez.']);
        return;
      }
      this.handleSingle(files[0]);
      return;
    }

    const recusas: string[] = [];
    const aprovados: File[] = [];
    const limite = this.maxFiles();
    let vagas = this.vagasRestantes();
    for (const file of files) {
      const result = this.validate(file);
      if (!result.ok) {
        recusas.push(`${file.name}: ${result.reason}`);
      } else if (vagas <= 0) {
        recusas.push(`${file.name}: ${this.mensagemDoLimite(limite)}`);
      } else {
        aprovados.push(file);
        vagas--;
      }
    }
    this.errors.set(recusas);
    if (aprovados.length > 0) this.arquivosEscolhidos.emit(aprovados);
  }

  private vagasRestantes(): number {
    const limite = this.maxFiles();
    return limite === null ? Infinity : limite - (this.itens()?.length ?? 0);
  }

  private mensagemDoLimite(limite: number | null): string {
    return `o limite de ${limite} ${limite === 1 ? 'arquivo' : 'arquivos'} foi atingido.`;
  }

  private handleSingle(file: File): void {
    if (this.itens() !== null && this.vagasRestantes() <= 0) {
      this.errors.set([`${file.name}: ${this.mensagemDoLimite(this.maxFiles())}`]);
      return;
    }
    const result = this.validate(file);
    if (!result.ok) {
      this.errors.set([result.reason]);
      return;
    }
    this.errors.set([]);
    if (this.itens() === null) this.selectedFile.set(file);
    this.arquivosEscolhidos.emit([file]);
    // A zona que tinha o foco sai de cena com o arquivo escolhido: o foco vai para o Remover.
    if (this.zonaOculta()) {
      afterNextRender(() => this.removerArquivo()?.nativeElement.focus(), {
        injector: this.injector,
      });
    }
  }

  private validate(file: File): ValidationResult {
    if (file.size === 0) {
      return { ok: false, reason: 'O arquivo está vazio.' };
    }
    if (file.size > this.maxBytes()) {
      return { ok: false, reason: this.maxSizeError() };
    }
    if (!this.isMimeAllowed(file) || !this.isExtensionAllowed(file)) {
      return { ok: false, reason: this.typeNotAllowedError() };
    }
    return { ok: true };
  }

  private isMimeAllowed(file: File): boolean {
    if (this.validarSoPelaExtensao()) return true;
    return this.normalizedMimeTypes().includes(file.type.toLowerCase());
  }

  private isExtensionAllowed(file: File): boolean {
    const dotIndex = file.name.lastIndexOf('.');
    if (dotIndex < 0) return false;
    const extension = file.name.slice(dotIndex).toLowerCase();
    return this.acceptedExtensions().includes(extension);
  }
}
