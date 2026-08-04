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

  private addFiles(files: FileList): void {
    const accepted: UploadItem[] = [];
    Array.from(files).forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension !== 'pdf' && extension !== 'png') return;
      accepted.push({ id: crypto.randomUUID(), name: file.name, extension, progress: 0 });
    });
    if (!accepted.length) return;
    this.store.patchObjectSection('identificacao', {
      uploads: [...this.store.draft().identificacao.uploads, ...accepted],
    });
    accepted.forEach((item) => this.animate(item.id));
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const id = this.store.draft().identificacao;
    if (!id.numero.trim()) return { valid: false, message: 'Informe o número do edital.' };
    if (!id.ano || id.ano < 2000) return { valid: false, message: 'Informe o ano do edital.' };
    if (!id.data) return { valid: false, message: 'Informe a data do processo.' };
    if (!id.orgao.trim()) return { valid: false, message: 'Informe a sigla do órgão expedidor.' };
    if (!id.periodo.trim()) return { valid: false, message: 'Informe o período de ingresso.' };
    if (!id.nome.trim()) return { valid: false, message: 'Informe o nome do processo seletivo.' };
    if (!id.uploads.length) {
      return { valid: false, message: 'Anexe o edital em PDF (obrigatório para auditoria).' };
    }
    if (id.uploads.some((file) => file.progress < 100)) {
      return { valid: false, message: 'Aguarde o upload do edital concluir.' };
    }
    return { valid: true };
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
