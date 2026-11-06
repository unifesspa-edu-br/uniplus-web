import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
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
import { CondicaoAtendimentoDto, CondicoesAtendimentoApi } from '@uniplus/shared-data/configuracao';
import {
  CODIGO_RESERVADO,
  CONDICAO_EM_BRANCO,
  CondicaoAtendimentoForm,
  ValoresDaCondicao,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeCondicao,
  valoresDaCondicao,
} from './condicao-atendimento-form';
import { CondicoesAtendimentoStore } from './condicoes-atendimento.store';

type ModoFormulario = 'criar' | 'editar';
type Escrita = 'salvando' | 'removendo';

const CODIGO_JA_EXISTE = 'uniplus.configuracao.condicao_atendimento.codigo_ja_existe';

const ROTULO_DA_ESCRITA: Readonly<Record<Escrita, string>> = {
  salvando: 'Salvando...',
  removendo: 'Removendo...',
};

/** A condição que a escrita em curso afeta e o que a linha dela mostra enquanto isso. */
export interface AndamentoDaEscrita {
  readonly id: string;
  readonly rotulo: string;
}

/**
 * Todas as escritas da tela de condições de atendimento: o formulário, o salvamento e a remoção
 * com confirmação. É a única dona do indicador de gravação, então uma escrita impede a outra.
 */
@Injectable()
export class EdicaoDasCondicoesAtendimento {
  private readonly api = inject(CondicoesAtendimentoApi);
  private readonly store = inject(CondicoesAtendimentoStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDeCondicao();
  private readonly escrita = signal<Escrita | null>(null);
  private readonly aguardandoRecarga = signal(false);
  private readonly emAndamento = signal<AndamentoDaEscrita | null>(null);
  /** Inclui a espera pela recarga: a lista só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.escrita() !== null || this.aguardandoRecarga());
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  readonly andamento = this.emAndamento.asReadonly();

  readonly aberto = signal(false);
  readonly modo = signal<ModoFormulario>('criar');
  readonly erro = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly erroDaRemocao = signal<string | null>(null);
  private readonly condicaoEmEdicaoId = signal<string | null>(null);
  private readonly condicaoParaRemover = signal<CondicaoAtendimentoDto | null>(null);
  private readonly resultadoDaRemocao = signal('');
  private readonly chave = signal(idempotencyKey.create());

  readonly titulo = computed(() =>
    this.modo() === 'criar' ? 'Nova condição de atendimento' : 'Editar condição de atendimento',
  );
  readonly mensagemDaConfirmacao = computed(() => {
    const condicao = this.condicaoParaRemover();
    return condicao
      ? `Você está prestes a remover a condição ${condicao.nome}/${condicao.codigo}. A remoção impede novos editais de utilizá-la, mas não altera ofertas já congeladas — a cópia por valor de cada processo permanece íntegra.`
      : 'Deseja remover esta condição de atendimento?';
  });
  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const condicao = this.condicaoParaRemover();
    if (condicao === null) return '';
    if (this.removendo()) return `Removendo a condição de atendimento ${condicao.nome}.`;
    const motivo = this.erroDaRemocao();
    return motivo
      ? `Não foi possível remover a condição de atendimento ${condicao.nome}. ${motivo}`
      : '';
  });
  /** Dentro do drawer: o andamento, que só faz sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando condição de atendimento.' : '',
  );
  /** Na página: a remoção concluída, anunciada quando o diálogo já não está aberto para dizê-la. */
  readonly anuncioDaPagina = computed(() => (this.confirmando() ? '' : this.resultadoDaRemocao()));

  constructor() {
    this.maiusculasNoCodigo();
    this.liberarAoFimDaRecarga();
  }

  abrirCadastro(): void {
    if (this.gravando()) return;
    this.preparar('criar', null, CONDICAO_EM_BRANCO);
  }

  abrirEdicao(condicao: CondicaoAtendimentoDto): void {
    if (this.gravando()) return;
    this.preparar('editar', condicao.id, valoresDaCondicao(condicao));
  }

  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }

  pedirRemocao(condicao: CondicaoAtendimentoDto): void {
    if (this.gravando()) return;
    this.resultadoDaRemocao.set('');
    this.erroDaRemocao.set(null);
    this.condicaoParaRemover.set(condicao);
    this.confirmando.set(true);
  }

  salvar(): void {
    this.erro.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.condicaoEmEdicaoId();
    const valores = this.form.getRawValue();
    const chave = withIdempotencyKey(this.chave());
    const operacao: Observable<ApiResult<string | void>> =
      id === null
        ? this.api.criar(comandoDeCriacao(valores), chave)
        : this.api.atualizar(id, comandoDeAtualizacao(id, valores), chave);
    this.gravar('salvando', id, operacao, (result) => this.concluirSalvamento(result));
  }

  removerConfirmado(): void {
    const condicao = this.condicaoParaRemover();
    if (condicao === null) return;
    this.erroDaRemocao.set(null);
    this.gravar('removendo', condicao.id, this.api.remover(condicao.id), (result) =>
      this.concluirRemocao(condicao, result),
    );
  }

  private preparar(modo: ModoFormulario, id: string | null, valores: ValoresDaCondicao): void {
    this.modo.set(modo);
    this.condicaoEmEdicaoId.set(id);
    this.form.controls.codigo.enable();
    this.form.reset(valores);
    if (valores.codigo === CODIGO_RESERVADO) this.form.controls.codigo.disable();
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
      if (!result.ok) this.emAndamento.set(null);
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
      this.modo() === 'criar'
        ? 'Condição de atendimento criada'
        : 'Condição de atendimento atualizada',
    );
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(condicao: CondicaoAtendimentoDto, result: ApiResult<void>): void {
    if (!result.ok) {
      const titulo = this.problemI18n.resolve(result.problem).title;
      this.erroDaRemocao.set(titulo);
      this.notifications.errorFromProblem(result.problem, { title: titulo });
      return;
    }
    this.resultadoDaRemocao.set(`Condição de atendimento ${condicao.nome} removida.`);
    this.notifications.success('Condição de atendimento removida');
    this.confirmando.set(false);
    this.condicaoParaRemover.set(null);
    this.recarregar();
  }

  private recarregar(): void {
    this.aguardandoRecarga.set(true);
    this.store.recarregar();
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
      this.renovarChave();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    if (problem.code === CODIGO_JA_EXISTE) {
      this.renovarChave();
      this.marcarCampo('codigo', problem.code, this.problemI18n.resolve(problem).title);
      return;
    }
    if (deveRotacionarIdempotencyKey(problem)) this.renovarChave();
    this.erro.set(this.problemI18n.resolve(problem).title);
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

  private marcarCampo(nome: keyof CondicaoAtendimentoForm, code: string, message: string): void {
    const controle = this.form.controls[nome];
    controle.setErrors({ backend: { code, message } });
    controle.markAsTouched();
  }

  private renovarChave(): void {
    this.chave.set(idempotencyKey.create());
  }

  private maiusculasNoCodigo(): void {
    const codigo = this.form.controls.codigo;
    codigo.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((valor) => {
      codigo.setValue(valor.toUpperCase(), { emitEvent: false, emitModelToViewChange: false });
    });
  }

  private liberarAoFimDaRecarga(): void {
    let iniciou = false;
    effect(() => {
      if (!this.aguardandoRecarga()) {
        iniciou = false;
      } else if (this.store.carregando()) {
        iniciou = true;
      } else if (iniciou) {
        this.aguardandoRecarga.set(false);
        this.emAndamento.set(null);
      }
    });
  }
}
