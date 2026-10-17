import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';

type ValidationResult = { ok: true } | { ok: false; reason: string };

/** Onde o envio de um arquivo está: o componente só exibe, quem envia informa. */
export type FaseDoArquivo = 'iniciando' | 'enviando' | 'confirmando' | 'confirmado' | 'erro';

/** Um arquivo da lista, como o consumidor o reporta. */
export interface ArquivoEmEnvio {
  readonly id: string;
  readonly nome: string;
  readonly tamanhoBytes?: number;
  readonly fase: FaseDoArquivo;
  /** Percentual de 0 a 100. */
  readonly progresso: number;
  /** Texto da falha, exibido quando a fase é `erro`. */
  readonly mensagem?: string | null;
  /** `false` quando repetir não adianta; o padrão é oferecer a nova tentativa. */
  readonly podeTentarDeNovo?: boolean;
  /** `false` quando o arquivo não pode mais sair da lista; o padrão é permitir. */
  readonly podeRetirar?: boolean;
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
    <div class="uni-uploader">
      @if (fieldLabel()) {
        <label [attr.for]="inputId" class="field__label">{{ fieldLabel() }}</label>
      }
      <button
        #dropZone
        type="button"
        class="uni-uploader__drop"
        [class.is-dragging]="isDragging()"
        [disabled]="disabled()"
        [attr.aria-disabled]="disabled() ? 'true' : null"
        [attr.aria-label]="dropZoneAccessibleName()"
        [attr.aria-describedby]="describedBy()"
        (click)="openFilePicker()"
        (dragover)="$event.preventDefault(); onDragOver()"
        (dragleave)="onDragLeave()"
        (drop)="$event.preventDefault(); onDrop($event.dataTransfer?.files)"
      >
        <span class="uni-uploader__icon" aria-hidden="true">↑</span>
        <p class="uni-uploader__title">{{ dropTitle() }}</p>
        <p class="uni-uploader__hint">{{ dropHint() }}</p>
      </button>
      <input
        #fileInput
        [id]="inputId"
        type="file"
        class="hidden"
        [accept]="acceptedFileTypes()"
        [multiple]="multiple()"
        [disabled]="disabled()"
        [attr.aria-describedby]="describedBy()"
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
              type="button"
              class="btn btn--tertiary btn--sm"
              (click)="removeFile()"
              aria-label="Remover arquivo"
            >
              Remover
            </button>
          </div>
        }
      } @else if (lista.length > 0) {
        <ul class="uni-uploader__list" [attr.aria-label]="listaAccessibleName()">
          @for (arquivo of lista; track arquivo.id) {
            <li
              class="uni-uploader__item"
              [class.is-error]="arquivo.fase === 'erro'"
              [class.is-success]="arquivo.fase === 'confirmado'"
            >
              <div class="uni-uploader__item-body">
                <div class="uni-uploader__item-name" [title]="arquivo.nome">{{ arquivo.nome }}</div>
                @if (tamanhoDe(arquivo); as tamanho) {
                  <div class="uni-uploader__item-meta">{{ tamanho }}</div>
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
                <div class="sr-only" role="status" aria-live="polite">{{ anuncioDaFase(arquivo) }}</div>
                @if (arquivo.fase === 'erro' && arquivo.mensagem) {
                  <small class="field__error" role="alert">{{ arquivo.mensagem }}</small>
                }
              </div>
              <div class="uni-uploader__item-actions">
                @if (arquivo.fase === 'erro' && arquivo.podeTentarDeNovo !== false) {
                  <button
                    type="button"
                    class="btn btn--tertiary btn--sm"
                    [attr.aria-label]="'Tentar enviar novamente ' + arquivo.nome"
                    (click)="tentarDeNovo.emit(arquivo.id)"
                  >
                    Tentar novamente
                  </button>
                }
                @if (arquivo.podeRetirar !== false) {
                  <button
                    type="button"
                    class="btn btn--tertiary btn--sm"
                    [attr.aria-label]="'Remover ' + arquivo.nome"
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
          [id]="$index === 0 ? errorId : null"
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
  private readonly instanceId = `ui-file-upload-${++FileUploadComponent.instanceCount}`;

  /** Id do campo de arquivo; o consumidor pode fixá-lo quando algo externo o referencia. */
  readonly idDoCampo = input<string | null>(null);

  get inputId(): string {
    return this.idDoCampo() ?? `${this.instanceId}-input`;
  }
  readonly errorId = `${this.instanceId}-error`;

  readonly fieldLabel = input<string>('');
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
  /** Teto de arquivos na lista, contando os já presentes; sem valor, não há teto. */
  readonly maxFiles = input<number | null>(null);
  /**
   * Alguns sistemas não informam o tipo MIME de formatos como ODT. Com isto, tipo vazio passa pela
   * extensão; tipo informado continua tendo de estar em `allowedMimeTypes`.
   */
  readonly mimeOpcional = input(false);
  readonly disabled = input(false);
  /** Ids de elementos que descrevem o campo, lidos junto do nome pelo leitor de tela. */
  readonly descritoPor = input<string | null>(null);
  /** Recusa que nasce no consumidor (por exemplo, uma regra do fluxo) e deve aparecer junto. */
  readonly mensagemExterna = input<string | null>(null);

  /** Lista de arquivos reportada pelo consumidor; `null` mantém o modo simples. */
  readonly itens = input<readonly ArquivoEmEnvio[] | null>(null);

  /** Arquivos aprovados na validação, a enviar. */
  readonly arquivosEscolhidos = output<readonly File[]>();
  readonly itemRetirado = output<string>();
  readonly tentarDeNovo = output<string>();

  readonly selectedFile = model<File | null>(null);
  readonly isDragging = signal(false);
  readonly errors = signal<readonly string[]>([]);
  readonly error = computed(() => this.errors()[0] ?? null);
  readonly messages = computed(() => {
    const externa = this.mensagemExterna();
    return externa ? [...this.errors(), externa] : this.errors();
  });

  readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly dropZone = viewChild.required<ElementRef<HTMLButtonElement>>('dropZone');

  readonly dropZoneAccessibleName = computed(() => {
    const alvo = this.multiple() ? 'arquivos' : 'arquivo';
    return `Área de upload de ${alvo}. ${this.acceptLabel()}. Tamanho máximo ${this.maxSizeMb()}MB.`;
  });
  readonly dropTitle = computed(() =>
    this.multiple()
      ? 'Arraste arquivos aqui ou selecione do computador'
      : 'Arraste um arquivo aqui ou selecione do computador',
  );
  readonly dropHint = computed(() => {
    const limite = this.maxFiles();
    const quantidade = this.multiple() && limite !== null ? ` - até ${limite} arquivos` : '';
    return `${this.acceptLabel()} - tamanho máximo: ${this.maxSizeMb()}MB${quantidade}`;
  });
  readonly listaAccessibleName = computed(() => 'Arquivos enviados');
  readonly describedBy = computed(() => {
    const ids = [this.descritoPor(), this.messages().length > 0 ? this.errorId : null].filter(
      (id): id is string => !!id,
    );
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

  protected retirar(id: string): void {
    this.itemRetirado.emit(id);
    this.focarZona();
  }

  protected tamanhoDe(arquivo: ArquivoEmEnvio): string | null {
    const bytes = arquivo.tamanhoBytes;
    if (bytes === undefined) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < BYTES_POR_MB) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / BYTES_POR_MB).toFixed(1).replace('.', ',')} MB`;
  }

  protected textoDaFase(arquivo: ArquivoEmEnvio): string {
    switch (arquivo.fase) {
      case 'iniciando':
        return 'Preparando o envio';
      case 'enviando':
        return `Enviando: ${arquivo.progresso}%`;
      case 'confirmando':
        return 'Validando o arquivo';
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
  private focarZona(): void {
    this.dropZone().nativeElement.focus();
  }

  // Validação client-side é UX/anti-engano. A fronteira real de segurança
  // (magic bytes, antivírus) é responsabilidade do servidor — ver ADR-012
  // (quarentena → ClamAV → bucket definitivo).
  private handleFiles(files: readonly File[]): void {
    if (files.length === 0) return;

    if (this.itens() === null || !this.multiple()) {
      this.handleSingle(files[0]);
      return;
    }

    const recusas: string[] = [];
    const aprovados: File[] = [];
    const limite = this.maxFiles();
    let vagas = limite === null ? Infinity : limite - (this.itens()?.length ?? 0);
    for (const file of files) {
      const result = this.validate(file);
      if (!result.ok) {
        recusas.push(`${file.name}: ${result.reason}`);
      } else if (vagas <= 0) {
        recusas.push(`${file.name}: o limite de ${limite} arquivos foi atingido.`);
      } else {
        aprovados.push(file);
        vagas--;
      }
    }
    this.errors.set(recusas);
    if (aprovados.length > 0) this.arquivosEscolhidos.emit(aprovados);
  }

  private handleSingle(file: File): void {
    const result = this.validate(file);
    if (!result.ok) {
      this.errors.set([result.reason]);
      return;
    }
    this.errors.set([]);
    if (this.itens() === null) this.selectedFile.set(file);
    this.arquivosEscolhidos.emit([file]);
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
    if (file.type === '' && this.mimeOpcional()) return true;
    return this.normalizedMimeTypes().includes(file.type.toLowerCase());
  }

  private isExtensionAllowed(file: File): boolean {
    const dotIndex = file.name.lastIndexOf('.');
    if (dotIndex < 0) return false;
    const extension = file.name.slice(dotIndex).toLowerCase();
    return this.acceptedExtensions().includes(extension);
  }
}
