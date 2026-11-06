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
  RecursoAcessibilidadeApi,
  RecursoAcessibilidadeDto,
} from '@uniplus/shared-data/configuracao';
import { ligarCodigoDeCadastro } from '../../shared/codigo-de-cadastro';
import { ItemDaConfirmacao } from '../../shared/confirmacao-de-remocao';
import { aguardarRecarga } from '../../shared/foco';
import {
  RECURSO_EM_BRANCO,
  RecursoAcessibilidadeForm,
  ValoresDoRecurso,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeRecurso,
  valoresDoRecurso,
} from './recurso-acessibilidade-form';
import { RecursosAcessibilidadeStore } from './recursos-acessibilidade.store';
import { type AndamentoDaEscrita, ROTULOS_PADRAO_DA_ESCRITA } from '../../shared/escrita';
import {
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
  marcarRecusasDosCampos,
  MENSAGEM_SEM_MAPEAMENTO,
} from '../../shared/formulario';

type ModoFormulario = 'criar' | 'editar';
type Escrita = 'salvando' | 'removendo';

/**
 * Conflitos de unicidade (409) que pertencem a um campo do formulário: o corpo não traz
 * `errors[]`, então só o código de wire diz a qual campo o conflito se refere.
 */
const CAMPO_POR_CONFLITO: ReadonlyMap<string, keyof RecursoAcessibilidadeForm> = new Map([
  ['uniplus.configuracao.recurso_acessibilidade.codigo_ja_existe', 'codigo' as const],
  ['uniplus.configuracao.recurso_acessibilidade.nome_ja_existe', 'nome' as const],
]);

/**
 * Todas as escritas da tela de recursos de acessibilidade: o formulário, o salvamento e a
 * remoção com confirmação. É a única dona do indicador de gravação, então uma escrita impede a
 * outra.
 */
@Injectable()
export class EdicaoDosRecursosAcessibilidade {
  private readonly api = inject(RecursoAcessibilidadeApi);
  private readonly store = inject(RecursosAcessibilidadeStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDeRecurso();
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
  private readonly recursoEmEdicaoId = signal<string | null>(null);
  private readonly recursoParaRemover = signal<RecursoAcessibilidadeDto | null>(null);
  private readonly resultadoDaRemocao = signal('');
  private readonly chave = signal(idempotencyKey.create());
  private readonly ligacaoDoCodigo = ligarCodigoDeCadastro(
    this.form.controls,
    () => this.modo() === 'criar',
  );

  readonly titulo = computed(() =>
    this.modo() === 'criar' ? 'Novo recurso de acessibilidade' : 'Editar recurso de acessibilidade',
  );
  readonly itemDaConfirmacao = computed<ItemDaConfirmacao | null>(() => {
    const recurso = this.recursoParaRemover();
    return recurso
      ? { abertura: 'Você está prestes a remover o recurso', nome: recurso.nome }
      : null;
  });
  readonly mensagemDaConfirmacao = computed(() =>
    this.recursoParaRemover()
      ? 'A remoção impede novos editais de utilizá-lo, mas não altera ofertas já congeladas — a cópia por valor de cada processo permanece íntegra.'
      : 'Deseja remover este recurso de acessibilidade?',
  );
  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const recurso = this.recursoParaRemover();
    if (recurso === null) return '';
    if (this.removendo()) return `Removendo o recurso de acessibilidade ${recurso.nome}.`;
    const motivo = this.erroDaRemocao();
    return motivo
      ? `Não foi possível remover o recurso de acessibilidade ${recurso.nome}. ${motivo}`
      : '';
  });
  /** Dentro do drawer: o andamento, que só faz sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando recurso de acessibilidade.' : '',
  );
  /** Na página: a remoção concluída, anunciada quando o diálogo já não está aberto para dizê-la. */
  readonly anuncioDaPagina = computed(() => (this.confirmando() ? '' : this.resultadoDaRemocao()));

  abrirCadastro(): void {
    if (this.gravando()) return;
    this.preparar('criar', null, RECURSO_EM_BRANCO);
  }

  abrirEdicao(recurso: RecursoAcessibilidadeDto): void {
    if (this.gravando()) return;
    this.preparar('editar', recurso.id, valoresDoRecurso(recurso));
  }

  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }

  pedirRemocao(recurso: RecursoAcessibilidadeDto): void {
    if (this.gravando()) return;
    this.resultadoDaRemocao.set('');
    this.erroDaRemocao.set(null);
    this.recursoParaRemover.set(recurso);
    this.confirmando.set(true);
  }

  salvar(): void {
    this.erro.set(null);
    descartarRecusasDoServidor(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.recursoEmEdicaoId();
    const valores = this.form.getRawValue();
    const chave = withIdempotencyKey(this.chave());
    const operacao: Observable<ApiResult<string | void>> =
      id === null
        ? this.api.criar(comandoDeCriacao(valores), chave)
        : this.api.atualizar(id, comandoDeAtualizacao(id, valores), chave);
    this.gravar('salvando', id, operacao, (result) => this.concluirSalvamento(result));
  }

  removerConfirmado(): void {
    const recurso = this.recursoParaRemover();
    if (recurso === null) return;
    this.erroDaRemocao.set(null);
    this.gravar('removendo', recurso.id, this.api.remover(recurso.id), (result) =>
      this.concluirRemocao(recurso, result),
    );
  }

  private preparar(modo: ModoFormulario, id: string | null, valores: ValoresDoRecurso): void {
    this.modo.set(modo);
    this.recursoEmEdicaoId.set(id);
    this.ligacaoDoCodigo.reiniciar();
    this.form.reset(valores);
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
    this.emAndamento.set(id === null ? null : { id, rotulo: ROTULOS_PADRAO_DA_ESCRITA[tipo] });
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
      this.modo() === 'criar'
        ? 'Recurso de acessibilidade criado'
        : 'Recurso de acessibilidade atualizado',
    );
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(recurso: RecursoAcessibilidadeDto, result: ApiResult<void>): void {
    if (!result.ok) {
      const titulo = this.problemI18n.resolve(result.problem).title;
      this.erroDaRemocao.set(titulo);
      if (result.problem.status >= 500) {
        this.notifications.errorFromProblem(result.problem, { title: titulo });
      }
      return;
    }
    this.resultadoDaRemocao.set(`Recurso de acessibilidade ${recurso.nome} removido.`);
    this.notifications.success('Recurso de acessibilidade removido');
    this.confirmando.set(false);
    this.recursoParaRemover.set(null);
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
    const campo = CAMPO_POR_CONFLITO.get(problem.code);
    if (campo !== undefined) {
      this.renovarChave();
      marcarRecusaDoServidor(
        this.form.controls[campo],
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
