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
import { CRITERIOS_DESEMPATE } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';
import { OverlayScrollService } from '../../shared/overlay-scroll.service';

@Component({
  selector: 'sel-step-09-desempate',
  standalone: true,
  templateUrl: './step-09-desempate.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step09DesempateComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly overlay = inject(OverlayScrollService);
  private readonly destroyRef = inject(DestroyRef);
  readonly criteria = CRITERIOS_DESEMPATE;
  readonly pending = signal<ReadonlySet<number>>(new Set());
  readonly ordered = computed(() =>
    this.store
      .draft()
      .desempate.map((id) => this.criteria.find((item) => item.id === id))
      .filter((item) => item !== undefined),
  );
  private modalOpen = false;

  constructor() {
    // Sair da rota com o modal aberto deixava o scroll travado na próxima.
    this.destroyRef.onDestroy(() => {
      if (this.modalOpen) this.overlay.unlock();
    });
  }

  @ViewChild('criteriaDialog') private dialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('addCriterion') private addButton?: ElementRef<HTMLButtonElement>;

  open(): void {
    if (this.modalOpen || !this.dialog) return;
    this.pending.set(new Set());
    this.dialog.nativeElement.showModal();
    this.modalOpen = true;
    this.overlay.lock();
  }
  close(): void {
    if (!this.modalOpen) return;
    if (this.dialog?.nativeElement.open) this.dialog.nativeElement.close();
    this.modalOpen = false;
    this.overlay.unlock();
    queueMicrotask(() => this.addButton?.nativeElement.focus());
  }
  cancel(event: Event): void {
    event.preventDefault();
    this.close();
  }
  backdrop(event: Event): void {
    if (event.target === this.dialog?.nativeElement) this.close();
  }

  move(index: number, delta: number): void {
    const order = [...this.store.draft().desempate];
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    this.store.patchSection('desempate', order);
  }
  remove(id: number): void {
    this.store.patchSection(
      'desempate',
      this.store.draft().desempate.filter((item) => item !== id),
    );
  }
  toggle(id: number, checked: boolean): void {
    this.pending.update((set) => {
      const next = new Set(set);

      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }
  confirm(): void {
    this.store.patchSection(
      'desempate',
      [...this.store.draft().desempate, ...this.pending()].filter(
        (id, i, all) => all.indexOf(id) === i,
      ),
    );
    this.close();
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    return this.store.draft().desempate.length > 0
      ? { valid: true }
      : { valid: false, message: 'Adicione ao menos um critério de desempate.' };
  }
}
