import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import {
  API_MAX_PAGE_SIZE,
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  STATUS_HTTP,
  lookupCompleto,
} from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { FasesCanonicasApi, TipoBancaDto, TiposBancaApi } from '@uniplus/shared-data/configuracao';
import { TiposBancaStore } from './tipos-banca.store';
import {
  comandoDeAtualizacao,
  controleDoCampoDoServidor,
  criarFormularioDeBanca,
  valoresDaBanca,
} from './tipo-banca-form';
type Escrita = 'salvando' | 'removendo';
@Injectable()
export class EdicaoDosTiposBanca {
  private readonly api = inject(TiposBancaApi);
  private readonly fasesApi = inject(FasesCanonicasApi);
  private readonly store = inject(TiposBancaStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fases = lookupCompleto(
    (cursor) => this.fasesApi.listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    this.destroyRef,
  );
  readonly sugestoesFaseTipica = computed(() => this.fases.opcoes().map((fase) => fase.nome));
  readonly form = criarFormularioDeBanca();
  private readonly escrita = signal<Escrita | null>(null);
  readonly gravando = computed(() => this.escrita() !== null);
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  readonly aberto = signal(false);
  readonly erro = signal<string | null>(null);
  readonly confirmando = signal(false);
  private readonly bancaParaRemover = signal<TipoBancaDto | null>(null);
  private readonly resultadoDaRemocao = signal('');
  private readonly bancaEmEdicaoId = signal<string | null>(null);
  private readonly chave = signal(idempotencyKey.create());
  readonly anuncioDaRemocao = computed(() => {
    const banca = this.bancaParaRemover();
    return this.removendo() && banca
      ? `Removendo o tipo de banca ${banca.codigo}.`
      : this.resultadoDaRemocao();
  });
  readonly mensagemDaConfirmacao = computed(() => {
    const banca = this.bancaParaRemover();
    return banca
      ? `Deseja remover o tipo de banca ${banca.codigo}? A remoção impede novos editais de requerer esta banca, mas não altera bancas já congeladas — a cópia por valor permanece íntegra.`
      : 'Deseja remover este tipo de banca?';
  });
  abrirEdicao(banca: TipoBancaDto): void {
    if (this.gravando()) return;
    this.bancaEmEdicaoId.set(banca.id);
    this.form.reset(valoresDaBanca(banca));
    this.erro.set(null);
    this.renovarChave();
    this.fases.recarregar();
    this.aberto.set(true);
  }
  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }
  pedirRemocao(banca: TipoBancaDto): void {
    if (this.gravando()) return;
    this.bancaParaRemover.set(banca);
    this.confirmando.set(true);
  }
  salvar(): void {
    this.erro.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.bancaEmEdicaoId() ?? '';
    this.gravar(
      'salvando',
      this.api.atualizar(id, comandoDeAtualizacao(id, this.form), withIdempotencyKey(this.chave())),
      (result) => this.concluirSalvamento(result),
    );
  }
  removerConfirmado(): void {
    const banca = this.bancaParaRemover();
    if (!banca) return;
    this.gravar('removendo', this.api.remover(banca.id), (result) => {
      if (!result.ok) {
        this.resultadoDaRemocao.set(`Não foi possível remover o tipo de banca ${banca.codigo}.`);
        this.notifications.errorFromProblem(result.problem, {
          title: this.problemI18n.resolve(result.problem).title,
        });
        return;
      }
      this.resultadoDaRemocao.set(`Tipo de banca ${banca.codigo} removido.`);
      this.notifications.success('Tipo de banca removido', banca.codigo);
      this.confirmando.set(false);
      this.bancaParaRemover.set(null);
      this.store.recarregar();
    });
  }
  private gravar<T>(
    tipo: Escrita,
    operacao: Observable<ApiResult<T>>,
    concluir: (result: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) return;
    this.escrita.set(tipo);
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      this.escrita.set(null);
      concluir(result);
    });
  }
  private concluirSalvamento(result: ApiResult<void>): void {
    if (!result.ok) {
      this.aplicarFalha(result.problem);
      return;
    }
    this.notifications.success('Tipo de banca atualizado');
    this.aberto.set(false);
    this.renovarChave();
    this.store.recarregar();
  }
  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
      this.renovarChave();
      this.aplicarErros(problem.errors);
      return;
    }
    if (
      problem.status === STATUS_HTTP.CONFLITO ||
      problem.code === 'uniplus.idempotency.body_mismatch'
    )
      this.renovarChave();
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }
  private aplicarErros(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicou = false;
    for (const erro of errors) {
      const nome = controleDoCampoDoServidor(erro.field);
      if (nome === null) continue;
      const controle = this.form.controls[nome];
      controle.setErrors({ backend: { code: erro.code, message: erro.message } });
      controle.markAsTouched();
      aplicou = true;
    }
    this.erro.set(
      aplicou ? null : 'Não foi possível mapear os erros de validação. Revise os campos.',
    );
  }
  private renovarChave(): void {
    this.chave.set(idempotencyKey.create());
  }
}
