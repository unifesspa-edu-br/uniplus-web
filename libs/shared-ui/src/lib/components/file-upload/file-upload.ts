import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

type ValidationResult = { ok: true } | { ok: false; reason: string };

@Component({
  selector: 'ui-file-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      @if (label()) {
        <label [attr.for]="inputId" class="text-sm font-medium text-gray-700">{{ label() }}</label>
      }
      <button
        #dropZone
        type="button"
        class="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-8 text-left transition-colors hover:border-govbr-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-govbr-primary"
        [class.border-govbr-primary]="isDragging()"
        [class.bg-blue-50]="isDragging()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-describedby]="error() ? errorId : null"
        (click)="openFilePicker()"
        (dragover)="$event.preventDefault(); onDragOver()"
        (dragleave)="onDragLeave()"
        (drop)="$event.preventDefault(); onDrop($event.dataTransfer?.files)"
      >
        <div class="text-center">
          <p class="text-sm text-gray-600">
            Arraste um arquivo aqui ou
            <span class="font-medium text-govbr-primary underline">selecione do computador</span>
          </p>
          <p class="mt-1 text-xs text-gray-500">
            {{ acceptLabel() }} &mdash; Tamanho máximo: {{ maxSizeMb() }}MB
          </p>
        </div>
      </button>
      <input
        #fileInput
        [id]="inputId"
        type="file"
        class="hidden"
        [accept]="accept()"
        (change)="onFilesPicked(fileInput)"
      />
      @let file = selectedFile();
      @if (file) {
        <div class="flex items-center justify-between rounded-md bg-gray-100 px-3 py-2">
          <span class="text-sm text-gray-700">{{ file.name }}</span>
          <button
            type="button"
            class="text-sm text-red-600 hover:underline"
            (click)="removeFile()"
            aria-label="Remover arquivo"
          >
            Remover
          </button>
        </div>
      }
      @if (error(); as message) {
        <small [id]="errorId" class="text-xs text-red-600" role="alert">{{ message }}</small>
      }
    </div>
  `,
})
export class FileUploadComponent {
  // Garante IDs únicos por instância para isolar `for`/`aria-describedby`
  // quando há múltiplos `<ui-file-upload>` na mesma página.
  private static instanceCount = 0;
  private readonly instanceId = `ui-file-upload-${++FileUploadComponent.instanceCount}`;

  readonly inputId = `${this.instanceId}-input`;
  readonly errorId = `${this.instanceId}-error`;

  readonly label = input<string>('');
  readonly accept = input<string>('.pdf,.jpg,.jpeg,.png');
  readonly allowedMimeTypes = input<readonly string[]>([
    'application/pdf',
    'image/jpg',
    'image/jpeg',
    'image/png',
  ]);
  readonly acceptLabel = input<string>('PDF, JPG ou PNG');
  readonly maxSizeMb = input<number>(10);

  readonly selectedFile = model<File | null>(null);
  readonly isDragging = signal(false);
  readonly error = signal<string | null>(null);

  readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  readonly ariaLabel = computed(
    () => `Área de upload de arquivo. ${this.acceptLabel()}. Tamanho máximo ${this.maxSizeMb()}MB.`,
  );

  private readonly maxBytes = computed(() => this.maxSizeMb() * 1024 * 1024);
  private readonly acceptedExtensions = computed(() =>
    this.accept()
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
    () => `Tipo de arquivo não permitido. Envie arquivos nos formatos: ${this.accept()}`,
  );

  onDragOver(): void {
    this.isDragging.set(true);
  }

  onDragLeave(): void {
    this.isDragging.set(false);
  }

  onDrop(files: FileList | null | undefined): void {
    this.isDragging.set(false);
    const file = files?.[0];
    if (file) this.handleFile(file);
  }

  onFilesPicked(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (file) this.handleFile(file);
    input.value = '';
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.error.set(null);
  }

  openFilePicker(): void {
    this.fileInput().nativeElement.click();
  }

  // Validação client-side é UX/anti-engano. A fronteira real de segurança
  // (magic bytes, antivírus) é responsabilidade do servidor — ver ADR-012
  // (quarentena → ClamAV → bucket definitivo).
  private handleFile(file: File): void {
    const result = this.validate(file);
    if (!result.ok) {
      this.error.set(result.reason);
      return;
    }
    this.error.set(null);
    this.selectedFile.set(file);
  }

  private validate(file: File): ValidationResult {
    if (file.size > this.maxBytes()) {
      return { ok: false, reason: this.maxSizeError() };
    }
    if (!this.isMimeAllowed(file) || !this.isExtensionAllowed(file)) {
      return { ok: false, reason: this.typeNotAllowedError() };
    }
    return { ok: true };
  }

  private isMimeAllowed(file: File): boolean {
    return this.normalizedMimeTypes().includes(file.type.toLowerCase());
  }

  private isExtensionAllowed(file: File): boolean {
    const dotIndex = file.name.lastIndexOf('.');
    if (dotIndex < 0) return false;
    const extension = file.name.slice(dotIndex).toLowerCase();
    return this.acceptedExtensions().includes(extension);
  }
}
