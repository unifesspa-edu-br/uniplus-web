import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  LocaisOfertaApi,
  LocalOfertaDto,
  TIPOS_LOCAL_OFERTA,
} from '@uniplus/shared-data/configuracao';
import {
  ehErroDeEndereco,
  limparPendenciaDaCidadeAoPreencher,
  pendenciaDaCidade,
} from '../../shared/endereco';
import {
  LOCAL_EM_BRANCO,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeLocalOferta,
  valoresDoLocal,
} from './local-oferta-form';
import { LocaisOfertaStore } from './locais-oferta.store';

type ModoFormulario = 'criar' | 'editar';

@Injectable()
export class EdicaoDosLocaisOferta {
  private readonly api = inject(LocaisOfertaApi);
  private readonly leitura = inject(LocaisOfertaStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recarregando = signal(false);
  private viuCarregamento = false;
  private readonly escrita = signal<'salvando' | 'removendo' | null>(null);
  readonly gravando = computed(() => this.escrita() !== null || this.recarregando());
  readonly saving = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  readonly localAfetadoId = signal<string | null>(null);
  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const local = this.localParaRemover();
    if (local === null) return '';
    if (this.removendo()) return 'Removendo o local de oferta.';
    const motivo = this.erroDaRemocao();
    return motivo ? `Não foi possível remover o local de oferta. ${motivo}` : '';
  });
  /** Na página: a remoção concluída, anunciada quando o diálogo já não está aberto para dizê-lo. */
  readonly anuncioDaPagina = computed(() => (this.confirmOpen() ? '' : this.resultadoDaRemocao()));
  private readonly resultadoDaRemocao = signal('');
  readonly andamento = computed(() =>
    this.removendo()
      ? 'Removendo…'
      : this.saving()
        ? 'Salvando…'
        : this.recarregando()
          ? 'Atualizando…'
          : '',
  );
  readonly formOpen = signal(false);
  readonly confirmOpen = signal(false);
  readonly formError = signal<string | null>(null);
  readonly enderecoErro = signal<string | null>(null);
  readonly modo = signal<ModoFormulario>('criar');
  readonly localEmEdicaoId = signal<string | null>(null);
  readonly erroDaRemocao = signal<string | null>(null);
  readonly localParaRemover = signal<LocalOfertaDto | null>(null);
  readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo local de oferta' : 'Editar local de oferta',
  );

  readonly confirmMessage = computed(() => {
    const local = this.localParaRemover();
    return local
      ? `Deseja remover este local (${TIPOS_LOCAL_OFERTA.find((tipo) => tipo.value === local.tipo)?.label ?? local.tipo})? A remoção é lógica (soft-delete).`
      : 'Deseja remover este local de oferta?';
  });

  readonly form = criarFormularioDeLocalOferta();

  constructor() {
    limparPendenciaDaCidadeAoPreencher(
      this.form.controls.endereco,
      this.enderecoErro,
      this.destroyRef,
    );
    effect(() => {
      if (!this.recarregando()) return;
      if (this.leitura.carregando()) this.viuCarregamento = true;
      else if (this.viuCarregamento) {
        this.viuCarregamento = false;
        this.recarregando.set(false);
        this.localAfetadoId.set(null);
      }
    });
  }

  fechar(): void {
    if (!this.gravando()) this.formOpen.set(false);
  }

  private recarregar(): void {
    this.recarregando.set(true);
    this.leitura.recarregar();
  }

  abrirCadastro(): void {
    if (this.gravando()) return;
    this.modo.set('criar');
    this.localEmEdicaoId.set(null);
    this.form.reset(LOCAL_EM_BRANCO);
    this.formError.set(null);
    this.enderecoErro.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  abrirEdicao(local: LocalOfertaDto): void {
    if (this.gravando()) return;
    this.modo.set('editar');
    this.localEmEdicaoId.set(local.id);
    this.form.reset(valoresDoLocal(local));
    this.formError.set(null);
    this.enderecoErro.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  pedirRemocao(local: LocalOfertaDto): void {
    if (this.gravando()) return;
    this.resultadoDaRemocao.set('');
    this.erroDaRemocao.set(null);
    this.localParaRemover.set(local);
    this.confirmOpen.set(true);
  }

  removerConfirmado(): void {
    const local = this.localParaRemover();
    if (local === null || this.gravando()) {
      return;
    }
    this.erroDaRemocao.set(null);
    this.localAfetadoId.set(local.id);
    this.escrita.set('removendo');
    this.api
      .remover(local.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.escrita.set(null);
        this.concluirRemocao(result);
      });
  }

  private concluirRemocao(result: ApiResult<void>): void {
    if (!result.ok) {
      const titulo = this.problemI18n.resolve(result.problem).title;
      this.localAfetadoId.set(null);
      this.erroDaRemocao.set(titulo);
      this.notifications.errorFromProblem(result.problem, { title: titulo });
      return;
    }
    this.resultadoDaRemocao.set('Local de oferta removido.');
    this.notifications.success('Local de oferta removido');
    this.confirmOpen.set(false);
    this.localParaRemover.set(null);
    this.recarregar();
  }

  salvar(): void {
    if (this.gravando()) {
      return;
    }
    this.formError.set(null);
    this.enderecoErro.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.enderecoErro.set(pendenciaDaCidade(this.form.controls.endereco, 'o local'));
      return;
    }
    this.localAfetadoId.set(this.localEmEdicaoId());
    this.escrita.set('salvando');
    this.formError.set(null);

    if (this.modo() === 'criar') {
      this.api
        .criar(
          comandoDeCriacao(this.form.getRawValue()),
          withIdempotencyKey(this.idempotencyKeyAtual()),
        )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => this.handleSalvarResult(result));
      return;
    }

    this.atualizar();
  }

  private atualizar(): void {
    this.api
      .atualizar(
        this.localEmEdicaoId() ?? '',
        comandoDeAtualizacao(this.localEmEdicaoId() ?? '', this.form.getRawValue()),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.escrita.set(null);
    if (result.ok) {
      this.notifications.success(
        this.modo() === 'criar' ? 'Local de oferta criado' : 'Local de oferta atualizado',
      );
      this.formOpen.set(false);
      this.enderecoErro.set(null);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      this.recarregar();
      return;
    }
    this.localAfetadoId.set(null);
    this.aplicarFalha(result.problem);
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (
      problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO &&
      problem.errors &&
      problem.errors.length > 0
    ) {
      this.renovarIdempotencyKey();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    if (ehErroDeEndereco(problem.code)) {
      this.renovarIdempotencyKey();
      this.enderecoErro.set(this.problemI18n.resolve(problem).title);
      this.formError.set(null);
      return;
    }
    if (deveRotacionarIdempotencyKey(problem)) this.renovarIdempotencyKey();
    this.formError.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  private renovarIdempotencyKey(): void {
    this.idempotencyKeyAtual.set(idempotencyKey.create());
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    let erroEndereco: string | null = null;
    for (const erro of errors) {
      if (ehErroDeEndereco(erro.field) || ehErroDeEndereco(erro.code)) {
        erroEndereco ??= erro.message;
        aplicouAlgum = true;
        continue;
      }
      const controlName = controleDoCampoDoServidor(erro.field);
      if (controlName === null) continue;
      const control = this.form.controls[controlName];
      control.setErrors({ backend: { code: erro.code, message: erro.message } });
      control.markAsTouched();
      aplicouAlgum = true;
    }

    this.enderecoErro.set(erroEndereco);

    if (aplicouAlgum) {
      this.formError.set(null);
      return;
    }
    this.formError.set('Não foi possível mapear os erros de validação. Revise os campos.');
  }
}
