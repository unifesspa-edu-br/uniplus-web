import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';

@Component({
  selector: 'ui-file-upload',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      @if (label()) {
        <label for="file-upload-input" class="text-sm font-medium text-gray-700">{{ label() }}</label>
      }
      <div
        class="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-8 transition-colors"
        [class.border-unifesspa-primary]="isDragging()"
        [class.bg-blue-50]="isDragging()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave()"
        (drop)="onDrop($event)"
        role="button"
        tabindex="0"
        [attr.aria-label]="'Área de upload de arquivo'"
        (keydown.enter)="fileInput.click()"
      >
        <div class="text-center">
          <p class="text-sm text-gray-600">
            Arraste um arquivo aqui ou
            <button type="button" class="font-medium text-unifesspa-primary hover:underline" (click)="fileInput.click()">
              selecione do computador
            </button>
          </p>
          <p class="mt-1 text-xs text-gray-500">
            {{ acceptLabel() }} &mdash; Tamanho máximo: {{ maxSizeMb() }}MB
          </p>
        </div>
      </div>
      <input
        #fileInput
        id="file-upload-input"
        type="file"
        class="hidden"
        [accept]="accept()"
        (change)="onFileSelected($event)"
      />
      @if (selectedFile()) {
      <div class="flex items-center justify-between rounded-md bg-gray-100 px-3 py-2">
        <span class="text-sm text-gray-700">{{ selectedFile()?.name }}</span>
        <button type="button" class="text-sm text-red-600 hover:underline" (click)="removeFile()" aria-label="Remover arquivo">
          Remover
        </button>
      </div>
      }
      @if (error()) {
        <small class="text-xs text-red-600">{{ error() }}</small>
      }
    </div>
  `,
})
export class FileUploadComponent {
  readonly label = input<string>('');
  readonly accept = input<string>('.pdf,.jpg,.jpeg,.png');
  readonly acceptLabel = input<string>('PDF, JPG ou PNG');
  readonly maxSizeMb = input<number>(10);

  readonly fileSelected = output<File>();

  readonly selectedFile = signal<File | null>(null);
  readonly isDragging = signal(false);
  readonly error = signal<string>('');

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(): void {
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.validateAndSelect(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.validateAndSelect(file);
    }
    input.value = '';
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.error.set('');
  }

  private validateAndSelect(file: File): void {
    const maxBytes = this.maxSizeMb() * 1024 * 1024;
    if (file.size > maxBytes) {
      this.error.set(`Arquivo excede o tamanho máximo de ${this.maxSizeMb()}MB.`);
      return;
    }
    this.error.set('');
    this.selectedFile.set(file);
    this.fileSelected.emit(file);
  }
}
