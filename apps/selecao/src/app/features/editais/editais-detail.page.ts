import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  ProblemI18nService,
  idempotencyKey,
  useApiResource,
  withIdempotencyKey,
  withVendorMime,
} from '@uniplus/shared-core';
import {
  EditaisApi,
  EditalDto,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data';
import { ConfirmDialogComponent } from '@uniplus/shared-ui';

/**
 * Container (ADR-0017) da feature Editais — detalhe + ação Publicar.
 *
 * **GET reativo via `useApiResource` (ADR-0018):** o helper envelopa o
 * `httpResource` Angular 21 sobre o `apiResultInterceptor`, exibindo
 * `data()`/`problem()`/`isLoading()` como signals. Quando o input `id` muda,
 * o helper cancela a request anterior automaticamente — substitui o race
 * guard manual do pattern legado.
 *
 * **POST `publicar` continua via `EditaisApi` + `HttpClient`** (guidance
 * Angular oficial: `httpResource` é GET-only — mutações via HttpClient direto).
 * O race guard do publish (id capturado no closure do submit) **fica** porque
 * é mutação one-shot, não fetch reativo.
 *
 * **Gating do botão "Publicar":** baseado em `status === 'Rascunho'` (única
 * transição permitida hoje per `Edital.Publicar()` no domínio backend).
 * **Action links NÃO entram em `_links`** per ADR-0029 do `uniplus-api`
 * (vedação binding §"Esta ADR não decide" — operações de mutação são
 * descobertas via OpenAPI, ADR-0030). O `EditalDto._links` carrega apenas
 * navigation links (`self`, `collection`) — útil para self-identification
 * e back-nav, sem interferir no gating de UI.
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
        @if (edital(); as e) {
          <p class="text-sm text-gray-600">{{ e.numeroEdital }} — {{ e.titulo }}</p>
        }
      </div>
      <a
        routerLink="/editais"
        class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        Voltar para lista
      </a>
    </header>

    @if (errorMessage(); as msg) {
      <div
        class="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
      >
        <span class="font-semibold">{{ msg }}</span>
      </div>
    }

    @if (mensagemSucesso(); as sucesso) {
      <div
        class="mb-4 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        role="status"
      >
        <span class="font-semibold">{{ sucesso }}</span>
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
export class EditaisDetailPage {
  /** Path param do route (`:id`). Bind via `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  private readonly api = inject(EditaisApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /**
   * Resource reativo do GET `/api/editais/{id}`. Re-dispara automaticamente
   * quando `id()` muda; a request anterior é cancelada nativamente pelo
   * `httpResource` (race-cancellation — substitui o guard manual do pattern
   * legado). Vendor MIME `edital v1` declarado no `HttpContext`
   * (ADR-0028 backend, ADR-0016 cliente).
   */
  private readonly editalResource = useApiResource<EditalDto>(() => ({
    url: `${this.basePath}/api/editais/${encodeURIComponent(this.id())}`,
    context: withVendorMime('edital', 1),
  }));

  readonly edital = this.editalResource.data;
  readonly loading = this.editalResource.isLoading;

  /**
   * Mensagem de erro consolidada — combina o `problem` da request GET
   * (cancelado/limpo automaticamente quando `id` muda) com o erro do POST
   * `publicar` (signal local, resetado via `effect` em mudança de `id`) e
   * com o canal de erro do `httpResource` para o caso raro em que um
   * interceptor não-HTTP lança fora do contrato `ApiResult` (ex.: erro
   * síncrono em interceptor de auth/logging) — sem este fallback, o
   * spinner desapareceria sem mensagem ao usuário.
   */
  private readonly publishErrorMessage = signal<string | null>(null);
  readonly errorMessage = computed<string | null>(() => {
    const httpProblem = this.editalResource.problem();
    if (httpProblem) {
      return this.problemI18n.resolve(httpProblem).title;
    }
    if (this.editalResource.error()) {
      return 'Erro inesperado ao carregar edital.';
    }
    return this.publishErrorMessage();
  });

  readonly submitting = signal<boolean>(false);
  readonly mensagemSucesso = signal<string | null>(null);
  readonly dialogVisivel = signal<boolean>(false);

  /**
   * Gating do botão "Publicar" — `status === 'Rascunho'` é a única transição
   * permitida hoje (per `Edital.Publicar()` no domínio backend). Action links
   * (`publicar`) são vedados em `_links` por ADR-0029 (operações de mutação
   * descobertas via OpenAPI, ADR-0030); por isso o gate vem do `status`.
   */
  protected readonly podePublicar = computed(() => {
    const dto = this.edital();
    return dto?.status === 'Rascunho';
  });

  constructor() {
    // Reset de signals locais (publish flow) quando o input `id` muda. O
    // estado do GET (`edital`/`loading`/`problem`) já é resetado nativamente
    // pelo httpResource ao trocar dependências reativas — só precisamos
    // limpar o que vive fora do Resource.
    effect(() => {
      this.id();
      untracked(() => {
        this.publishErrorMessage.set(null);
        this.mensagemSucesso.set(null);
      });
    });
  }

  protected abrirConfirmacao(): void {
    this.dialogVisivel.set(true);
  }

  protected confirmarPublicacao(): void {
    if (this.submitting()) {
      return;
    }
    const idDoSubmit = this.id();
    this.submitting.set(true);
    this.publishErrorMessage.set(null);
    this.mensagemSucesso.set(null);

    this.api
      .publicar(idDoSubmit, withIdempotencyKey(idempotencyKey.create()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.submitting.set(false);
        // Race guard: se usuário navegou para outro `:id` durante o publicar,
        // descarta o feedback. Setar `mensagemSucesso` no edital errado
        // confundiria o usuário; o backend já registrou a publicação do
        // recurso original (Idempotency-Key garante).
        if (this.id() !== idDoSubmit) {
          return;
        }
        if (result.ok) {
          this.mensagemSucesso.set('Edital publicado com sucesso.');
          // Refetch via httpResource — cancela qualquer request em voo e
          // dispara nova com a mesma URL atual.
          this.editalResource.reload();
          return;
        }
        this.publishErrorMessage.set(this.problemI18n.resolve(result.problem).title);
      });
  }
}
