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
import { TipoProcessoDto, TiposProcessoApi } from '@uniplus/shared-data/configuracao';
import { ligarCodigoDeCadastro } from '../../shared/codigo-de-cadastro';
import { aguardarRecarga } from '../../shared/foco';
import {
  ValoresDoTipoProcesso,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeTipoProcesso,
  valoresDoTipoProcesso,
  valoresEmBrancoDoTipoProcesso,
} from './tipo-processo-form';
import { TiposProcessoStore } from './tipos-processo.store';
import { type AndamentoDaEscrita, ROTULOS_PADRAO_DA_ESCRITA } from '../../shared/escrita';
import {
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
  marcarRecusasDosCampos,
  MENSAGEM_SEM_MAPEAMENTO,
} from '../../shared/formulario';

/** Vendor code do DomainError `TipoProcesso.CodigoJaExiste` (409 Conflict). */
const CODIGO_JA_EXISTE = 'uniplus.configuracao.tipo_processo.codigo_ja_existe';

type Escrita = 'salvando' | 'removendo' | 'reativando';
type ModoFormulario = 'criar' | 'editar';
type Verbo = 'desativar' | 'reativar';

const ROTULO_DA_ESCRITA: Readonly<Record<Escrita, string>> = {
  ...ROTULOS_PADRAO_DA_ESCRITA,
  removendo: 'Desativando...',
  reativando: 'Reativando...',
};

/** O que o diálogo de confirmação anuncia: o andamento e a recusa, que só fazem sentido com ele aberto. */
function anuncioDaConfirmacao(
  tipo: TipoProcessoDto | null,
  emCurso: boolean,
  motivo: string | null,
  verbo: Verbo,
): string {
  if (tipo === null) return '';
  if (emCurso) {
    return `${verbo === 'desativar' ? 'Desativando' : 'Reativando'} o tipo de processo ${tipo.codigo}.`;
  }
  return motivo ? `Não foi possível ${verbo} o tipo de processo ${tipo.codigo}. ${motivo}` : '';
}

/**
 * Todas as escritas da tela de tipos de processo: o formulário, o salvamento, a desativação e a
 * reativação com confirmação. É a única dona do indicador de gravação, então uma escrita impede a
 * outra.
 */
@Injectable()
export class EdicaoDosTiposProcesso {
  private readonly api = inject(TiposProcessoApi);
  private readonly store = inject(TiposProcessoStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDeTipoProcesso();
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
  readonly reativando = computed(() => this.escrita() === 'reativando');
  readonly andamento = computed(() => (this.gravando() ? this.emAndamento() : null));

  readonly aberto = signal(false);
  readonly modo = signal<ModoFormulario>('criar');
  readonly erro = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly erroRemocao = signal<string | null>(null);
  readonly confirmandoReativacao = signal(false);
  readonly erroReativacao = signal<string | null>(null);
  private readonly tipoEmEdicaoId = signal<string | null>(null);
  private readonly tipoParaRemover = signal<TipoProcessoDto | null>(null);
  private readonly tipoParaReativar = signal<TipoProcessoDto | null>(null);
  private readonly recusaDoSalvamento = signal('');
  private readonly resultado = signal('');
  private readonly chave = signal(idempotencyKey.create());
  private readonly chaveDaReativacao = signal(idempotencyKey.create());
  private readonly ligacaoDoCodigo = ligarCodigoDeCadastro(
    this.form.controls,
    () => this.modo() === 'criar',
  );

  readonly tituloDoFormulario = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de processo' : 'Editar tipo de processo',
  );
  readonly mensagemDaConfirmacao = computed(() => {
    const tipo = this.tipoParaRemover();
    return tipo
      ? `Deseja desativar o tipo de processo ${tipo.codigo}? Ele deixa de ser oferecido na criação de novos Processos Seletivos. Processos já criados que o referenciam não são afetados. Um novo cadastro com o mesmo código continua sendo recusado, mas o tipo pode ser reativado depois.`
      : 'Deseja desativar este tipo de processo?';
  });
  readonly mensagemDaReativacao = computed(() => {
    const tipo = this.tipoParaReativar();
    return tipo
      ? `Deseja reativar o tipo de processo ${tipo.codigo}? Ele volta a ser oferecido na criação de novos Processos Seletivos. Processos e versões de configuração já produzidos não são alterados.`
      : 'Deseja reativar este tipo de processo?';
  });
  readonly anuncioDaRemocao = computed(() =>
    anuncioDaConfirmacao(this.tipoParaRemover(), this.removendo(), this.erroRemocao(), 'desativar'),
  );
  readonly anuncioDaReativacao = computed(() =>
    anuncioDaConfirmacao(
      this.tipoParaReativar(),
      this.reativando(),
      this.erroReativacao(),
      'reativar',
    ),
  );
  /** Dentro do drawer: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando tipo de processo.' : this.recusaDoSalvamento(),
  );
  /** Na página: o desfecho, anunciado quando nenhuma sobreposição está aberta para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmando() || this.confirmandoReativacao() || this.aberto() ? '' : this.resultado(),
  );

  abrirCadastro(): void {
    this.abrirFormulario('criar', null, valoresEmBrancoDoTipoProcesso());
  }

  abrirEdicao(tipo: TipoProcessoDto): void {
    this.abrirFormulario('editar', tipo.id, valoresDoTipoProcesso(tipo));
  }

  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }

  pedirRemocao(tipo: TipoProcessoDto): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.erroRemocao.set(null);
    this.tipoParaRemover.set(tipo);
    this.confirmando.set(true);
  }

  pedirReativacao(tipo: TipoProcessoDto): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.erroReativacao.set(null);
    this.tipoParaReativar.set(tipo);
    this.chaveDaReativacao.set(idempotencyKey.create());
    this.confirmandoReativacao.set(true);
  }

  salvar(): void {
    this.erro.set(null);
    this.recusaDoSalvamento.set('');
    descartarRecusasDoServidor(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.tipoEmEdicaoId();
    const modo = this.modo();
    const contexto = withIdempotencyKey(this.chave());
    const operacao: Observable<ApiResult<string | void>> =
      id === null
        ? this.api.criar(comandoDeCriacao(this.form), contexto)
        : this.api.atualizar(id, comandoDeAtualizacao(id, this.form), contexto);
    this.gravar('salvando', id, operacao, (result) => this.concluirSalvamento(result, modo));
  }

  removerConfirmado(): void {
    const tipo = this.tipoParaRemover();
    if (tipo === null) return;
    this.erroRemocao.set(null);
    this.gravar('removendo', tipo.id, this.api.remover(tipo.id), (result) =>
      this.concluirRemocao(tipo, result),
    );
  }

  reativarConfirmado(): void {
    const tipo = this.tipoParaReativar();
    if (tipo === null) return;
    this.erroReativacao.set(null);
    const contexto = withIdempotencyKey(this.chaveDaReativacao());
    this.gravar('reativando', tipo.id, this.api.reativar(tipo.id, contexto), (result) =>
      this.concluirReativacao(tipo, result),
    );
  }

  private abrirFormulario(
    modo: ModoFormulario,
    id: string | null,
    valores: ValoresDoTipoProcesso,
  ): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.modo.set(modo);
    this.tipoEmEdicaoId.set(id);
    this.ligacaoDoCodigo.reiniciar();
    this.form.reset(valores);
    this.erro.set(null);
    this.recusaDoSalvamento.set('');
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

  private concluirSalvamento(result: ApiResult<string | void>, modo: ModoFormulario): void {
    if (!result.ok) {
      this.aplicarFalha(result.problem);
      this.recusaDoSalvamento.set(this.erro() ? '' : 'Revise os campos indicados.');
      return;
    }
    const criado = modo === 'criar';
    this.resultado.set(criado ? 'Tipo de processo criado.' : 'Tipo de processo atualizado.');
    this.notifications.success(criado ? 'Tipo de processo criado' : 'Tipo de processo atualizado');
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(tipo: TipoProcessoDto, result: ApiResult<void>): void {
    if (!result.ok) {
      this.erroRemocao.set(this.recusarConfirmacao(result.problem));
      return;
    }
    this.resultado.set(`Tipo de processo ${tipo.codigo} desativado.`);
    this.notifications.success('Tipo de processo desativado', tipo.codigo);
    this.confirmando.set(false);
    this.tipoParaRemover.set(null);
    this.recarregar();
  }

  private concluirReativacao(tipo: TipoProcessoDto, result: ApiResult<void>): void {
    if (!result.ok) {
      if (deveRotacionarIdempotencyKey(result.problem)) {
        this.chaveDaReativacao.set(idempotencyKey.create());
      }
      this.erroReativacao.set(this.recusarConfirmacao(result.problem));
      return;
    }
    this.resultado.set(`Tipo de processo ${tipo.codigo} reativado.`);
    this.notifications.success('Tipo de processo reativado', tipo.codigo);
    this.confirmandoReativacao.set(false);
    this.tipoParaReativar.set(null);
    this.recarregar();
  }

  /** A mensagem da recusa para o diálogo; só a falha do servidor (5xx) avisa também por toast. */
  private recusarConfirmacao(problem: ProblemDetails): string {
    const titulo = this.problemI18n.resolve(problem).title;
    if (problem.status >= 500) this.notifications.errorFromProblem(problem, { title: titulo });
    return titulo;
  }

  private recarregar(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }

  /**
   * Só os 409 de duplicidade pertencem a um campo (o corpo não traz `errors[]`, então o código de
   * wire é o vínculo). Os demais, como o conflito de processamento da chave de idempotência e o de
   * concorrência, não dizem nada do campo: a mensagem vai ao alerta.
   */
  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
      this.renovarChave();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    if (problem.code === CODIGO_JA_EXISTE) {
      this.renovarChave();
      marcarRecusaDoServidor(
        this.form.controls['codigo'],
        problem.code,
        this.problemI18n.resolve(problem).title,
      );
      return;
    }
    if (deveRotacionarIdempotencyKey(problem)) this.renovarChave();
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    const aplicou = marcarRecusasDosCampos(errors, this.form, controleDoCampoDoServidor);
    this.erro.set(aplicou ? null : MENSAGEM_SEM_MAPEAMENTO);
  }

  private renovarChave(): void {
    this.chave.set(idempotencyKey.create());
  }
}
