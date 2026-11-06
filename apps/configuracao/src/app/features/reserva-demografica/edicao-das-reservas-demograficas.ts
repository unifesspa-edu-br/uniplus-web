import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
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
  ReferenciaReservaDemograficaDto,
  ReservaDemograficaApi,
} from '@uniplus/shared-data/configuracao';
import { aguardarRecarga } from '../../shared/foco';
import {
  RESERVA_EM_BRANCO,
  ReservaForm,
  ValoresDaReserva,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeReserva,
  valoresDaReserva,
} from './reserva-demografica-form';
import { ReservaDemograficaStore } from './reserva-demografica.store';

type ModoFormulario = 'criar' | 'editar';
type Escrita = 'salvando' | 'removendo';

const CODIGO_CENSO_JA_EXISTE =
  'uniplus.configuracao.referencia_reserva_demografica.censo_ja_existe';

const ROTULO_DA_ESCRITA: Readonly<Record<Escrita, string>> = {
  salvando: 'Salvando...',
  removendo: 'Removendo...',
};

/** A referência que a escrita em curso afeta e o que a linha dela mostra enquanto isso. */
export interface AndamentoDaEscrita {
  readonly id: string;
  readonly rotulo: string;
}

/**
 * Todas as escritas da tela de reserva demográfica: o formulário, o salvamento e a remoção com
 * confirmação. É a única dona do indicador de gravação, então uma escrita impede a outra.
 */
@Injectable()
export class EdicaoDasReservasDemograficas {
  private readonly api = inject(ReservaDemograficaApi);
  private readonly store = inject(ReservaDemograficaStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDeReserva();
  private readonly escrita = signal<Escrita | null>(null);
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  private readonly emAndamento = signal<AndamentoDaEscrita | null>(null);
  /** Inclui a espera pela recarga: a lista só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.escrita() !== null || this.recarga.aguardando());
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  readonly andamento = computed(() => (this.gravando() ? this.emAndamento() : null));

  readonly aberto = signal(false);
  readonly modo = signal<ModoFormulario>('criar');
  readonly erro = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly erroDaRemocao = signal<string | null>(null);
  private readonly idEmEdicao = signal<string | null>(null);
  private readonly referenciaParaRemover = signal<ReferenciaReservaDemograficaDto | null>(null);
  private readonly resultadoDaRemocao = signal('');
  private readonly chave = signal(idempotencyKey.create());

  readonly titulo = computed(() =>
    this.modo() === 'criar' ? 'Novo censo' : 'Editar referência demográfica',
  );
  readonly mensagemDaConfirmacao = computed(() => {
    const referencia = this.referenciaParaRemover();
    return referencia
      ? `Deseja remover a referência demográfica do Censo ${referencia.censoReferencia}? A referência é removida (soft-delete) e mantida na trilha de auditoria. Edições e remoções não afetam processos já publicados — cópias congeladas em quadros de vagas (snapshot) permanecem.`
      : 'Confirma a remoção desta referência demográfica?';
  });
  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const referencia = this.referenciaParaRemover();
    if (referencia === null) return '';
    if (this.removendo()) return `Removendo a referência do Censo ${referencia.censoReferencia}.`;
    const motivo = this.erroDaRemocao();
    return motivo
      ? `Não foi possível remover a referência do Censo ${referencia.censoReferencia}. ${motivo}`
      : '';
  });
  /** Dentro do drawer: o andamento, que só faz sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() => (this.salvando() ? 'Salvando referência.' : ''));
  /** Na página: a remoção concluída, anunciada quando o diálogo já não está aberto para dizê-la. */
  readonly anuncioDaPagina = computed(() => (this.confirmando() ? '' : this.resultadoDaRemocao()));

  abrirCadastro(): void {
    if (this.gravando()) return;
    this.preparar('criar', null, RESERVA_EM_BRANCO);
  }

  abrirEdicao(referencia: ReferenciaReservaDemograficaDto): void {
    if (this.gravando()) return;
    this.preparar('editar', referencia.id, valoresDaReserva(referencia));
  }

  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }

  /** Unicidade de Censo entre as referências ativas carregadas (feedback ao sair do campo). */
  verificarCensoDuplicado(): void {
    const controle = this.form.controls.censoReferencia;
    const censo = controle.value.trim();
    const duplicado =
      censo.length > 0 &&
      this.store
        .referencias()
        .some((ref) => ref.censoReferencia === censo && ref.id !== this.idEmEdicao());
    if (duplicado) {
      controle.setErrors({ duplicado: true });
      controle.markAsTouched();
    } else if (controle.hasError('duplicado')) {
      controle.setErrors(null);
      controle.updateValueAndValidity({ emitEvent: false });
    }
  }

  pedirRemocao(referencia: ReferenciaReservaDemograficaDto): void {
    if (this.gravando()) return;
    this.resultadoDaRemocao.set('');
    this.erroDaRemocao.set(null);
    this.referenciaParaRemover.set(referencia);
    this.confirmando.set(true);
  }

  salvar(): void {
    this.erro.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.idEmEdicao();
    const valores = this.form.getRawValue();
    const chave = withIdempotencyKey(this.chave());
    const operacao: Observable<ApiResult<string | void>> =
      id === null
        ? this.api.criar(comandoDeCriacao(valores), chave)
        : this.api.atualizar(id, comandoDeAtualizacao(id, valores), chave);
    this.gravar('salvando', id, operacao, (result) => this.concluirSalvamento(result));
  }

  removerConfirmado(): void {
    const referencia = this.referenciaParaRemover();
    if (referencia === null) return;
    this.erroDaRemocao.set(null);
    this.gravar('removendo', referencia.id, this.api.remover(referencia.id), (result) =>
      this.concluirRemocao(referencia, result),
    );
  }

  private preparar(modo: ModoFormulario, id: string | null, valores: ValoresDaReserva): void {
    this.modo.set(modo);
    this.idEmEdicao.set(id);
    this.form.controls.censoReferencia.enable();
    this.form.reset(valores);
    if (modo === 'editar') this.form.controls.censoReferencia.disable();
    this.erro.set(null);
    this.renovarChave();
    this.aberto.set(true);
  }

  private gravar<T>(
    tipo: Escrita,
    id: string | null,
    operacao: Observable<ApiResult<T>>,
    concluir: (result: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) return;
    this.escrita.set(tipo);
    this.emAndamento.set(id === null ? null : { id, rotulo: ROTULO_DA_ESCRITA[tipo] });
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      concluir(result);
      this.escrita.set(null);
    });
  }

  private concluirSalvamento(result: ApiResult<string | void>): void {
    if (!result.ok) {
      this.aplicarFalha(result.problem);
      return;
    }
    this.notifications.success(
      this.modo() === 'criar' ? 'Referência criada' : 'Referência atualizada',
    );
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(
    referencia: ReferenciaReservaDemograficaDto,
    result: ApiResult<void>,
  ): void {
    if (!result.ok) {
      this.erroDaRemocao.set(this.problemI18n.resolve(result.problem).title);
      if (result.problem.status >= 500) {
        this.notifications.errorFromProblem(result.problem, {
          title: 'Não foi possível remover a referência',
        });
      }
      return;
    }
    this.resultadoDaRemocao.set(`Referência do Censo ${referencia.censoReferencia} removida.`);
    this.notifications.success('Referência removida', referencia.censoReferencia);
    this.confirmando.set(false);
    this.referenciaParaRemover.set(null);
    this.recarregar();
  }

  private recarregar(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
      this.renovarChave();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    const titulo = this.problemI18n.resolve(problem).title;
    if (problem.code === CODIGO_CENSO_JA_EXISTE) {
      this.renovarChave();
      this.marcarCampo('censoReferencia', problem.code, titulo);
      return;
    }
    if (deveRotacionarIdempotencyKey(problem)) this.renovarChave();
    this.erro.set(titulo);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    for (const recusa of errors) {
      const nome = controleDoCampoDoServidor(recusa.field);
      if (nome === null) continue;
      this.marcarCampo(nome, recusa.code, recusa.message);
      aplicouAlgum = true;
    }
    if (!aplicouAlgum) {
      this.erro.set('Não foi possível mapear os erros de validação. Revise os campos.');
    }
  }

  /** Um campo desabilitado não pode ser corrigido nem fica inválido: a recusa vira mensagem geral. */
  private marcarCampo(nome: keyof ReservaForm, code: string, message: string): void {
    const controle = this.form.controls[nome];
    if (controle.disabled) {
      this.erro.set(message);
      return;
    }
    controle.setErrors({ backend: { code, message } });
    controle.markAsTouched();
  }

  private renovarChave(): void {
    this.chave.set(idempotencyKey.create());
  }
}
