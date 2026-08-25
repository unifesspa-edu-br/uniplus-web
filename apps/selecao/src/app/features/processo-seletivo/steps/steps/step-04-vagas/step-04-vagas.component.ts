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
import { extractNextCursor, isApiOk } from '@uniplus/shared-core/http';
import { CursosApi, OfertaCursoDto, OfertasCursoApi } from '@uniplus/shared-data/configuracao';
import { OfertaVaga, StepValidation, Turno } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { OverlayScrollService } from '../../shared/overlay-scroll.service';

/** Opção de oferta exibida no modal do passo 4, mapeada do catálogo real. */
export interface OfertaOption {
  readonly id: string;
  readonly cursoId: string;
  readonly nome: string;
  readonly grau: string;
  readonly campus: string;
  readonly unidade: string;
  readonly turno: string;
  readonly vagasAnuaisAutorizadas: number | null;
  readonly localOfertaId: string;
}

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
  private readonly ofertasApi = inject(OfertasCursoApi);
  private readonly cursosApi = inject(CursosApi);
  /** cursoId -> nome para resolver o rotulo da oferta no modal. */
  private readonly cursosPorId = new Map<string, string>();

  /** Ofertas de curso do catálogo de Configuração (catálogo real). */
  readonly ofertasCatalogo = signal<readonly OfertaOption[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly pendingIds = signal<ReadonlySet<string>>(new Set());
  readonly ofertas = computed(() => this.store.draft().vagas.cursos);
  readonly total = computed(() => this.ofertas().reduce((sum, item) => sum + item.vagas, 0));
  readonly availableCourses = computed(() => {
    const added = new Set(this.ofertas().map((item) => item.ofertaCursoId));
    return this.ofertasCatalogo().filter((curso) => !added.has(curso.id));
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
    this.carregarCursos();
    this.carregarOfertas();
  }

  private carregarCursos(): void {
    this.cursosApi
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (!isApiOk(result)) return;
          for (const curso of result.data) this.cursosPorId.set(curso.id, curso.nome);
        },
        error: () => this.cursosPorId.clear(),
      });
  }

  carregarOfertas(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.carregarPagina();
  }

  private carregarPagina(cursor?: string, acumuladas: readonly OfertaOption[] = []): void {
    const consulta =
      cursor === undefined
        ? this.ofertasApi.listar()
        : this.ofertasApi.listar({ cursor, direction: 'next' });

    consulta.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        if (!isApiOk(result)) {
          this.exibirErro();
          return;
        }
        const ofertas = [...acumuladas, ...result.data.map((oferta) => this.toOption(oferta))];
        const proximoCursor = extractNextCursor(result.headers.get('Link'));
        if (proximoCursor !== null) {
          this.carregarPagina(proximoCursor, ofertas);
          return;
        }
        this.ofertasCatalogo.set(ofertas);
        this.loading.set(false);
      },
      error: () => this.exibirErro(),
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

  togglePending(id: string, checked: boolean): void {
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
    const selected = this.ofertasCatalogo().filter((oferta) => this.pendingIds().has(oferta.id));
    const next: OfertaVaga[] = [
      ...this.ofertas(),
      ...selected.map((oferta) => ({
        ofertaCursoId: oferta.id,
        cursoId: oferta.cursoId,
        nome: oferta.nome,
        grau: oferta.grau,
        campus: oferta.campus,
        unidade: oferta.unidade,
        turno: (oferta.turno as Turno) ?? '',
        vagas: 0,
      })),
    ];
    this.store.patchObjectSection('vagas', { cursos: next });
    this.closeModal();
  }

  remove(id: string): void {
    this.store.patchObjectSection('vagas', {
      cursos: this.ofertas().filter((item) => item.ofertaCursoId !== id),
    });
  }

  update(id: string, patch: Partial<Pick<OfertaVaga, 'turno' | 'vagas'>>): void {
    this.store.patchObjectSection('vagas', {
      cursos: this.ofertas().map((item) =>
        item.ofertaCursoId === id ? { ...item, ...patch } : item,
      ),
    });
  }

  changeVagas(id: string, value: number): void {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.min(9999, value)) : 0;
    this.update(id, { vagas: normalized });
  }

  increment(id: string, delta: number): void {
    const current = this.ofertas().find((item) => item.ofertaCursoId === id)?.vagas ?? 0;
    this.changeVagas(id, current + delta);
  }

  courseAdded(id: string): boolean {
    return this.ofertas().some((item) => item.ofertaCursoId === id);
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

  private toOption(oferta: OfertaCursoDto): OfertaOption {
    return {
      id: oferta.id,
      cursoId: oferta.cursoId,
      nome: this.cursosPorId.get(oferta.cursoId) ?? `Oferta ${oferta.cursoId.slice(0, 8)}`,
      grau: 'Graduação',
      campus: oferta.unidadeOfertante?.nome ?? '',
      unidade: oferta.unidadeOfertante?.sigla ?? '',
      turno: oferta.turno ?? '',
      vagasAnuaisAutorizadas: oferta.vagasAnuaisAutorizadas
        ? Number(oferta.vagasAnuaisAutorizadas)
        : null,
      localOfertaId: oferta.localOfertaId,
    };
  }

  private exibirErro(): void {
    this.loading.set(false);
    this.errorMessage.set('Não foi possível carregar as ofertas de curso. Tente novamente.');
  }
}
