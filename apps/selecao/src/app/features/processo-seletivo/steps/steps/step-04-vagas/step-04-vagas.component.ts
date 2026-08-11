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
import { CURSOS } from '../../processo-seletivo.data';
import { Curso, OfertaCurso, StepValidation, Turno } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { OverlayScrollService } from '../../shared/overlay-scroll.service';

@Component({
  selector: 'sel-step-04-vagas',
  standalone: true,
  templateUrl: './step-04-vagas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step04VagasComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly overlayScroll = inject(OverlayScrollService);
  private readonly destroyRef = inject(DestroyRef);
  readonly cursos = CURSOS;
  readonly pendingIds = signal<ReadonlySet<number>>(new Set());
  readonly ofertas = computed(() => this.store.draft().vagas.cursos);
  readonly total = computed(() => this.ofertas().reduce((sum, item) => sum + item.vagas, 0));
  readonly availableCourses = computed(() => {
    const added = new Set(this.ofertas().map((item) => item.id));
    return this.cursos.filter((curso) => !added.has(curso.id));
  });
  readonly modalAll = computed(() => {
    const available = this.availableCourses();
    return available.length > 0 && available.every((item) => this.pendingIds().has(item.id));
  });
  readonly modalIndeterminate = computed(() => this.pendingIds().size > 0 && !this.modalAll());

  private modalOpen = false;

  constructor() {
    // Sair da rota com o modal aberto deixava o scroll travado na próxima.
    this.destroyRef.onDestroy(() => {
      if (this.modalOpen) this.overlayScroll.unlock();
    });
  }

  @ViewChild('vagasDialog') private dialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('addButton') private addButton?: ElementRef<HTMLButtonElement>;

  openModal(): void {
    if (this.modalOpen || !this.dialog) return;
    this.pendingIds.set(new Set());
    this.dialog.nativeElement.showModal();
    this.modalOpen = true;
    this.overlayScroll.lock();
  }

  closeModal(): void {
    if (!this.modalOpen) return;
    if (this.dialog?.nativeElement.open) this.dialog.nativeElement.close();
    this.modalOpen = false;
    this.overlayScroll.unlock();
    queueMicrotask(() => this.addButton?.nativeElement.focus());
  }

  onCancel(event: Event): void {
    event.preventDefault();
    this.closeModal();
  }

  onBackdrop(event: Event): void {
    if (event.target === this.dialog?.nativeElement) this.closeModal();
  }

  togglePending(id: number, checked: boolean): void {
    this.pendingIds.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  toggleAll(checked: boolean): void {
    this.pendingIds.set(
      checked ? new Set(this.availableCourses().map((item) => item.id)) : new Set(),
    );
  }

  confirmSelection(): void {
    const selected = this.cursos.filter((curso) => this.pendingIds().has(curso.id));
    const next: OfertaCurso[] = [
      ...this.ofertas(),
      ...selected.map((curso) => ({ ...curso, turno: '' as Turno, vagas: 0 })),
    ];
    this.store.patchObjectSection('vagas', { cursos: next });
    this.closeModal();
  }

  remove(id: number): void {
    this.store.patchObjectSection('vagas', {
      cursos: this.ofertas().filter((item) => item.id !== id),
    });
  }

  update(id: number, patch: Partial<Pick<OfertaCurso, 'turno' | 'vagas'>>): void {
    this.store.patchObjectSection('vagas', {
      cursos: this.ofertas().map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }

  changeVagas(id: number, value: number): void {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.min(9999, value)) : 0;
    this.update(id, { vagas: normalized });
  }

  increment(id: number, delta: number): void {
    const current = this.ofertas().find((item) => item.id === id)?.vagas ?? 0;
    this.changeVagas(id, current + delta);
  }

  courseAdded(course: Curso): boolean {
    return this.ofertas().some((item) => item.id === course.id);
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    if (!this.ofertas().length) {
      return { valid: false, message: 'Adicione ao menos um curso ao quadro de vagas.' };
    }
    if (this.ofertas().some((item) => item.vagas <= 0)) {
      return { valid: false, message: 'Todos os cursos devem ter pelo menos 1 vaga.' };
    }
    if (this.ofertas().some((item) => !item.turno)) {
      return { valid: false, message: 'Informe o turno de cada curso.' };
    }
    return { valid: true };
  }
}
