import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Observable, map } from 'rxjs';
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
import { TipoDocumentoDto, TiposDocumentoApi } from '@uniplus/shared-data/configuracao';
import { ligarCodigoDeCadastro } from '../../shared/codigo-de-cadastro';
import { aguardarRecarga, avisoDeFalhaDoLookup } from '../../shared/foco';
import type { ProtecaoDoItem } from '../../shared/protecao-do-catalogo';
import { categoriasDoFormulario } from './categorias-do-formulario';
import { protecaoNoFormulario } from './protecao-no-formulario';
import {
  ValoresDoTipoDocumento,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeTipoDocumento,
  valoresDoTipoDocumento,
  valoresEmBrancoDoTipoDocumento,
} from './tipo-documento-form';
import {
  anuncioDaConfirmacao,
  mensagemDaRemocao,
  mensagemDoAceite,
} from './tipos-documento.mensagens';
import { TiposDocumentoStore } from './tipos-documento.store';
import {
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
  marcarRecusasDosCampos,
  MENSAGEM_SEM_MAPEAMENTO,
} from '../../shared/formulario';

/** Vendor code do DomainError `TipoDocumento.CodigoJaExiste` (409, sem `errors[]`). */
const CODIGO_JA_EXISTE = 'uniplus.configuracao.tipo_documento.codigo_ja_existe';

type Escrita = 'salvando' | 'removendo' | 'aceitando';
type ModoFormulario = 'criar' | 'editar';

/**
 * Todas as escritas da tela de tipos de documento: o formulário, o salvamento, a remoção e o
 * aceite da recomendação da proteção de dados, os dois com confirmação. É a única dona do
 * indicador de gravação, então uma escrita impede a outra.
 */
@Injectable()
export class EdicaoDosTiposDocumento {
  private readonly api = inject(TiposDocumentoApi);
  private readonly store = inject(TiposDocumentoStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDeTipoDocumento();
  private readonly escrita = signal<Escrita | null>(null);
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  /** Inclui a espera pela recarga: a lista só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.escrita() !== null || this.recarga.aguardando());
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  readonly aceitando = computed(() => this.escrita() === 'aceitando');

  readonly aberto = signal(false);
  readonly modo = signal<ModoFormulario>('criar');
  readonly erro = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly erroRemocao = signal<string | null>(null);
  readonly confirmandoAceite = signal(false);
  readonly erroAceite = signal<string | null>(null);
  private readonly tipoEmEdicaoId = signal<string | null>(null);
  private readonly tipoParaRemover = signal<TipoDocumentoDto | null>(null);
  private readonly tipoParaAceitar = signal<TipoDocumentoDto | null>(null);
  /** A proteção que o tipo em edição tinha ao abrir o formulário: a base de comparação do aviso. */
  private readonly protecaoOriginal = signal<ProtecaoDoItem | null>(null);
  private readonly recusaDoSalvamento = signal('');
  private readonly resultado = signal('');
  private readonly chave = signal(idempotencyKey.create());
  private readonly chaveDoAceite = signal(idempotencyKey.create());
  private readonly ligacaoDoCodigo = ligarCodigoDeCadastro(
    this.form.controls,
    () => this.modo() === 'criar',
  );
  /** O valor do formulário como sinal, para os derivados reagirem a cada alteração. */
  private readonly valores = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    {
      initialValue: this.form.getRawValue(),
    },
  );

  /** O aviso de categorias fica na tela durante a nova tentativa, para o botão que a pediu não sumir. */
  readonly avisoDasCategorias = avisoDeFalhaDoLookup(this.store.categorias);
  readonly categorias = computed(() =>
    categoriasDoFormulario(
      {
        opcoes: this.store.categorias.opcoes(),
        pendente: this.store.categorias.pendente(),
        comErro: this.avisoDasCategorias(),
      },
      this.valores().categoria,
    ),
  );
  private readonly protecao = protecaoNoFormulario({
    form: this.form,
    valores: this.valores,
    tipoEmEdicaoId: this.tipoEmEdicaoId,
    emEdicao: computed(() => this.modo() === 'editar'),
    original: this.protecaoOriginal,
    aprovacao: this.store.aprovacao,
  });
  readonly hipotesesPermitidas = this.protecao.hipotesesPermitidas;
  readonly decididoEmEdicao = this.protecao.decididoEmEdicao;
  readonly avisaNovaAprovacao = this.protecao.avisaNovaAprovacao;

  readonly mensagemDaConfirmacao = computed(() => mensagemDaRemocao(this.tipoParaRemover()));
  readonly mensagemDoAceite = computed(() => {
    const tipo = this.tipoParaAceitar();
    const situacao = tipo === null ? null : this.store.aprovacao.aprovacaoDe(tipo.id);
    return mensagemDoAceite(tipo, situacao?.classificacaoRecomendada);
  });
  readonly anuncioDaRemocao = computed(() =>
    anuncioDaConfirmacao(this.tipoParaRemover(), this.removendo(), this.erroRemocao(), {
      andamento: 'Removendo',
      recusa: 'remover',
    }),
  );
  readonly anuncioDoAceite = computed(() =>
    anuncioDaConfirmacao(this.tipoParaAceitar(), this.aceitando(), this.erroAceite(), {
      andamento: 'Aceitando a recomendação para',
      recusa: 'aceitar a recomendação para',
    }),
  );
  /** Dentro do drawer: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando tipo de documento.' : this.recusaDoSalvamento(),
  );
  /** Na página: o desfecho, anunciado quando nenhuma sobreposição está aberta para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmando() || this.confirmandoAceite() || this.aberto() ? '' : this.resultado(),
  );

  abrirCadastro(): void {
    this.abrirFormulario('criar', null, valoresEmBrancoDoTipoDocumento(), null);
  }

  abrirEdicao(tipo: TipoDocumentoDto): void {
    this.abrirFormulario('editar', tipo.id, valoresDoTipoDocumento(tipo), {
      classificacaoProtecao: tipo.classificacaoProtecao,
      hipoteseLegal: tipo.hipoteseLegal,
      finalidadeTratamento: tipo.finalidadeTratamento,
    });
  }

  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }

  pedirRemocao(tipo: TipoDocumentoDto): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.erroRemocao.set(null);
    this.tipoParaRemover.set(tipo);
    this.confirmando.set(true);
  }

  pedirAceite(tipo: TipoDocumentoDto): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.erroAceite.set(null);
    this.tipoParaAceitar.set(tipo);
    this.chaveDoAceite.set(idempotencyKey.create());
    this.confirmandoAceite.set(true);
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
    this.gravar('salvando', operacao, (result) => this.concluirSalvamento(result, modo));
  }

  removerConfirmado(): void {
    const tipo = this.tipoParaRemover();
    if (tipo === null) return;
    this.gravar(
      'removendo',
      this.api.remover(tipo.id),
      (result) => this.concluirRemocao(tipo, result),
      () => this.erroRemocao.set(null),
    );
  }

  aceitarConfirmado(): void {
    const tipo = this.tipoParaAceitar();
    if (tipo === null) return;
    const contexto = withIdempotencyKey(this.chaveDoAceite());
    this.gravar(
      'aceitando',
      this.api.aceitarRecomendacao(tipo.id, contexto),
      (result) => this.concluirAceite(tipo, result),
      () => this.erroAceite.set(null),
    );
  }

  private abrirFormulario(
    modo: ModoFormulario,
    id: string | null,
    valores: ValoresDoTipoDocumento,
    protecao: ProtecaoDoItem | null,
  ): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.modo.set(modo);
    this.tipoEmEdicaoId.set(id);
    this.protecaoOriginal.set(protecao);
    this.ligacaoDoCodigo.reiniciar();
    this.form.reset(valores);
    this.erro.set(null);
    this.recusaDoSalvamento.set('');
    this.renovarChave();
    this.aberto.set(true);
  }

  /** A única trava de gravação: com uma escrita (ou a recarga dela) em curso, nada parte nem se apaga. */
  private gravar<T>(
    tipo: Escrita,
    operacao: Observable<ApiResult<T>>,
    concluir: (result: ApiResult<T>) => void,
    aoIniciar: () => void = () => undefined,
  ): void {
    if (this.gravando()) return;
    aoIniciar();
    this.escrita.set(tipo);
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
    this.resultado.set(criado ? 'Tipo de documento criado.' : 'Tipo de documento atualizado.');
    this.notifications.success(
      criado ? 'Tipo de documento criado' : 'Tipo de documento atualizado',
    );
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(tipo: TipoDocumentoDto, result: ApiResult<void>): void {
    if (!result.ok) {
      this.erroRemocao.set(this.recusarConfirmacao(result.problem));
      return;
    }
    this.resultado.set(`Tipo de documento ${tipo.codigo} removido.`);
    this.notifications.success('Tipo de documento removido', tipo.codigo);
    this.confirmando.set(false);
    this.tipoParaRemover.set(null);
    this.recarregar();
  }

  private concluirAceite(tipo: TipoDocumentoDto, result: ApiResult<void>): void {
    if (result.ok) {
      this.resultado.set(`Recomendação do tipo de documento ${tipo.codigo} aceita.`);
      this.notifications.success('Recomendação aceita', tipo.codigo);
      this.confirmandoAceite.set(false);
      this.tipoParaAceitar.set(null);
      this.recarregar();
      return;
    }
    if (deveRotacionarIdempotencyKey(result.problem))
      this.chaveDoAceite.set(idempotencyKey.create());
    // A recusa pode vir de um item que mudou em outra sessão: a situação e a lista são relidas.
    this.erroAceite.set(this.recusarConfirmacao(result.problem));
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
    this.store.aprovacao.carregar();
    this.store.recarregar();
  }

  /**
   * Só o 409 de duplicidade pertence a um campo (o corpo não traz `errors[]`, então o código de
   * wire é o vínculo). Os demais conflitos (processamento da chave, concorrência) e o 404 não
   * dizem nada de um campo: a mensagem vai ao alerta.
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
