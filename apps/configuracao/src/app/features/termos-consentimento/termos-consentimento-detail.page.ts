import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CriarTermoConsentimentoCommand,
  EditarRascunhoTermoConsentimentoCommand,
  FORMAS_ACEITE,
  TermoConsentimentoDto,
  TermosConsentimentoApi,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  ConfirmDialogComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

const NOME_MAX = 200;
const TEXTO_MAX = 20000;
const BASE_LEGAL_MAX = 500;
const FORMA_ACEITE_DEFAULT = 'A_DEFINIR';

type AcaoTermo = 'rascunho' | 'revisar' | 'promover' | 'remover';

interface CriarForm {
  nome: FormControl<string>;
  texto: FormControl<string>;
  baseLegal: FormControl<string>;
  formaAceite: FormControl<string>;
}

interface RascunhoForm {
  texto: FormControl<string>;
  baseLegal: FormControl<string>;
  formaAceite: FormControl<string>;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Formata um timestamp ISO em data e hora curtas, pt-BR. Sem convenção prévia no projeto para datetime (só há um helper para datas puras em `unidades.page.ts`). */
function formatarDataHora(value: string): string {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function ultimaChaveDoCaminho(field: string): string {
  const normalizado =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  return normalizado.charAt(0).toLocaleLowerCase('pt-BR') + normalizado.slice(1);
}

@Component({
  selector: 'cfg-termos-consentimento-detail-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    ConfirmDialogComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header page-header--form">
      <a class="btn btn--tertiary btn--sm btn--rect cfg-voltar" routerLink="/termos-consentimento">
        <i class="pi pi-chevron-left" aria-hidden="true"></i>
        Voltar à lista
      </a>
      <div class="page-header__content">
        <h1 #tituloPagina class="page-header__title" tabindex="-1">{{ titulo() }}</h1>
        <p class="page-header__desc">
          O texto e a base legal do rascunho continuam editáveis mesmo depois de promovido — editar
          de novo é o início da próxima versão. Quem revisou ou promoveu não é exibido aqui (a
          leitura é anônima); só a data.
        </p>
      </div>
    </div>

    @if (carregando()) {
      <div class="cfg-form__loading" role="status">
        <ui-spinner size="md" /> Carregando termo...
      </div>
    } @else {
      @if (erroCarregar()) {
        <ui-alert variant="danger" heading="Não foi possível carregar o termo">
          {{ erroCarregar() }}
        </ui-alert>
      }

      @if (acaoErro()) {
        <ui-alert variant="danger" heading="Não foi possível concluir a ação">
          {{ acaoErro() }}
          <div class="cfg-termo-consentimento__retry">
            <button type="button" class="btn btn--secondary btn--sm" (click)="recarregarTermo()">
              Recarregar dados
            </button>
          </div>
        </ui-alert>
      }

      @if (!modoEdicao()) {
        @if (formError()) {
          <ui-alert variant="danger" heading="Não foi possível criar o termo">{{
            formError()
          }}</ui-alert>
        }

        <form [formGroup]="criarForm" (ngSubmit)="criar()" novalidate class="cfg-form">
          <section aria-labelledby="cfg-termo-novo" class="form-section">
            <h2 id="cfg-termo-novo" class="form-section__title">Novo termo</h2>
            <div class="form-grid">
              <label
                class="field field--full"
                [class.is-error]="erroDoCampo(criarForm.controls.nome)"
              >
                <span class="field__label is-required">Nome</span>
                <input
                  class="input"
                  type="text"
                  formControlName="nome"
                  [attr.aria-invalid]="erroDoCampo(criarForm.controls.nome) ? 'true' : null"
                />
                @if (erroDoCampo(criarForm.controls.nome)) {
                  <span class="field__error">{{ erroDoCampo(criarForm.controls.nome) }}</span>
                }
              </label>

              <label
                class="field field--full"
                [class.is-error]="erroDoCampo(criarForm.controls.texto)"
              >
                <span class="field__label">Texto do rascunho</span>
                <textarea class="textarea" rows="6" formControlName="texto"></textarea>
                <span class="field__hint">Até {{ textoMax }} caracteres. Pode nascer vazio.</span>
                @if (erroDoCampo(criarForm.controls.texto)) {
                  <span class="field__error">{{ erroDoCampo(criarForm.controls.texto) }}</span>
                }
              </label>

              <label class="field" [class.is-error]="erroDoCampo(criarForm.controls.baseLegal)">
                <span class="field__label">Base legal do rascunho</span>
                <input class="input" type="text" formControlName="baseLegal" />
                @if (erroDoCampo(criarForm.controls.baseLegal)) {
                  <span class="field__error">{{ erroDoCampo(criarForm.controls.baseLegal) }}</span>
                }
              </label>

              <label class="field">
                <span class="field__label">Forma de aceite do rascunho</span>
                <select class="select" formControlName="formaAceite">
                  @for (opcao of formasAceite; track opcao.value) {
                    <option [value]="opcao.value">{{ opcao.label }}</option>
                  }
                </select>
                <span
                  class="field__hint"
                  title="A recusa por forma não resolvida é regra de publicação do processo, não deste cadastro."
                >
                  &quot;A definir&quot; é um valor legítimo até a promoção final do processo.
                </span>
              </label>
            </div>
          </section>

          <div class="cfg-form-footer">
            <button type="submit" class="btn btn--primary" [disabled]="criando()">
              @if (criando()) {
                <ui-spinner size="sm" />
              }
              {{ criando() ? 'Criando...' : 'Criar termo' }}
            </button>
          </div>
        </form>
      } @else {
        <section aria-labelledby="cfg-termo-rascunho" class="form-section">
          <h2 id="cfg-termo-rascunho" class="form-section__title">Rascunho corrente</h2>

          <ui-alert [variant]="termo()?.revisado ? 'success' : 'warning'" [heading]="statusLabel()">
            {{
              termo()?.revisado
                ? 'A revisão vale para o conteúdo exato promovido a seguir — editar o rascunho de novo reverte automaticamente para "Em elaboração".'
                : 'Preencha texto e base legal e marque como revisado antes de promover uma versão.'
            }}
          </ui-alert>

          <form
            [formGroup]="rascunhoForm"
            (ngSubmit)="salvarRascunho()"
            novalidate
            class="cfg-form"
          >
            <div class="form-grid">
              <label
                class="field field--full"
                [class.is-error]="erroDoCampo(rascunhoForm.controls.texto)"
              >
                <span class="field__label">Texto</span>
                <textarea class="textarea" rows="8" formControlName="texto"></textarea>
                <span class="field__hint">Até {{ textoMax }} caracteres.</span>
                @if (erroDoCampo(rascunhoForm.controls.texto)) {
                  <span class="field__error">{{ erroDoCampo(rascunhoForm.controls.texto) }}</span>
                }
              </label>

              <label class="field" [class.is-error]="erroDoCampo(rascunhoForm.controls.baseLegal)">
                <span class="field__label">Base legal</span>
                <input class="input" type="text" formControlName="baseLegal" />
                @if (erroDoCampo(rascunhoForm.controls.baseLegal)) {
                  <span class="field__error">{{
                    erroDoCampo(rascunhoForm.controls.baseLegal)
                  }}</span>
                }
              </label>

              <label class="field">
                <span class="field__label">Forma de aceite</span>
                <select class="select" formControlName="formaAceite">
                  @for (opcao of formasAceite; track opcao.value) {
                    <option [value]="opcao.value">{{ opcao.label }}</option>
                  }
                </select>
                <span
                  class="field__hint"
                  title="A recusa por forma não resolvida é regra de publicação do processo, não deste cadastro."
                >
                  &quot;A definir&quot; é válido até a promoção final do processo.
                </span>
              </label>
            </div>

            <div class="cfg-form-footer">
              <button type="submit" class="btn btn--primary" [disabled]="processando()">
                @if (acaoEmAndamento() === 'rascunho') {
                  <ui-spinner size="sm" />
                }
                {{ acaoEmAndamento() === 'rascunho' ? 'Salvando...' : 'Salvar rascunho' }}
              </button>
              <button
                type="button"
                class="btn btn--secondary btn--rect"
                [disabled]="processando() || !podeRevisar()"
                [attr.aria-disabled]="processando() || !podeRevisar() ? 'true' : null"
                [title]="
                  podeRevisar()
                    ? ''
                    : 'Preencha texto e base legal do rascunho salvo antes de marcar como revisado.'
                "
                (click)="marcarRevisado()"
              >
                @if (acaoEmAndamento() === 'revisar') {
                  <ui-spinner size="sm" />
                }
                {{ acaoEmAndamento() === 'revisar' ? 'Marcando...' : 'Marcar como revisado' }}
              </button>
              <button
                type="button"
                class="btn btn--secondary btn--rect"
                [disabled]="processando() || !podePromover()"
                [attr.aria-disabled]="processando() || !podePromover() ? 'true' : null"
                [title]="podePromover() ? '' : 'Marque o rascunho como revisado antes de promover.'"
                (click)="promoverVersao()"
              >
                @if (acaoEmAndamento() === 'promover') {
                  <ui-spinner size="sm" />
                }
                {{ acaoEmAndamento() === 'promover' ? 'Promovendo...' : 'Promover a versão' }}
              </button>
            </div>
            <p class="field__hint">
              "Marcar como revisado" e "Promover a versão" agem sobre o rascunho já salvo no
              servidor — se você editou os campos acima, salve antes.
            </p>
          </form>
        </section>

        <section aria-labelledby="cfg-termo-versoes" class="form-section">
          <h2 id="cfg-termo-versoes" class="form-section__title">Versões promovidas</h2>
          @if ((termo()?.versoes?.length ?? 0) > 0) {
            <div class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Promovida em</th>
                    <th scope="col">Forma de aceite</th>
                    <th scope="col">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  @for (v of termo()?.versoes; track v.id) {
                    <tr>
                      <td data-label="Promovida em">{{ formatarData(v.promovidaEm) }}</td>
                      <td data-label="Forma de aceite">{{ formaAceiteLabel(v.formaAceite) }}</td>
                      <td data-label="Hash">
                        <code [title]="v.hash">{{ hashTruncado(v.hash) }}</code>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="cfg-meta">Nenhuma versão promovida ainda.</p>
          }
        </section>

        <section aria-labelledby="cfg-termo-remocao" class="form-section">
          <h2 id="cfg-termo-remocao" class="form-section__title">Remover termo</h2>
          <button
            type="button"
            class="btn btn--danger btn--rect"
            [disabled]="processando() || !podeRemover()"
            [attr.aria-disabled]="processando() || !podeRemover() ? 'true' : null"
            [title]="
              podeRemover()
                ? ''
                : 'Termo com versão promovida não pode ser removido — edite o rascunho e promova uma nova versão.'
            "
            (click)="pedirRemocao()"
          >
            Remover
          </button>
        </section>

        <ui-confirm-dialog
          [(visible)]="confirmRemoverAberto"
          heading="Remover termo de consentimento"
          [message]="
            'Remover o termo ' + (termo()?.nome ?? '') + '? Essa ação não pode ser desfeita.'
          "
          confirmLabel="Remover"
          confirmVariant="danger"
          (confirmed)="removerConfirmado()"
        />
      }
    }
  `,
})
export class TermosConsentimentoDetailPage {
  private readonly api = inject(TermosConsentimentoApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly formasAceite = FORMAS_ACEITE;
  protected readonly textoMax = TEXTO_MAX;

  private readonly tituloPagina = viewChild<ElementRef<HTMLHeadingElement>>('tituloPagina');

  private readonly id = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  protected readonly modoEdicao = computed(() => this.id() !== null);
  protected readonly termo = signal<TermoConsentimentoDto | null>(null);
  protected readonly titulo = computed(
    () => this.termo()?.nome ?? (this.modoEdicao() ? 'Termo de consentimento' : 'Novo termo'),
  );
  protected readonly statusLabel = computed(() => {
    const t = this.termo();
    if (t === null) return '';
    return t.revisado && t.revisadoEm
      ? `Revisado em ${formatarDataHora(t.revisadoEm)}`
      : 'Em elaboração';
  });

  protected readonly carregando = signal(false);
  protected readonly erroCarregar = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly acaoErro = signal<string | null>(null);
  protected readonly tentouSalvar = signal(false);
  protected readonly criando = signal(false);
  protected readonly acaoEmAndamento = signal<AcaoTermo | null>(null);
  protected readonly processando = computed(() => this.acaoEmAndamento() !== null);
  protected readonly confirmRemoverAberto = signal(false);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  protected readonly podeRevisar = computed(() => {
    const t = this.termo();
    return (
      t !== null &&
      (t.textoRascunho ?? '').trim().length > 0 &&
      (t.baseLegalRascunho ?? '').trim().length > 0
    );
  });
  protected readonly podePromover = computed(() => this.termo()?.revisado === true);
  protected readonly podeRemover = computed(
    () => this.termo() !== null && this.termo()?.versoes.length === 0,
  );

  protected readonly criarForm: FormGroup<CriarForm> = new FormGroup<CriarForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(NOME_MAX)],
    }),
    texto: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(TEXTO_MAX)],
    }),
    baseLegal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(BASE_LEGAL_MAX)],
    }),
    formaAceite: new FormControl(FORMA_ACEITE_DEFAULT, { nonNullable: true }),
  });

  protected readonly rascunhoForm: FormGroup<RascunhoForm> = new FormGroup<RascunhoForm>({
    texto: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(TEXTO_MAX)],
    }),
    baseLegal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(BASE_LEGAL_MAX)],
    }),
    formaAceite: new FormControl(FORMA_ACEITE_DEFAULT, { nonNullable: true }),
  });

  constructor() {
    afterNextRender(() => this.tituloPagina()?.nativeElement.focus());
    if (this.id() !== null) {
      this.carregarTermo(this.id() as string);
    }
  }

  protected formatarData(value: string): string {
    return formatarDataHora(value);
  }

  protected formaAceiteLabel(token: string): string {
    return this.formasAceite.find((o) => o.value === token)?.label ?? token;
  }

  protected hashTruncado(hash: string): string {
    return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
  }

  protected erroDoCampo(control: FormControl<string>): string | null {
    const mostrar = control.touched || control.dirty || this.tentouSalvar();
    if (!mostrar || control.errors === null) {
      return null;
    }
    if (control.errors['backend']) {
      const backend = control.errors['backend'] as { code: string; message: string };
      return backend.message;
    }
    if (control.errors['required']) return 'Campo obrigatório.';
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }

  protected criar(): void {
    if (this.criando()) return;
    this.tentouSalvar.set(true);
    if (this.criarForm.invalid) {
      this.criarForm.markAllAsTouched();
      return;
    }
    this.criando.set(true);
    this.formError.set(null);
    const raw = this.criarForm.getRawValue();
    const command: CriarTermoConsentimentoCommand = {
      nome: raw.nome.trim(),
      textoRascunho: nullIfBlank(raw.texto),
      baseLegalRascunho: nullIfBlank(raw.baseLegal),
      formaAceiteRascunho: raw.formaAceite,
    };
    this.api
      .criar(command, withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.tratarCriacao(result, raw.nome));
  }

  protected salvarRascunho(): void {
    const id = this.id();
    if (id === null || this.processando()) return;
    this.tentouSalvar.set(true);
    if (this.rascunhoForm.invalid) {
      this.rascunhoForm.markAllAsTouched();
      return;
    }
    this.acaoEmAndamento.set('rascunho');
    this.acaoErro.set(null);
    const raw = this.rascunhoForm.getRawValue();
    const command: EditarRascunhoTermoConsentimentoCommand = {
      id,
      textoRascunho: nullIfBlank(raw.texto),
      baseLegalRascunho: nullIfBlank(raw.baseLegal),
      formaAceiteRascunho: raw.formaAceite,
    };
    this.api
      .editarRascunho(id, command, withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.tratarMutacao('rascunho', result, 'Rascunho salvo'));
  }

  protected marcarRevisado(): void {
    const id = this.id();
    if (id === null || this.processando() || !this.podeRevisar()) return;
    this.acaoEmAndamento.set('revisar');
    this.acaoErro.set(null);
    this.api
      .revisar(id, withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.tratarMutacao('revisar', result, 'Termo marcado como revisado'));
  }

  protected promoverVersao(): void {
    const id = this.id();
    if (id === null || this.processando() || !this.podePromover()) return;
    this.acaoEmAndamento.set('promover');
    this.acaoErro.set(null);
    this.api
      .promover(id, withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.tratarMutacao('promover', result, 'Nova versão promovida'));
  }

  protected pedirRemocao(): void {
    if (!this.podeRemover()) return;
    this.confirmRemoverAberto.set(true);
  }

  protected removerConfirmado(): void {
    const id = this.id();
    if (id === null || this.processando() || !this.podeRemover()) return;
    this.acaoEmAndamento.set('remover');
    this.acaoErro.set(null);
    this.api
      .remover(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.acaoEmAndamento.set(null);
        this.confirmRemoverAberto.set(false);
        if (result.ok) {
          this.notifications.success('Termo removido', this.termo()?.nome);
          void this.router.navigate(['/termos-consentimento']);
          return;
        }
        this.aplicarFalhaMutacao(result.problem);
      });
  }

  protected recarregarTermo(): void {
    const id = this.id();
    if (id === null) return;
    this.acaoErro.set(null);
    this.carregarTermo(id);
  }

  private carregarTermo(id: string): void {
    this.carregando.set(true);
    this.api
      .obter(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.carregando.set(false);
        if (!result.ok) {
          this.erroCarregar.set(this.problemI18n.resolve(result.problem).title);
          return;
        }
        this.termo.set(result.data);
        this.rascunhoForm.patchValue(
          {
            texto: result.data.textoRascunho ?? '',
            baseLegal: result.data.baseLegalRascunho ?? '',
            formaAceite: result.data.formaAceiteRascunho,
          },
          { emitEvent: false },
        );
        this.rascunhoForm.markAsPristine();
      });
  }

  /** Só atualiza `termo` (banner/versões) — nunca repatcha o form, para não sobrescrever edições em andamento do usuário. */
  private atualizarTermoSemTocarNoForm(): void {
    const id = this.id();
    if (id === null) return;
    this.api
      .obter(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result.ok) {
          this.termo.set(result.data);
        }
      });
  }

  private tratarCriacao(result: ApiResult<string>, nome: string): void {
    this.criando.set(false);
    if (result.ok) {
      this.notifications.success('Termo criado', nome);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      void this.router.navigate(['/termos-consentimento', result.data]);
      return;
    }
    this.aplicarFalhaCriacao(result.problem);
  }

  private tratarMutacao(acao: AcaoTermo, result: ApiResult<void>, mensagemSucesso: string): void {
    this.acaoEmAndamento.set(null);
    if (result.ok) {
      this.notifications.success(mensagemSucesso);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      if (acao === 'rascunho') {
        this.rascunhoForm.markAsPristine();
      }
      this.atualizarTermoSemTocarNoForm();
      return;
    }
    this.aplicarFalhaMutacao(result.problem);
  }

  private aplicarFalhaCriacao(problem: ProblemDetails): void {
    if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
      this.renovarIdempotencyKey();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    if (problem.status === 409 || problem.code === 'uniplus.idempotency.body_mismatch') {
      this.renovarIdempotencyKey();
    }
    this.formError.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  /**
   * Trata falhas das 4 mutações do detalhe (rascunho, revisar, promover, remover).
   * Não distingue os `code`s específicos do domínio (RevisaoSemTexto,
   * PromocaoSemRevisao, RemocaoBloqueadaComVersaoPromovida,
   * ConflitoDeConcorrencia) — não tenho os slugs exatos confirmados pelo
   * backend, então em vez de arriscar um `problem.code === '...'` errado que
   * silenciosamente cai no caso genérico, uso sempre o título já resolvido
   * pelo `ProblemI18nService`. Se vocês quiserem mensagens distintas por
   * code (e não só por status), me passem os slugs exatos que eu especializo.
   */
  private aplicarFalhaMutacao(problem: ProblemDetails): void {
    if (problem.status === 409 || problem.code === 'uniplus.idempotency.body_mismatch') {
      this.renovarIdempotencyKey();
    }
    this.acaoErro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  private renovarIdempotencyKey(): void {
    this.idempotencyKeyAtual.set(idempotencyKey.create());
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    for (const erro of errors) {
      const control = this.controlDoCampoCriacao(erro.field);
      if (control === null) continue;
      control.setErrors({ backend: { code: erro.code, message: erro.message } });
      control.markAsTouched();
      aplicouAlgum = true;
    }
    this.formError.set(
      aplicouAlgum ? null : 'Não foi possível mapear os erros de validação. Revise os campos.',
    );
  }

  private controlDoCampoCriacao(field: string): FormControl<string> | null {
    switch (ultimaChaveDoCaminho(field)) {
      case 'nome':
        return this.criarForm.controls.nome;
      case 'textoRascunho':
        return this.criarForm.controls.texto;
      case 'baseLegalRascunho':
        return this.criarForm.controls.baseLegal;
      case 'formaAceiteRascunho':
        return this.criarForm.controls.formaAceite;
      default:
        return null;
    }
  }
}
