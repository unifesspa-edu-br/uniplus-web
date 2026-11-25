import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  STATUS_HTTP,
  recusasDoProblema,
} from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { ModeloFormularioView, ModelosFormularioApi } from '@uniplus/shared-data/configuracao';
import { sugerirCodigoDeCadastro } from '@uniplus/shared-utils';
import { campoDaRecusa, comandoDeCriacao, criarFormularioDeModelo } from './modelo-formulario-form';
import { ModelosFormularioStore } from './modelos-formulario.store';
import {
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
  marcarRecusasDosCampos,
  textoDaCausaGeral,
} from '../../shared/formulario';

/** O código do modelo já existe — código de modelo nunca se reutiliza. */
const CODIGO_JA_EXISTE = 'uniplus.configuracao.modelo_formulario.codigo_ja_existe';
const REVISE_OS_CAMPOS = 'Revise os campos indicados.';

@Injectable()
export class EdicaoDosModelosFormulario {
  private readonly api = inject(ModelosFormularioApi);
  private readonly router = inject(Router);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(ModelosFormularioStore);
  readonly drawerAberto = signal(false);
  private readonly escrita = signal<'salvando' | 'situacao' | null>(null);
  private readonly aguardandoRecarga = signal(false);
  /** Inclui a espera pela recarga: a lista só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.escrita() !== null || this.aguardandoRecarga());
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly erroDaCriacao = signal<string | null>(null);
  private readonly recusaDaCriacao = signal('');
  /** Dentro do drawer: o andamento e a recusa de campo, que só fazem sentido com ele aberto. */
  readonly anuncioDaCriacao = computed(() =>
    this.salvando() ? 'Criando o modelo.' : this.recusaDaCriacao(),
  );
  readonly emAndamento = signal<string | null>(null);
  readonly anuncioDaSituacao = signal('');
  private chaveDaCriacao = idempotencyKey.create();
  private ultimaSugestao = '';
  readonly form = criarFormularioDeModelo();

  constructor() {
    this.form.controls.nome.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((nome) => this.sugerirCodigo(nome));
    this.acompanharRecarga();
  }

  abrirCriacao(): void {
    if (this.gravando()) return;
    this.form.reset();
    this.erroDaCriacao.set(null);
    this.recusaDaCriacao.set('');
    this.ultimaSugestao = '';
    this.chaveDaCriacao = idempotencyKey.create();
    this.drawerAberto.set(true);
  }

  fechar(visivel: boolean): void {
    if (!this.salvando()) this.drawerAberto.set(visivel);
  }

  criar(): void {
    if (this.gravando()) return;
    descartarRecusasDoServidor(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviarCriacao();
  }

  private enviarCriacao(): void {
    this.escrita.set('salvando');
    this.erroDaCriacao.set(null);
    this.recusaDaCriacao.set('');
    const codigo = this.form.controls.codigo.value;
    this.api
      .criar(comandoDeCriacao(this.form), withIdempotencyKey(this.chaveDaCriacao))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.escrita.set(null);
        if (resultado.ok) this.abrirModeloCriado(resultado.data, codigo);
        else this.aplicarFalha(resultado.problem);
      });
  }

  private abrirModeloCriado(id: string, codigo: string): void {
    this.notifications.success('Modelo criado', codigo);
    this.drawerAberto.set(false);
    void this.router.navigate(['/modelos-formulario', id]);
  }

  desativar(modelo: ModeloFormularioView): void {
    if (this.gravando()) return;
    this.escrita.set('situacao');
    this.emAndamento.set(modelo.id);
    this.anuncioDaSituacao.set(`Desativando o modelo ${modelo.codigo}.`);
    this.api
      .desativar(modelo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => this.aoTrocarSituacao(resultado, 'Modelo desativado', modelo));
  }

  ativar(modelo: ModeloFormularioView): void {
    if (this.gravando()) return;
    this.escrita.set('situacao');
    this.emAndamento.set(modelo.id);
    this.anuncioDaSituacao.set(`Ativando o modelo ${modelo.codigo}.`);
    this.api
      .ativar(modelo.id, withIdempotencyKey(idempotencyKey.create()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => this.aoTrocarSituacao(resultado, 'Modelo ativado', modelo));
  }

  private aoTrocarSituacao(
    resultado: ApiResult<void>,
    mensagem: string,
    modelo: ModeloFormularioView,
  ): void {
    this.escrita.set(null);
    if (resultado.ok) {
      this.concluirTrocaDeSituacao(mensagem, modelo);
      return;
    }
    this.recusarTrocaDeSituacao(resultado.problem, modelo);
  }

  private concluirTrocaDeSituacao(mensagem: string, modelo: ModeloFormularioView): void {
    this.anuncioDaSituacao.set(`${mensagem}: ${modelo.codigo}.`);
    this.notifications.success(mensagem, modelo.codigo);
    this.aguardandoRecarga.set(true);
    this.store.recarregar();
  }

  private recusarTrocaDeSituacao(problem: ProblemDetails, modelo: ModeloFormularioView): void {
    this.emAndamento.set(null);
    this.anuncioDaSituacao.set(`Não foi possível alterar a situação do modelo ${modelo.codigo}.`);
    this.notifications.errorFromProblem(problem, {
      title: this.problemI18n.resolve(problem).title,
    });
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (deveRotacionarIdempotencyKey(problem)) {
      this.chaveDaCriacao = idempotencyKey.create();
    }
    const geral = textoDaCausaGeral(problem);
    if (this.marcouCampo(problem)) {
      this.recusaDaCriacao.set(REVISE_OS_CAMPOS);
      if (geral !== null) this.erroDaCriacao.set(geral);
      return;
    }
    this.erroDaCriacao.set(geral ?? this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  /** Marca o campo que a recusa aponta, pelo código do modelo ou pelas causas; diz se algum foi marcado. */
  private marcouCampo(problem: ProblemDetails): boolean {
    if (problem.code === CODIGO_JA_EXISTE) {
      marcarRecusaDoServidor(
        this.form.controls.codigo,
        problem.code,
        this.problemI18n.resolve(problem).title,
      );
      return true;
    }
    if (problem.status !== STATUS_HTTP.RECUSA_DE_NEGOCIO) return false;
    return marcarRecusasDosCampos(recusasDoProblema(problem).deCampo, this.form, campoDaRecusa);
  }

  /** A linha mantém o andamento até a lista recarregada chegar, ou falhar. */
  private acompanharRecarga(): void {
    let iniciou = false;
    effect(() => {
      if (!this.aguardandoRecarga()) {
        iniciou = false;
        return;
      }
      if (this.store.carregando()) iniciou = true;
      else if (iniciou || this.store.mensagemDeErro()) {
        this.aguardandoRecarga.set(false);
        this.emAndamento.set(null);
      }
    });
  }

  /** A sugestão de código acompanha o nome até o administrador escrever outro código. */
  private sugerirCodigo(nome: string): void {
    const atual = this.form.controls.codigo.value;
    if (atual !== '' && atual !== this.ultimaSugestao) return;
    this.ultimaSugestao = sugerirCodigoDeCadastro(nome);
    this.form.controls.codigo.setValue(this.ultimaSugestao, { emitEvent: false });
    if (this.form.controls.codigo.hasError('maxlength')) this.form.controls.codigo.markAsDirty();
  }
}
