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
  NotificationService,
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
import {
  AlertComponent,
  CardComponent,
  ConfirmDialogComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui';

/**
 * Container (ADR-0017) da feature Editais — detalhe + ação Publicar.
 *
 * **GET reativo via `useApiResource` (ADR-0018):** o helper envelopa o
 * `httpResource` Angular 21 sobre o `apiResultInterceptor`, exibindo
 * `data()`/`problem()`/`isLoading()` como signals. Quando o input `editalId` muda,
 * o helper cancela a request anterior automaticamente, sem guard manual
 * imperativo no componente.
 *
 * **POST `publicar` continua via `EditaisApi` + `HttpClient`** (guidance
 * Angular oficial: `httpResource` é GET-only — mutações via HttpClient direto).
 * O race guard do publish (editalId capturado no closure do submit) **fica** porque
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
  imports: [
    AlertComponent,
    CardComponent,
    ConfirmDialogComponent,
    PageHeaderComponent,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <ui-page-header
      heading="Detalhes do edital"
      [description]="editalDescription()"
    >
      <a uiPageActions routerLink="/editais" class="btn btn--tertiary">
        Voltar para lista
      </a>
    </ui-page-header>

    @if (errorMessage(); as msg) {
      <ui-alert variant="danger" heading="Não foi possível carregar a operação">
        {{ msg }}
      </ui-alert>
    }

    @if (mensagemSucesso(); as sucesso) {
      <ui-alert variant="success" heading="Operação concluída">
        {{ sucesso }}
      </ui-alert>
    }

    @if (loading() && !edital()) {
      <p class="ui-loading-line" aria-live="polite">
        <ui-spinner spinnerSize="sm" />
        Carregando edital…
      </p>
    }

    @if (edital(); as e) {
      <ui-card>
        <dl class="ui-detail-list">
          <dt>Número</dt>
          <dd>{{ e.numeroEdital }}</dd>

          <dt>Título</dt>
          <dd>{{ e.titulo }}</dd>

          <dt>Tipo de processo</dt>
          <dd>{{ e.tipoProcesso }}</dd>

          <dt>Status</dt>
          <dd data-testid="edital-status">{{ e.status }}</dd>

          <dt>Máx. opções de curso</dt>
          <dd>{{ e.maximoOpcoesCurso }}</dd>

          <dt>Bônus regional</dt>
          <dd>{{ e.bonusRegionalHabilitado ? 'Sim' : 'Não' }}</dd>

          <dt>Criado em</dt>
          <dd>{{ e.criadoEm }}</dd>
        </dl>
      </ui-card>

      @if (podePublicar()) {
        <div class="ui-detail-actions">
          <button
            type="button"
            data-testid="btn-publicar"
            [disabled]="submitting()"
            class="btn"
            [attr.data-loading]="submitting() ? 'true' : null"
            (click)="abrirConfirmacao()"
          >
            @if (submitting()) {
              <span class="spinner spinner--sm" aria-hidden="true"></span>
            }
            {{ submitting() ? 'Publicando…' : 'Publicar' }}
          </button>
        </div>
      }
    }

    <ui-confirm-dialog
      [(visible)]="dialogVisivel"
      heading="Confirmar publicação"
      message="Após a publicação, o edital fica visível para candidatos e não pode mais ser editado. Deseja prosseguir?"
      confirmLabel="Publicar"
      cancelLabel="Cancelar"
      (confirmed)="confirmarPublicacao()"
    />
  `,
  styles: `
    .ui-loading-line {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--text-secondary);
      margin-top: var(--space-5);
    }

    .ui-detail-list {
      display: grid;
      grid-template-columns: minmax(8rem, 12rem) 1fr;
      gap: var(--space-3) var(--space-5);
      margin: 0;
      max-width: var(--content-narrow);
    }

    .ui-detail-list dt {
      color: var(--text-muted);
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
    }

    .ui-detail-list dd {
      color: var(--text-primary);
      font-size: var(--text-sm);
      margin: 0;
    }

    .ui-detail-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: var(--space-4);
    }

    @media (max-width: 520px) {
      .ui-detail-list {
        grid-template-columns: 1fr;
        gap: var(--space-1);
      }

      .ui-detail-list dd {
        margin-bottom: var(--space-3);
      }
    }
  `,
})
export class EditaisDetailPage {
  /** Path param do route (`:editalId`). Bind via `withComponentInputBinding()`. */
  readonly editalId = input.required<string>();

  private readonly api = inject(EditaisApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /**
   * Resource reativo do GET `/api/editais/{editalId}`. Re-dispara automaticamente
   * quando `editalId()` muda; a request anterior é cancelada nativamente pelo
   * `httpResource` (race-cancellation). Vendor MIME `edital v1` declarado no `HttpContext`
   * (ADR-0028 backend, ADR-0016 cliente).
   */
  private readonly editalResource = useApiResource<EditalDto>(() => ({
    url: `${this.basePath}/api/editais/${encodeURIComponent(this.editalId())}`,
    context: withVendorMime('edital', 1),
  }));

  readonly edital = this.editalResource.data;
  readonly loading = this.editalResource.isLoading;

  /**
   * Mensagem de erro consolidada — combina o `problem` da request GET
   * (cancelado/limpo automaticamente quando `editalId` muda) com o erro do POST
   * `publicar` (signal local, resetado via `effect` em mudança de `editalId`) e
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

  protected readonly editalDescription = computed(() => {
    const dto = this.edital();
    return dto ? `${dto.numeroEdital} - ${dto.titulo}` : 'Consulta de edital do processo seletivo.';
  });

  constructor() {
    // Reset de signals locais (publish flow) quando o input `editalId` muda. O
    // estado do GET (`edital`/`loading`/`problem`) já é resetado nativamente
    // pelo httpResource ao trocar dependências reativas — só precisamos
    // limpar o que vive fora do Resource.
    effect(() => {
      this.editalId();
      untracked(() => {
        this.publishErrorMessage.set(null);
        this.mensagemSucesso.set(null);
      });
    });

    // 5xx no GET → toast persistente em paralelo ao banner local. Disparado
    // só quando o `problem` muda (mesmo problem repetido em re-renders não
    // duplica toast). 4xx mantém apenas o banner inline.
    effect(() => {
      const problem = this.editalResource.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => {
          this.notifications.errorFromProblem(problem, { title: titulo });
        });
      }
    });
  }

  protected abrirConfirmacao(): void {
    this.dialogVisivel.set(true);
  }

  protected confirmarPublicacao(): void {
    if (this.submitting()) {
      return;
    }
    const idDoSubmit = this.editalId();
    this.submitting.set(true);
    this.publishErrorMessage.set(null);
    this.mensagemSucesso.set(null);

    this.api
      .publicar(idDoSubmit, withIdempotencyKey(idempotencyKey.create()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.submitting.set(false);
        // Race guard: se usuário navegou para outro `:editalId` durante o publicar,
        // descarta o feedback. Setar `mensagemSucesso` no edital errado
        // confundiria o usuário; o backend já registrou a publicação do
        // recurso original (Idempotency-Key garante).
        if (this.editalId() !== idDoSubmit) {
          return;
        }
        if (result.ok) {
          this.mensagemSucesso.set('Edital publicado com sucesso.');
          // Refetch via httpResource — cancela qualquer request em voo e
          // dispara nova com a mesma URL atual.
          this.editalResource.reload();
          return;
        }
        const mensagem = this.problemI18n.resolve(result.problem).title;
        this.publishErrorMessage.set(mensagem);
        // 5xx no POST publicar também vira toast persistente — usuário
        // copia o `traceId` para reportar incidente sem sair da página.
        if (result.problem.status >= 500) {
          this.notifications.errorFromProblem(result.problem, { title: mensagem });
        }
      });
  }
}
