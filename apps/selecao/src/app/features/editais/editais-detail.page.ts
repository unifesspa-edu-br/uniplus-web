import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  ProblemI18nService,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core';
import { EditaisApi, EditalDto } from '@uniplus/shared-data';
import { ConfirmDialogComponent } from '@uniplus/shared-ui';

/**
 * Extensão local de `EditalDto` para `_links` (HATEOAS Level 1, ADR-0029
 * backend). Hoje o backend ainda não emite `_links` em `EditalDto` — issue
 * tracked em [uniplus-api#334](https://github.com/unifesspa-edu-br/uniplus-api/issues/334).
 *
 * Quando o backend implementar, o codegen pegará a mudança automaticamente
 * (a propriedade já fica opcional aqui, então o cast é seguro). A page lê
 * `_links?.publicar` preferencialmente; se ausente, cai num fallback baseado
 * em `status === 'Rascunho'`. O fallback é temporário e será removido quando
 * `uniplus-api#334` fechar.
 */
type EditalComLinks = EditalDto & {
  readonly _links?: {
    readonly self?: string;
    readonly collection?: string;
    readonly publicar?: string;
  };
};

/**
 * Container (ADR-0017) da feature Editais — detalhe + ação Publicar.
 *
 * **Gating do botão "Publicar" (ADR-0029 backend):** preferencialmente
 * HATEOAS-driven via `_links?.publicar`; fallback temporário a
 * `status === 'Rascunho'` enquanto o backend não emite `_links` (uniplus-api#334).
 *
 * **Idempotency-Key (ADR-0014):** gerada a cada submit (não form-scoped — a
 * ação "Publicar" não tem rascunho de form para preservar; replay protege
 * contra double-click no botão).
 */
@Component({
  selector: 'sel-editais-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, RouterLink],
  template: `
    <header class="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">Detalhes do edital</h2>
        @if (edital()) {
          <p class="text-sm text-gray-600">{{ edital()!.numeroEdital }} — {{ edital()!.titulo }}</p>
        }
      </div>
      <a
        routerLink="/editais"
        class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        Voltar para lista
      </a>
    </header>

    @if (errorMessage()) {
      <div
        class="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
      >
        <span class="font-semibold">{{ errorMessage() }}</span>
      </div>
    }

    @if (mensagemSucesso()) {
      <div
        class="mb-4 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        role="status"
      >
        <span class="font-semibold">{{ mensagemSucesso() }}</span>
      </div>
    }

    @if (loading() && !edital()) {
      <p class="text-sm text-gray-600" aria-live="polite">Carregando edital…</p>
    }

    @if (edital(); as e) {
      <dl class="grid max-w-2xl grid-cols-[10rem_1fr] gap-x-4 gap-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <dt class="text-sm font-medium text-gray-500">Número</dt>
        <dd class="text-sm text-gray-900">{{ e.numeroEdital }}</dd>

        <dt class="text-sm font-medium text-gray-500">Título</dt>
        <dd class="text-sm text-gray-900">{{ e.titulo }}</dd>

        <dt class="text-sm font-medium text-gray-500">Tipo de processo</dt>
        <dd class="text-sm text-gray-900">{{ e.tipoProcesso }}</dd>

        <dt class="text-sm font-medium text-gray-500">Status</dt>
        <dd class="text-sm text-gray-900" data-testid="edital-status">{{ e.status }}</dd>

        <dt class="text-sm font-medium text-gray-500">Máx. opções de curso</dt>
        <dd class="text-sm text-gray-900">{{ e.maximoOpcoesCurso }}</dd>

        <dt class="text-sm font-medium text-gray-500">Bônus regional</dt>
        <dd class="text-sm text-gray-900">{{ e.bonusRegionalHabilitado ? 'Sim' : 'Não' }}</dd>

        <dt class="text-sm font-medium text-gray-500">Criado em</dt>
        <dd class="text-sm text-gray-900">{{ e.criadoEm }}</dd>
      </dl>

      @if (podePublicar()) {
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            data-testid="btn-publicar"
            [disabled]="submitting()"
            class="rounded-md bg-unifesspa-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-unifesspa-primary disabled:cursor-not-allowed disabled:opacity-60"
            (click)="abrirConfirmacao()"
          >
            {{ submitting() ? 'Publicando…' : 'Publicar' }}
          </button>
        </div>
      }
    }

    <ui-confirm-dialog
      [(visible)]="dialogVisivel"
      title="Confirmar publicação"
      message="Após a publicação, o edital fica visível para candidatos e não pode mais ser editado. Deseja prosseguir?"
      confirmLabel="Publicar"
      cancelLabel="Cancelar"
      (confirmed)="confirmarPublicacao()"
    />
  `,
})
export class EditaisDetailPage implements OnInit {
  /** Path param do route (`:id`). Bind via `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  private readonly api = inject(EditaisApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly edital = signal<EditalComLinks | null>(null);
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly submitting = signal<boolean>(false);
  readonly mensagemSucesso = signal<string | null>(null);
  readonly dialogVisivel = signal<boolean>(false);

  /**
   * Caminho A (HATEOAS-driven, ADR-0029): se `_links.publicar` presente,
   * gating vem do servidor. Caminho B (fallback temporário): se `_links`
   * ausente (uniplus-api#334), gate por `status === 'Rascunho'`.
   */
  protected readonly podePublicar = computed(() => {
    const dto = this.edital();
    if (!dto) return false;
    if (dto._links !== undefined) {
      return Boolean(dto._links.publicar);
    }
    return dto.status === 'Rascunho';
  });

  ngOnInit(): void {
    this.carregar();
  }

  protected abrirConfirmacao(): void {
    this.dialogVisivel.set(true);
  }

  protected confirmarPublicacao(): void {
    if (this.submitting()) {
      return;
    }
    const id = this.id();
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.mensagemSucesso.set(null);

    this.api
      .publicar(id, withIdempotencyKey(idempotencyKey.create()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.submitting.set(false);
        if (result.ok) {
          this.mensagemSucesso.set('Edital publicado com sucesso.');
          // Refetch incondicional — preserva mensagemSucesso, atualiza status.
          // Bypass da guarda `loading` aqui é intencional: o sucesso do
          // publicar exige reload garantido, mesmo se houver outra carga em voo.
          this.executarObter();
          return;
        }
        this.errorMessage.set(this.problemI18n.resolve(result.problem).title);
      });
  }

  private carregar(): void {
    if (this.loading()) {
      return;
    }
    this.executarObter();
  }

  private executarObter(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api
      .obter(this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.loading.set(false);
        if (result.ok) {
          this.edital.set(result.data as EditalComLinks);
          return;
        }
        this.edital.set(null);
        this.errorMessage.set(this.problemI18n.resolve(result.problem).title);
      });
  }
}
