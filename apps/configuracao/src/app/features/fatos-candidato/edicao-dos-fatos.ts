import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { FatoCandidatoDto, FatosCandidatoApi } from '@uniplus/shared-data/configuracao';
import { ligarCodigoDeCadastro } from '../../shared/codigo-de-cadastro';
import { aguardarRecarga } from '../../shared/foco';
import { CLASSIFICACOES_DE_PROTECAO, rotuloDe } from '../../shared/protecao-do-catalogo';
import { CODIGO_JA_EXISTE, ehConflitoDeConcorrencia } from './conflitos-do-fato';
import { EdicaoDoFato } from './edicao-do-fato';
import {
  CampoDaCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeFato,
  criarNaApi,
  ligarDependenciasDaCriacao,
} from './fato-candidato-form';
import type { AcaoDeAtivacao } from './fato-candidato.regras';
import { FatosCandidatoStore } from './fatos-candidato.store';
import type { AndamentoDaEscrita } from '../../shared/escrita';
import { descartarRecusasDoServidor } from '../../shared/formulario';

type Escrita = 'criando' | 'ativando' | 'aceitando';
type Modo = 'criar' | 'editar';

const MENSAGEM_DE_CONCORRENCIA =
  'Outra pessoa alterou este fato enquanto você decidia. Confira a situação atual dele na lista.';

/** A desativação ou reativação que aguarda a confirmação do administrador. */
export interface PedidoDeAtivacao {
  readonly fato: FatoCandidatoDto;
  readonly acao: AcaoDeAtivacao;
}

/**
 * As escritas da tela de fatos fora da edição do fato aberto: a criação, a desativação e
 * reativação com confirmação e o aceite da recomendação da proteção de dados. É a única dona do
 * indicador de gravação delas, então uma escrita impede a outra; as escritas da edição têm a trava
 * da `EdicaoDoFato`, que só existe com a edição aberta, e o drawer modal impede as duas de
 * coexistirem.
 */
@Injectable()
export class EdicaoDosFatos {
  private readonly api = inject(FatosCandidatoApi);
  private readonly lista = inject(FatosCandidatoStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly editor = inject(EdicaoDoFato);

  readonly form = criarFormularioDeFato();
  readonly dependencias = ligarDependenciasDaCriacao(this.form);
  private readonly ligacaoDoCodigo = ligarCodigoDeCadastro(
    this.form.controls,
    () => this.modo() === 'criar',
  );

  private readonly escrita = signal<Escrita | null>(null);
  private readonly recarga = aguardarRecarga(
    this.lista.carregando,
    computed(() => this.lista.mensagemDeErro() !== null),
  );
  private readonly emAndamento = signal<AndamentoDaEscrita | null>(null);
  /** Inclui a espera pela recarga: a lista só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(
    () => this.escrita() !== null || this.recarga.aguardando() || this.editor.aguardandoLista(),
  );
  readonly criando = computed(() => this.escrita() === 'criando');
  readonly ativando = computed(() => this.escrita() === 'ativando');
  readonly aceitando = computed(() => this.escrita() === 'aceitando');
  /** A espera é desta classe (escrita própria ou a recarga que a segue), e não da edição do fato aberto. */
  private readonly esperaPropria = computed(
    () => this.escrita() !== null || this.recarga.aguardando(),
  );
  readonly andamento = computed(() => (this.esperaPropria() ? this.emAndamento() : null));

  readonly aberto = signal(false);
  readonly modo = signal<Modo>('criar');
  readonly erro = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly erroDaAtivacao = signal<string | null>(null);
  readonly confirmandoAceite = signal(false);
  readonly erroDoAceite = signal<string | null>(null);
  readonly pedido = signal<PedidoDeAtivacao | null>(null);
  private readonly fatoParaAceitar = signal<FatoCandidatoDto | null>(null);
  private readonly resultado = signal('');
  private readonly chaveDaCriacao = signal(idempotencyKey.create());
  private readonly chaveDaAtivacao = signal(idempotencyKey.create());
  private readonly chaveDoAceite = signal(idempotencyKey.create());

  readonly tituloDoDrawer = computed(() =>
    this.modo() === 'criar' ? 'Novo fato do candidato' : 'Fato do candidato',
  );
  readonly tituloDaConfirmacao = computed(() =>
    this.pedido()?.acao === 'REATIVAR'
      ? 'Reativar fato do candidato'
      : 'Desativar fato do candidato',
  );
  readonly mensagemDaConfirmacao = computed(() => {
    const pedido = this.pedido();
    if (pedido === null) return '';
    return pedido.acao === 'DESATIVAR'
      ? `Deseja desativar o fato ${pedido.fato.codigo}? Formulários, exigências documentais e critérios novos deixam de ` +
          'poder citá-lo; o que já o cita continua valendo. O fato pode ser reativado depois.'
      : `Deseja reativar o fato ${pedido.fato.codigo}? Ele volta a poder ser citado por formulários, exigências ` +
          'documentais e critérios novos.';
  });
  readonly mensagemDoAceite = computed(() => {
    const fato = this.fatoParaAceitar();
    const recomendada = fato?.aprovacao.classificacaoRecomendada;
    return fato && recomendada
      ? `Aceitar a classificação "${rotuloDe(CLASSIFICACOES_DE_PROTECAO, recomendada)}" para "${fato.nome}" (${fato.codigo})? ` +
          'O fato fica aprovado com ela, sem nova solicitação, e a proteção de dados é avisada.'
      : 'Aceitar a classificação recomendada pela proteção de dados?';
  });
  readonly anuncioDaAtivacao = computed(() =>
    anuncioDaConfirmacao(
      this.pedido()?.fato.codigo,
      this.ativando(),
      this.erroDaAtivacao(),
      'fato',
    ),
  );
  readonly anuncioDoAceite = computed(() =>
    anuncioDaConfirmacao(
      this.fatoParaAceitar()?.codigo,
      this.aceitando(),
      this.erroDoAceite(),
      'aceite',
    ),
  );
  /** Dentro do drawer de criação: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaCriacao = computed(() =>
    this.criando() ? 'Criando fato do candidato.' : (this.erro() ?? ''),
  );
  /** Na página: o desfecho, anunciado quando nenhuma sobreposição está aberta para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmando() || this.confirmandoAceite() || this.aberto() ? '' : this.resultado(),
  );

  constructor() {
    effect(() => {
      if (!this.aberto()) untracked(() => this.editor.fechar());
    });
    // O alvo é da escrita que o pôs; terminada a espera, uma nova recarga (a do envio da solicitação) não o herda.
    effect(() => {
      if (!this.esperaPropria()) untracked(() => this.emAndamento.set(null));
    });
  }

  abrirCriacao(): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.focoNoFatoCriado.set(false);
    this.modo.set('criar');
    this.ligacaoDoCodigo.reiniciar();
    this.form.reset();
    this.erro.set(null);
    this.chaveDaCriacao.set(idempotencyKey.create());
    this.aberto.set(true);
  }

  abrirEdicao(id: string): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.focoNoFatoCriado.set(false);
    this.modo.set('editar');
    this.editor.abrir(id);
    this.aberto.set(true);
  }

  fechar(): void {
    if (!this.criando() && !this.editor.bloqueado()) this.aberto.set(false);
  }

  criar(): void {
    if (this.gravando()) return;
    this.erro.set(null);
    descartarRecusasDoServidor(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valores = this.form.getRawValue();
    const contexto = withIdempotencyKey(this.chaveDaCriacao());
    this.gravar('criando', null, criarNaApi(this.api, valores, contexto), (resultado) => {
      if (resultado.ok) this.concluirCriacao(resultado.data, valores.codigo);
      else this.recusarCriacao(resultado.problem);
    });
  }

  pedirAtivacao(fato: FatoCandidatoDto, acao: AcaoDeAtivacao): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.erroDaAtivacao.set(null);
    this.pedido.set({ fato, acao });
    this.chaveDaAtivacao.set(idempotencyKey.create());
    this.confirmando.set(true);
  }

  pedirAceite(fato: FatoCandidatoDto): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.erroDoAceite.set(null);
    this.fatoParaAceitar.set(fato);
    this.chaveDoAceite.set(idempotencyKey.create());
    this.confirmandoAceite.set(true);
  }

  /** Desativa ou reativa o fato confirmado; na recusa o diálogo segue aberto com a mensagem da API. */
  confirmarAtivacao(): void {
    const pedido = this.pedido();
    if (pedido === null || this.gravando()) return;
    const { fato, acao } = pedido;
    this.erroDaAtivacao.set(null);
    const operacao =
      acao === 'DESATIVAR'
        ? this.api.desativar(fato.id)
        : this.api.ativar(fato.id, withIdempotencyKey(this.chaveDaAtivacao()));
    const rotulo = acao === 'DESATIVAR' ? 'Desativando...' : 'Reativando...';
    this.gravar('ativando', { id: fato.id, rotulo }, operacao, (resultado) => {
      if (!resultado.ok) {
        this.erroDaAtivacao.set(this.recusarConfirmacao(resultado.problem, this.chaveDaAtivacao));
        if (ehConflitoDeConcorrencia(resultado.problem)) this.recarregar();
        return;
      }
      const sucesso = acao === 'DESATIVAR' ? 'Fato desativado' : 'Fato reativado';
      this.resultado.set(`${sucesso}: ${fato.codigo}.`);
      this.notifications.success(sucesso, fato.codigo);
      this.confirmando.set(false);
      this.pedido.set(null);
      this.recarregar();
    });
  }

  /** Aceita a recomendação do fato negado, inclusive o de sistema. */
  confirmarAceite(): void {
    const fato = this.fatoParaAceitar();
    if (fato === null || this.gravando()) return;
    this.erroDoAceite.set(null);
    const contexto = withIdempotencyKey(this.chaveDoAceite());
    this.gravar(
      'aceitando',
      { id: fato.id, rotulo: 'Aceitando...' },
      this.api.aceitarRecomendacao(fato.id, contexto),
      (resultado) => {
        if (!resultado.ok) {
          this.erroDoAceite.set(this.recusarConfirmacao(resultado.problem, this.chaveDoAceite));
          // A recusa pode vir de um fato que mudou em outra sessão: a lista e a situação são relidas.
          this.recarregar();
          return;
        }
        this.resultado.set(`Recomendação aceita: ${fato.codigo}.`);
        this.notifications.success('Recomendação aceita', fato.codigo);
        this.confirmandoAceite.set(false);
        this.fatoParaAceitar.set(null);
        this.recarregar();
      },
    );
  }

  /** Há uma sobreposição aberta sobre a lista: o drawer ou um diálogo de confirmação. */
  readonly emSobreposicao = computed(
    () => this.aberto() || this.confirmando() || this.confirmandoAceite(),
  );
  /** O fato recém-criado ainda não recebeu o foco que o botão de criar, desmontado, deixou livre. */
  readonly focoNoFatoCriado = signal(false);

  /** Relê a lista e a situação de aprovação; o fim da recarga é o que libera as ações da lista. */
  recarregar(): void {
    this.recarga.iniciar();
    this.lista.recarregar();
  }

  private gravar<T>(
    tipo: Escrita,
    alvo: AndamentoDaEscrita | null,
    operacao: Observable<ApiResult<T>>,
    concluir: (resultado: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) return;
    this.escrita.set(tipo);
    this.emAndamento.set(alvo);
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      concluir(resultado);
      this.escrita.set(null);
    });
  }

  /** O fato criado continua no drawer, agora em edição: o derivado categórico precisa dos valores antes das regras. */
  private concluirCriacao(id: string, codigo: string): void {
    this.chaveDaCriacao.set(idempotencyKey.create());
    this.notifications.success('Fato criado', codigo);
    this.resultado.set(`Fato ${codigo} criado.`);
    this.modo.set('editar');
    this.focoNoFatoCriado.set(true);
    this.editor.abrir(id);
    this.recarregar();
  }

  private recusarCriacao(problem: ProblemDetails): void {
    if (deveRotacionarIdempotencyKey(problem)) this.chaveDaCriacao.set(idempotencyKey.create());
    if (problem.code === CODIGO_JA_EXISTE) {
      this.marcarCampo('codigo', this.problemI18n.resolve(problem).title);
      return;
    }
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && this.marcarCamposRecusados(problem))
      return;
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  private marcarCamposRecusados(problem: ProblemDetails): boolean {
    let aplicou = false;
    for (const recusa of problem.errors ?? []) {
      const campo = controleDoCampoDoServidor(recusa.field);
      if (campo === null) continue;
      this.marcarCampo(campo, recusa.message);
      aplicou = true;
    }
    return aplicou;
  }

  private marcarCampo(campo: CampoDaCriacao, mensagem: string): void {
    const controle = this.form.controls[campo];
    controle.setErrors({ backend: { message: mensagem } });
    controle.markAsTouched();
  }

  /** A mensagem da recusa para o diálogo; só a falha do servidor (5xx) avisa também por toast. */
  private recusarConfirmacao(problem: ProblemDetails, chave: { set(valor: string): void }): string {
    if (deveRotacionarIdempotencyKey(problem)) chave.set(idempotencyKey.create());
    const titulo = this.problemI18n.resolve(problem).title;
    if (problem.status >= 500) this.notifications.errorFromProblem(problem, { title: titulo });
    return ehConflitoDeConcorrencia(problem) ? MENSAGEM_DE_CONCORRENCIA : titulo;
  }
}

/** O que o diálogo de confirmação anuncia: o andamento e a recusa, que só fazem sentido com ele aberto. */
function anuncioDaConfirmacao(
  codigo: string | undefined,
  emCurso: boolean,
  motivo: string | null,
  objeto: 'fato' | 'aceite',
): string {
  if (codigo === undefined) return '';
  const alvo = objeto === 'fato' ? `o fato ${codigo}` : `a recomendação do fato ${codigo}`;
  if (emCurso) return `Gravando ${alvo}.`;
  return motivo ? `Não foi possível concluir a ação sobre ${alvo}. ${motivo}` : '';
}
