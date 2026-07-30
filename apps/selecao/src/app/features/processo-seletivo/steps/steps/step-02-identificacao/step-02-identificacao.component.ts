import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { UploadItem } from '../../processo-seletivo.models';

@Component({
  selector: 'app-step-02-identificacao',
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

  patch(field: 'numero' | 'ano' | 'data' | 'orgao' | 'periodo' | 'nome', value: string | number): void {
    this.store.patchObjectSection('identificacao', { [field]: value });
  }

  openDatePicker(input: HTMLInputElement): void {
    try { input.showPicker(); } catch { input.focus(); }
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
        uploads: uploads.map((upload) => upload.id === id ? { ...upload, progress } : upload),
      });
      if (progress >= 100) {
        clearInterval(timer);
        this.timers.delete(id);
      }
    }, 80);
    this.timers.set(id, timer);
  }
}
