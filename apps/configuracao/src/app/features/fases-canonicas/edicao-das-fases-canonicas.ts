import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import { FaseCanonicaDto, FasesCanonicasApi } from '@uniplus/shared-data/configuracao';
import { rotuloDaUnidade } from '@uniplus/shared-data/organizacao';
import {
  CODIGOS_FASE_COM_COMPLEMENTACAO,
  CODIGO_FASE_AVALIACAO,
  CODIGO_FASE_SOLICITACAO_ISENCAO,
  comandoDeAtualizacao,
  controleDoCampoDoServidor,
  criarFormularioDeFase,
  derivarMarcaDeIsencao,
  valoresDaFase,
} from './fase-canonica-form';
import { aguardarRecarga } from '../../shared/foco';
import { FasesCanonicasStore } from './fases-canonicas.store';

type Escrita = 'salvando' | 'removendo';

/** A fase que a escrita em curso afeta e o que a linha dela mostra enquanto isso. */
export interface AndamentoDaEscrita {
  readonly id: string;
  readonly rotulo: string;
}

const ROTULO_DA_ESCRITA: Record<Escrita, string> = {
  salvando: 'Salvando...',
  removendo: 'Removendo...',
};

/**
 * Todas as escritas da tela de fases canônicas: o formulário, o salvamento e a remoção com
 * confirmação. É a única dona do indicador de gravação, então uma escrita impede a outra.
 */
@Injectable()
export class EdicaoDasFasesCanonicas {
  private readonly api = inject(FasesCanonicasApi);
  private readonly store = inject(FasesCanonicasStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDeFase();
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
  readonly erro = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly erroRemocao = signal<string | null>(null);
  private readonly faseEmEdicaoId = signal<string | null>(null);
  private readonly faseParaRemover = signal<FaseCanonicaDto | null>(null);
  private readonly recusaDoSalvamento = signal('');
  private readonly resultadoDoSalvamento = signal('');
  private readonly resultadoDaRemocao = signal('');
  private readonly chave = signal(idempotencyKey.create());

  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const fase = this.faseParaRemover();
    if (!fase) return '';
    if (this.removendo()) return `Removendo a fase ${fase.codigo}.`;
    const motivo = this.erroRemocao();
    return motivo ? `Não foi possível remover a fase ${fase.codigo}. ${motivo}` : '';
  });
  /** Dentro do drawer: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando fase canônica.' : this.recusaDoSalvamento(),
  );
  /** Na página: o desfecho, anunciado quando nenhuma sobreposição está aberta para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmando() || this.aberto()
      ? ''
      : this.resultadoDaRemocao() || this.resultadoDoSalvamento(),
  );
  readonly mensagemDaConfirmacao = computed(() => {
    const fase = this.faseParaRemover();
    return fase
      ? `Deseja remover a fase ${fase.codigo}? A remoção impede novos editais de utilizar esta fase, mas não altera o que já foi congelado — a cópia por valor de cada cronograma permanece íntegra (snapshot-copy desacoplado) e não bloqueia esta remoção lógica.`
      : 'Deseja remover esta fase canônica?';
  });

  /**
   * O cadastro e, quando faltar, a unidade já sugerida pela fase em edição, marcada como removida:
   * o campo não esvazia sem aviso, e a API recusa salvar com ela. Sem o cadastro carregado não
   * se afirma que a unidade saiu dele.
   */
  readonly unidadesParaEscolha = computed<
    readonly { id: string; rotulo: string; removida: boolean }[]
  >(() => {
    const cadastro = this.store.unidades
      .opcoes()
      .map((unidade) => ({ id: unidade.id, rotulo: rotuloDaUnidade(unidade), removida: false }));
    const fase = this.store.fases().find((item) => item.id === this.faseEmEdicaoId());
    const sugerida = fase?.unidadeSugerida;
    if (!sugerida || cadastro.some((unidade) => unidade.id === sugerida.origemId)) return cadastro;
    const cadastroCarregado = !this.store.unidades.pendente() && !this.store.unidades.comErro();
    return [
      { id: sugerida.origemId, rotulo: rotuloDaUnidade(sugerida), removida: cadastroCarregado },
      ...cadastro,
    ];
  });

  private readonly codigoAtual = toSignal(this.form.controls.codigo.valueChanges, {
    initialValue: this.form.controls.codigo.value,
  });
  readonly showGrupoAgrupa = computed(() => this.codigoAtual() === CODIGO_FASE_AVALIACAO);
  readonly showGrupoCompl = computed(() =>
    CODIGOS_FASE_COM_COMPLEMENTACAO.includes(this.codigoAtual()),
  );
  readonly ehFaseDeIsencao = computed(() => this.codigoAtual() === CODIGO_FASE_SOLICITACAO_ISENCAO);

  constructor() {
    this.form.controls.codigo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((codigo) => derivarMarcaDeIsencao(this.form, codigo));
  }

  abrirEdicao(fase: FaseCanonicaDto): void {
    if (this.gravando()) return;
    this.limparResultados();
    this.faseEmEdicaoId.set(fase.id);
    this.form.reset(valoresDaFase(fase));
    this.erro.set(null);
    this.recusaDoSalvamento.set('');
    this.renovarChave();
    this.aberto.set(true);
  }

  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }

  pedirRemocao(fase: FaseCanonicaDto): void {
    if (this.gravando()) return;
    this.limparResultados();
    this.erroRemocao.set(null);
    this.faseParaRemover.set(fase);
    this.confirmando.set(true);
  }

  salvar(): void {
    this.erro.set(null);
    this.recusaDoSalvamento.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.faseEmEdicaoId() ?? '';
    this.gravar(
      'salvando',
      id,
      this.api.atualizar(id, comandoDeAtualizacao(id, this.form), withIdempotencyKey(this.chave())),
      (result) => this.concluirSalvamento(result),
    );
  }

  removerConfirmado(): void {
    const fase = this.faseParaRemover();
    if (!fase) return;
    this.erroRemocao.set(null);
    this.gravar('removendo', fase.id, this.api.remover(fase.id), (result) =>
      this.concluirRemocao(fase, result),
    );
  }

  private gravar<T>(
    tipo: Escrita,
    faseId: string,
    operacao: Observable<ApiResult<T>>,
    concluir: (result: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) return;
    this.escrita.set(tipo);
    this.emAndamento.set({ id: faseId, rotulo: ROTULO_DA_ESCRITA[tipo] });
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (!result.ok) this.emAndamento.set(null);
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
    this.resultadoDoSalvamento.set('Fase canônica atualizada.');
    this.notifications.success('Fase canônica atualizada');
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(fase: FaseCanonicaDto, result: ApiResult<void>): void {
    if (!result.ok) {
      const titulo = this.problemI18n.resolve(result.problem).title;
      this.erroRemocao.set(titulo);
      if (result.problem.status >= 500) {
        this.notifications.errorFromProblem(result.problem, { title: titulo });
      }
      return;
    }
    this.resultadoDaRemocao.set(`Fase ${fase.codigo} removida.`);
    this.notifications.success('Fase canônica removida', fase.codigo);
    this.confirmando.set(false);
    this.faseParaRemover.set(null);
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
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    if (deveRotacionarIdempotencyKey(problem)) this.renovarChave();
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    for (const erro of errors) {
      const nome = controleDoCampoDoServidor(erro.field);
      if (nome === null) continue;
      const controle = this.form.controls[nome];
      controle.setErrors({ backend: { code: erro.code, message: erro.message } });
      controle.markAsTouched();
      aplicouAlgum = true;
    }
    this.erro.set(
      aplicouAlgum ? null : 'Não foi possível mapear os erros de validação. Revise os campos.',
    );
  }

  private renovarChave(): void {
    this.chave.set(idempotencyKey.create());
  }
}
