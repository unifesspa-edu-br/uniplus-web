import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation, UploadItem } from '../../processo-seletivo.models';

@Component({
  selector: 'sel-step-02-identificacao',
  standalone: true,
  templateUrl: './step-02-identificacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step02IdentificacaoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly destroyRef = inject(DestroyRef);
  readonly dragging = signal(false);
  /** Campos inválidos detectados na última validação (chave → `.is-invalid`). */
  readonly invalidFields = signal<ReadonlySet<string>>(new Set());
  /** Mensagem de erro do upload (formato não permitido). `null` = sem erro. */
  readonly uploadError = signal<string | null>(null);
  /** Extensões permitidas no upload do edital. */
  readonly allowedExtensions = ['pdf', 'png', 'jpeg', 'jpg', 'docx'] as const;
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;

  constructor() {
    this.destroyRef.onDestroy(() => this.timers.forEach((timer) => clearInterval(timer)));
  }

  patch(
    field: 'numero' | 'ano' | 'data' | 'orgao' | 'periodo' | 'nome',
    value: string | number | null,
  ): void {
    if (field === 'ano' && typeof value === 'number' && !Number.isFinite(value)) {
      value = null; // input numérico vazio
    }
    this.store.patchObjectSection('identificacao', { [field]: value });
  }

  openDatePicker(input: HTMLInputElement): void {
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  chooseFiles(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.addFiles(input.files);
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (event.dataTransfer?.files) this.addFiles(event.dataTransfer.files);
  }

  removeUpload(id: string): void {
    const timer = this.timers.get(id);
    if (timer) clearInterval(timer);
    this.timers.delete(id);
    this.store.patchObjectSection('identificacao', {
      uploads: this.store.draft().identificacao.uploads.filter((item) => item.id !== id),
    });
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

  private addFiles(files: FileList): void {
    const rejected: string[] = [];
    const accepted: UploadItem[] = [];

    Array.from(files).forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!this.allowedExtensions.includes(extension as (typeof this.allowedExtensions)[number])) {
        rejected.push(file.name);
        return;
      }
      accepted.push({
        id: crypto.randomUUID(),
        name: file.name,
        extension: extension as UploadItem['extension'],
        progress: 0,
      });
    });

    if (rejected.length) {
      this.uploadError.set(
        rejected.length === 1
          ? `Formato não permitido: "${rejected[0]}". Use apenas PDF, PNG, JPEG, JPG ou DOCX.`
          : `Formatos não permitidos: ${rejected.map((name) => `"${name}"`).join(', ')}. Use apenas PDF, PNG, JPEG, JPG ou DOCX.`,
      );
      return; // não carrega nenhum arquivo inválido
    }

    this.uploadError.set(null);
    this.store.patchObjectSection('identificacao', {
      uploads: [...this.store.draft().identificacao.uploads, ...accepted],
    });
    accepted.forEach((item) => this.animate(item.id));
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
    if (!id.uploads.length) {
      messages.push('Anexe o edital em PDF (obrigatório para auditoria).');
      invalid.add('uploads');
    } else if (id.uploads.some((file) => file.progress < 100)) {
      messages.push('Aguarde o upload do edital concluir.');
      invalid.add('uploads');
    }

    this.invalidFields.set(invalid);
    return messages.length ? { valid: false, messages } : { valid: true };
  }

  private animate(id: string): void {
    const timer = setInterval(() => {
      const uploads = this.store.draft().identificacao.uploads;
      const item = uploads.find((upload) => upload.id === id);
      if (!item) {
        clearInterval(timer);
        this.timers.delete(id);
        return;
      }
      const progress = Math.min(item.progress + Math.random() * 18 + 7, 100);
      this.store.patchObjectSection('identificacao', {
        uploads: uploads.map((upload) => (upload.id === id ? { ...upload, progress } : upload)),
      });
      if (progress >= 100) {
        clearInterval(timer);
        this.timers.delete(id);
      }
    }, 80);
    this.timers.set(id, timer);
  }
}
