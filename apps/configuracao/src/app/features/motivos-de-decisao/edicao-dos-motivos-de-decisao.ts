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
import { MotivoDeDecisaoDto, MotivosDeDecisaoApi } from '@uniplus/shared-data/selecao';
import { ItemDaConfirmacao } from '../../shared/confirmacao-de-remocao';
import { aguardarRecarga } from '../../shared/foco';
import type { AndamentoDaEscrita } from '../../shared/escrita';
import {
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
  marcarRecusasDosCampos,
  MENSAGEM_SEM_MAPEAMENTO,
} from '../../shared/formulario';
import {
  MOTIVO_EM_BRANCO,
  ModoDoMotivo,
  ValoresDoMotivo,
  ajustarAoModo,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeMotivo,
  valoresDoMotivo,
} from './motivo-de-decisao-form';
import { FundamentoOferecido, FundamentosOferecidos } from './fundamentos-oferecidos';
import { MotivosDeDecisaoStore } from './motivos-de-decisao.store';
import { rotuloDe, TIPOS_DE_MOTIVO, tipoPedeSubclassificacao } from './tipos-de-motivo';

type Escrita = 'salvando' | 'situacao';
type MudancaDeSituacao = { readonly motivo: MotivoDeDecisaoDto; readonly ativar: boolean };

const ROTULO_DA_ESCRITA: Readonly<Record<Escrita, string>> = {
  salvando: 'Salvando...',
  situacao: 'Gravando...',
};

const MENSAGEM_DO_BLOQUEIO =
  'Envio sem confirmação. Os campos ficaram bloqueados: reenvie os mesmos dados ou cancele.';

const CODIGO_JA_EXISTE = 'uniplus.selecao.motivo_de_decisao.codigo_ja_existe';

/**
 * Todas as escritas do cadastro de motivos: criar, editar a descrição e desativar ou reativar.
 * É a única dona do indicador de gravação, então uma escrita impede a outra.
 */
@Injectable()
export class EdicaoDosMotivosDeDecisao {
  private readonly api = inject(MotivosDeDecisaoApi);
  private readonly store = inject(MotivosDeDecisaoStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly oferecidos = inject(FundamentosOferecidos);

  readonly form = criarFormularioDeMotivo();
  private readonly escrita = signal<Escrita | null>(null);
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  private readonly emAndamento = signal<AndamentoDaEscrita | null>(null);
  /** Inclui a espera pela recarga: a lista só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.escrita() !== null || this.recarga.aguardando());
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly mudandoSituacao = computed(() => this.escrita() === 'situacao');
  readonly andamento = computed(() => (this.gravando() ? this.emAndamento() : null));

  readonly aberto = signal(false);
  readonly modo = signal<ModoDoMotivo>('criar');
  readonly erro = signal<string | null>(null);
  /** Falha sem resposta conclusiva: o formulário só admite reenviar os mesmos dados, com a mesma chave. */
  readonly aguardandoReenvio = signal(false);
  readonly confirmando = signal(false);
  readonly erroDaConfirmacao = signal<string | null>(null);
  private readonly motivoEmEdicaoId = signal<string | null>(null);
  private readonly subclassificacaoEmEdicao = signal('');
  /** A mudança a que a chave atual pertence: reaberta após falha ambígua, ela é a mesma operação. */
  private chaveDaMudanca: { readonly id: string; readonly ativar: boolean } | null = null;
  private readonly mudanca = signal<MudancaDeSituacao | null>(null);
  /** A mudança foi enviada e a resposta não chegou: só a releitura da lista diz se ela valeu. */
  private mudancaSemResposta = false;
  private readonly resultadoDaSituacao = signal('');
  private readonly chave = signal(idempotencyKey.create());

  /** Os fundamentos do catálogo; na edição, o do motivo aparece mesmo que o catálogo não o traga. */
  readonly fundamentos = computed<readonly FundamentoOferecido[]>(() => {
    const lidos = (this.oferecidos.lista() ?? []).map(({ codigo, nome }) => ({ codigo, nome }));
    const atual = this.subclassificacaoEmEdicao();
    const ausente =
      this.modo() === 'editar' && atual !== '' && !lidos.some((f) => f.codigo === atual);
    return ausente ? [{ codigo: atual, nome: atual }, ...lidos] : lidos;
  });
  readonly falhaNosFundamentos = this.oferecidos.falha;
  readonly pedeSubclassificacao = computed(() => tipoPedeSubclassificacao(this.store.tipo()));
  readonly tipoEscolhido = computed(() => rotuloDe(TIPOS_DE_MOTIVO, this.store.tipo()));
  readonly titulo = computed(() =>
    this.modo() === 'criar' ? 'Novo motivo de decisão' : 'Editar motivo de decisão',
  );
  readonly ativando = computed(() => this.mudanca()?.ativar === true);
  readonly tituloDaConfirmacao = computed(() =>
    this.ativando() ? 'Reativar motivo de decisão?' : 'Desativar motivo de decisão?',
  );
  readonly itemDaConfirmacao = computed<ItemDaConfirmacao | null>(() => {
    const pendente = this.mudanca();
    if (pendente === null) return null;
    const verbo = pendente.ativar ? 'reativar' : 'desativar';
    return { abertura: `Você está prestes a ${verbo} o motivo`, nome: pendente.motivo.codigo };
  });
  readonly mensagemDaConfirmacao = computed(() =>
    this.ativando()
      ? 'O motivo volta a poder ser escolhido nas novas publicações.'
      : 'O motivo deixa de entrar em novas publicações. Ele permanece onde já foi disponibilizado, inclusive nas decisões já proferidas.',
  );
  /** Dentro do diálogo: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaConfirmacao = computed(() => {
    const pendente = this.mudanca();
    if (pendente === null) return '';
    if (this.mudandoSituacao()) return `Gravando o motivo ${pendente.motivo.codigo}.`;
    const motivo = this.erroDaConfirmacao();
    return motivo ? `Não foi possível alterar o motivo ${pendente.motivo.codigo}. ${motivo}` : '';
  });
  /** Dentro do drawer: o andamento e o bloqueio após envio sem resposta conclusiva, que só fazem sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() => {
    if (this.salvando()) return 'Salvando motivo.';
    return this.aguardandoReenvio() ? MENSAGEM_DO_BLOQUEIO : '';
  });
  /** Na página: a mudança concluída, anunciada quando o diálogo já não está aberto para dizê-la. */
  readonly anuncioDaPagina = computed(() => (this.confirmando() ? '' : this.resultadoDaSituacao()));

  abrirCadastro(): void {
    if (this.gravando()) return;
    this.preparar('criar', null, MOTIVO_EM_BRANCO);
  }

  abrirEdicao(motivo: MotivoDeDecisaoDto): void {
    if (this.gravando()) return;
    this.preparar('editar', motivo.id, valoresDoMotivo(motivo));
  }

  /** Descartar um envio sem resposta conclusiva relê a lista: ela mostra se ele chegou a valer. */
  fechar(): void {
    if (this.salvando()) return;
    this.aberto.set(false);
    if (!this.aguardandoReenvio()) return;
    this.renovarChave();
    this.recarregar();
  }

  /** O X e o Esc do diálogo de confirmação cancelam como o botão Cancelar. */
  aoMudarConfirmacao(aberta: boolean): void {
    if (!aberta) this.cancelarMudanca();
  }

  /** Descartar uma mudança sem resposta conclusiva relê a lista: ela mostra se a mudança valeu. */
  cancelarMudanca(): void {
    if (this.mudandoSituacao()) return;
    this.confirmando.set(false);
    if (!this.mudancaSemResposta) return;
    this.mudanca.set(null);
    this.renovarChave();
    this.recarregar();
  }

  /** Trocar o tipo ou o filtro leva a outra lista: o que estava pendente deixa de valer. */
  abandonarPendencias(): void {
    if (this.escrita() !== null) return;
    this.aberto.set(false);
    this.confirmando.set(false);
    this.mudanca.set(null);
    this.renovarChave();
  }

  pedirMudancaDeSituacao(motivo: MotivoDeDecisaoDto, ativar: boolean): void {
    if (this.gravando()) return;
    this.resultadoDaSituacao.set('');
    this.erroDaConfirmacao.set(null);
    this.mudanca.set({ motivo, ativar });
    this.prepararChaveDaMudanca(motivo.id, ativar);
    this.confirmando.set(true);
  }

  salvar(): void {
    this.erro.set(null);
    descartarRecusasDoServidor(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.motivoEmEdicaoId();
    this.gravar('salvando', id, this.operacaoDeSalvamento(id), (result) =>
      this.concluirSalvamento(result),
    );
  }

  confirmarMudanca(): void {
    const pendente = this.mudanca();
    if (pendente === null) return;
    this.erroDaConfirmacao.set(null);
    this.mudancaSemResposta = false;
    const chave = withIdempotencyKey(this.chave());
    const { motivo, ativar } = pendente;
    const operacao = ativar
      ? this.api.reativar(motivo.id, chave)
      : this.api.desativar(motivo.id, chave);
    this.gravar('situacao', motivo.id, operacao, (result) =>
      this.concluirMudanca(pendente, result),
    );
  }

  private operacaoDeSalvamento(id: string | null): Observable<ApiResult<string | void>> {
    const valores = this.form.getRawValue();
    const chave = withIdempotencyKey(this.chave());
    return id === null
      ? this.api.criar(comandoDeCriacao(this.store.tipo(), valores), chave)
      : this.api.atualizar(id, comandoDeAtualizacao(id, valores), chave);
  }

  private preparar(modo: ModoDoMotivo, id: string | null, valores: ValoresDoMotivo): void {
    this.modo.set(modo);
    this.renovarChave();
    this.motivoEmEdicaoId.set(id);
    this.form.reset(valores);
    ajustarAoModo(this.form, modo, this.pedeSubclassificacao());
    this.erro.set(null);
    this.subclassificacaoEmEdicao.set(valores.subclassificacao);
    if (this.pedeSubclassificacao()) this.oferecidos.garantir();
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
      this.modo() === 'criar' ? 'Motivo de decisão criado' : 'Motivo de decisão atualizado',
    );
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirMudanca(pendente: MudancaDeSituacao, result: ApiResult<void>): void {
    if (!result.ok) {
      this.recusarMudanca(result.problem);
      return;
    }
    const codigo = pendente.motivo.codigo;
    this.resultadoDaSituacao.set(
      pendente.ativar ? `Motivo ${codigo} reativado.` : `Motivo ${codigo} desativado.`,
    );
    this.notifications.success(pendente.ativar ? 'Motivo reativado' : 'Motivo desativado', codigo);
    this.confirmando.set(false);
    this.mudanca.set(null);
    this.renovarChave();
    this.recarregar();
  }

  private recusarMudanca(problem: ProblemDetails): void {
    const titulo = this.problemI18n.resolve(problem).title;
    this.erroDaConfirmacao.set(titulo);
    this.mudancaSemResposta = !deveRotacionarIdempotencyKey(problem);
    if (!this.mudancaSemResposta) this.renovarChave();
    if (problem.status >= 500) this.notifications.errorFromProblem(problem, { title: titulo });
  }

  private recarregar(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
      this.renovarChave();
      this.aplicarErrosDeValidacao(problem.errors);
    } else if (problem.code === CODIGO_JA_EXISTE) {
      this.renovarChave();
      const titulo = this.problemI18n.resolve(problem).title;
      marcarRecusaDoServidor(this.form.controls.codigo, problem.code, titulo);
    } else {
      this.recusarSalvamento(problem);
    }
  }

  private recusarSalvamento(problem: ProblemDetails): void {
    if (deveRotacionarIdempotencyKey(problem)) this.renovarChave();
    else this.travarParaReenvio();
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    const aplicou = marcarRecusasDosCampos(errors, this.form, controleDoCampoDoServidor);
    this.erro.set(aplicou ? null : MENSAGEM_SEM_MAPEAMENTO);
  }

  private prepararChaveDaMudanca(id: string, ativar: boolean): void {
    const mesma = this.chaveDaMudanca?.id === id && this.chaveDaMudanca.ativar === ativar;
    if (!mesma) this.renovarChave();
    this.chaveDaMudanca = { id, ativar };
  }

  /** A chave pertence ao comando enviado: até o reenvio dele, nenhum outro comando pode sair. */
  private travarParaReenvio(): void {
    this.form.disable({ emitEvent: false });
    this.aguardandoReenvio.set(true);
  }

  private liberarFormulario(): void {
    if (!this.aguardandoReenvio()) return;
    this.aguardandoReenvio.set(false);
    this.form.controls.descricao.enable({ emitEvent: false });
    ajustarAoModo(this.form, this.modo(), this.pedeSubclassificacao());
  }

  private renovarChave(): void {
    this.chaveDaMudanca = null;
    this.mudancaSemResposta = false;
    this.chave.set(idempotencyKey.create());
    this.liberarFormulario();
  }
}
