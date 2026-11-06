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
import { aguardarRecarga } from '../../shared/foco';
import { TiposBancaStore } from './tipos-banca.store';
import {
  comandoDeAtualizacao,
  controleDoCampoDoServidor,
  criarFormularioDeBanca,
  valoresDaBanca,
} from './tipo-banca-form';
type Escrita = 'salvando' | 'removendo';

const CORPO_DIVERGENTE = 'uniplus.idempotency.body_mismatch';

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
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  /** Inclui a espera pela recarga: a lista só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.escrita() !== null || this.recarga.aguardando());
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  readonly aberto = signal(false);
  readonly erro = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly erroRemocao = signal<string | null>(null);
  private readonly bancaParaRemover = signal<TipoBancaDto | null>(null);
  private readonly recusaDoSalvamento = signal('');
  private readonly resultadoDoSalvamento = signal('');
  private readonly resultadoDaRemocao = signal('');
  private readonly bancaEmEdicaoId = signal<string | null>(null);
  private readonly chave = signal(idempotencyKey.create());
  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const banca = this.bancaParaRemover();
    if (!banca) return '';
    if (this.removendo()) return `Removendo o tipo de banca ${banca.codigo}.`;
    const motivo = this.erroRemocao();
    return motivo ? `Não foi possível remover o tipo de banca ${banca.codigo}. ${motivo}` : '';
  });
  /** Dentro do drawer: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando tipo de banca.' : this.recusaDoSalvamento(),
  );
  /** Na página: o desfecho, anunciado quando nenhuma sobreposição está aberta para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmando() || this.aberto()
      ? ''
      : this.resultadoDaRemocao() || this.resultadoDoSalvamento(),
  );
  readonly mensagemDaConfirmacao = computed(() => {
    const banca = this.bancaParaRemover();
    return banca
      ? `Deseja remover o tipo de banca ${banca.codigo}? A remoção impede novos editais de requerer esta banca, mas não altera bancas já congeladas — a cópia por valor permanece íntegra.`
      : 'Deseja remover este tipo de banca?';
  });
  abrirEdicao(banca: TipoBancaDto): void {
    if (this.gravando()) return;
    this.limparResultados();
    this.bancaEmEdicaoId.set(banca.id);
    this.form.reset(valoresDaBanca(banca));
    this.erro.set(null);
    this.recusaDoSalvamento.set('');
    this.renovarChave();
    this.fases.recarregar();
    this.aberto.set(true);
  }
  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }
  pedirRemocao(banca: TipoBancaDto): void {
    if (this.gravando()) return;
    this.limparResultados();
    this.erroRemocao.set(null);
    this.bancaParaRemover.set(banca);
    this.confirmando.set(true);
  }
  salvar(): void {
    this.erro.set(null);
    this.recusaDoSalvamento.set('');
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
    this.erroRemocao.set(null);
    this.gravar('removendo', this.api.remover(banca.id), (result) =>
      this.concluirRemocao(banca, result),
    );
  }

  private gravar<T>(
    tipo: Escrita,
    operacao: Observable<ApiResult<T>>,
    concluir: (result: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) return;
    this.escrita.set(tipo);
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      concluir(result);
      this.escrita.set(null);
    });
  }
  private concluirSalvamento(result: ApiResult<void>): void {
    if (!result.ok) {
      this.aplicarFalha(result.problem);
      this.recusaDoSalvamento.set(this.erro() ? '' : 'Revise os campos indicados.');
      return;
    }
    this.resultadoDoSalvamento.set('Tipo de banca atualizado.');
    this.notifications.success('Tipo de banca atualizado');
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(banca: TipoBancaDto, result: ApiResult<void>): void {
    if (!result.ok) {
      const titulo = this.problemI18n.resolve(result.problem).title;
      this.erroRemocao.set(titulo);
      if (result.problem.status >= 500) {
        this.notifications.errorFromProblem(result.problem, { title: titulo });
      }
      return;
    }
    this.resultadoDaRemocao.set(`Tipo de banca ${banca.codigo} removido.`);
    this.notifications.success('Tipo de banca removido', banca.codigo);
    this.confirmando.set(false);
    this.bancaParaRemover.set(null);
    this.recarregar();
  }

  private recarregar(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }

  private limparResultados(): void {
    this.resultadoDaRemocao.set('');
    this.resultadoDoSalvamento.set('');
  }
  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
      this.renovarChave();
      this.aplicarErros(problem.errors);
      return;
    }
    if (problem.code === CORPO_DIVERGENTE) this.renovarChave();
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
