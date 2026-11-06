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
import { TipoEtapaDto, TiposEtapaApi } from '@uniplus/shared-data/configuracao';
import { aguardarRecarga } from '../../shared/foco';
import {
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeEtapa,
  valoresDaEtapa,
  valoresEmBrancoDaEtapa,
} from './tipo-etapa-form';
import { TiposEtapaStore } from './tipos-etapa.store';
import { type AndamentoDaEscrita, ROTULOS_PADRAO_DA_ESCRITA } from '../../shared/escrita';
import {
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
  marcarRecusasDosCampos,
  MENSAGEM_SEM_MAPEAMENTO,
} from '../../shared/formulario';

/** Vendor code do DomainError `TipoEtapa.CodigoJaExiste` (409 Conflict). */
const CODIGO_JA_EXISTE = 'uniplus.configuracao.tipo_etapa.codigo_ja_existe';

type Escrita = 'salvando' | 'removendo';
type ModoFormulario = 'criar' | 'editar';

/**
 * Todas as escritas da tela de tipos de etapa: o formulário, o salvamento e a remoção com
 * confirmação. É a única dona do indicador de gravação, então uma escrita impede a outra.
 */
@Injectable()
export class EdicaoDosTiposEtapa {
  private readonly api = inject(TiposEtapaApi);
  private readonly store = inject(TiposEtapaStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDeEtapa();
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
  readonly erroRemocao = signal<string | null>(null);
  private readonly tipoEmEdicaoId = signal<string | null>(null);
  private readonly tipoParaRemover = signal<TipoEtapaDto | null>(null);
  private readonly recusaDoSalvamento = signal('');
  private readonly resultadoDoSalvamento = signal('');
  private readonly resultadoDaRemocao = signal('');
  private readonly chave = signal(idempotencyKey.create());

  readonly tituloDoFormulario = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de etapa' : 'Editar tipo de etapa',
  );
  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const tipo = this.tipoParaRemover();
    if (!tipo) return '';
    if (this.removendo()) return `Removendo o tipo de etapa ${tipo.codigo}.`;
    const motivo = this.erroRemocao();
    return motivo ? `Não foi possível remover o tipo de etapa ${tipo.codigo}. ${motivo}` : '';
  });
  /** Dentro do drawer: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando tipo de etapa.' : this.recusaDoSalvamento(),
  );
  /** Na página: o desfecho, anunciado quando nenhuma sobreposição está aberta para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmando() || this.aberto()
      ? ''
      : this.resultadoDaRemocao() || this.resultadoDoSalvamento(),
  );
  readonly mensagemDaConfirmacao = computed(() => {
    const tipo = this.tipoParaRemover();
    return tipo
      ? `Deseja remover o tipo de etapa ${tipo.codigo}? A remoção impede que novos processos usem esse tipo; as etapas já gravadas não mudam — elas congelaram a própria cópia.`
      : 'Deseja remover este tipo de etapa?';
  });

  abrirCadastro(): void {
    this.abrirFormulario('criar', null, valoresEmBrancoDaEtapa());
  }

  abrirEdicao(tipo: TipoEtapaDto): void {
    this.abrirFormulario('editar', tipo.id, valoresDaEtapa(tipo));
  }

  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }

  pedirRemocao(tipo: TipoEtapaDto): void {
    if (this.gravando()) return;
    this.limparResultados();
    this.erroRemocao.set(null);
    this.tipoParaRemover.set(tipo);
    this.confirmando.set(true);
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
    if (!tipo) return;
    this.erroRemocao.set(null);
    this.gravar('removendo', tipo.id, this.api.remover(tipo.id), (result) =>
      this.concluirRemocao(tipo, result),
    );
  }

  private abrirFormulario(
    modo: ModoFormulario,
    id: string | null,
    valores: ReturnType<typeof valoresEmBrancoDaEtapa>,
  ): void {
    if (this.gravando()) return;
    this.limparResultados();
    this.modo.set(modo);
    this.tipoEmEdicaoId.set(id);
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
    this.emAndamento.set(id === null ? null : { id, rotulo: ROTULOS_PADRAO_DA_ESCRITA[tipo] });
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
    this.resultadoDoSalvamento.set(criado ? 'Tipo de etapa criado.' : 'Tipo de etapa atualizado.');
    this.notifications.success(criado ? 'Tipo de etapa criado' : 'Tipo de etapa atualizado');
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(tipo: TipoEtapaDto, result: ApiResult<void>): void {
    if (!result.ok) {
      const titulo = this.problemI18n.resolve(result.problem).title;
      this.erroRemocao.set(titulo);
      if (result.problem.status >= 500) {
        this.notifications.errorFromProblem(result.problem, { title: titulo });
      }
      return;
    }
    this.resultadoDaRemocao.set(`Tipo de etapa ${tipo.codigo} removido.`);
    this.notifications.success('Tipo de etapa removido', tipo.codigo);
    this.confirmando.set(false);
    this.tipoParaRemover.set(null);
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
    if (problem.code === CODIGO_JA_EXISTE) {
      this.renovarChave();
      this.marcarCodigoJaExistente(problem);
      return;
    }
    if (deveRotacionarIdempotencyKey(problem)) this.renovarChave();
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  /** O código reservado é um DomainError único (409, sem `errors[]`): o vínculo com o campo é feito aqui. */
  private marcarCodigoJaExistente(problem: ProblemDetails): void {
    const codigo = this.form.controls.codigo;
    marcarRecusaDoServidor(codigo, problem.code, this.problemI18n.resolve(problem).title);
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    const aplicou = marcarRecusasDosCampos(errors, this.form, controleDoCampoDoServidor);
    this.erro.set(aplicou ? null : MENSAGEM_SEM_MAPEAMENTO);
  }

  private renovarChave(): void {
    this.chave.set(idempotencyKey.create());
  }
}
