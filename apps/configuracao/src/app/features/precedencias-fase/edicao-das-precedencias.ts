import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { merge, Observable } from 'rxjs';
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
import { PrecedenciaFaseDto, PrecedenciasFaseApi } from '@uniplus/shared-data/configuracao';
import { aguardarRecarga } from '../../shared/foco';
import {
  CAMPO_DO_CODIGO_ISOLADO,
  CODIGOS_ERRO_DO_PAR,
  ERRO_NAO_ENCONTRADA,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDePrecedencia,
  descartarErroDoPar,
  valoresDaPrecedencia,
  valoresEmBrancoDaPrecedencia,
} from './precedencia-form';
import { PrecedenciasFaseStore } from './precedencias-fase.store';

type Escrita = 'salvando' | 'removendo';
type ModoFormulario = 'criar' | 'editar';

/** A aresta que a escrita em curso afeta e o que a linha dela mostra enquanto isso. */
export interface AndamentoDaEscrita {
  readonly id: string;
  readonly rotulo: string;
}

const ROTULO_DA_ESCRITA: Record<Escrita, string> = {
  salvando: 'Salvando...',
  removendo: 'Removendo...',
};

const descreverAresta = (aresta: PrecedenciaFaseDto): string =>
  `${aresta.antecessoraCodigo} → ${aresta.sucessoraCodigo}`;

/**
 * Todas as escritas da tela de precedência de fase: o formulário, o salvamento e a remoção com
 * confirmação. É a única dona do indicador de gravação, então uma escrita impede a outra.
 */
@Injectable()
export class EdicaoDasPrecedencias {
  private readonly api = inject(PrecedenciasFaseApi);
  private readonly store = inject(PrecedenciasFaseStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDePrecedencia();
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
  private readonly arestaEmEdicaoId = signal<string | null>(null);
  private readonly arestaParaRemover = signal<PrecedenciaFaseDto | null>(null);
  private readonly recusaDoSalvamento = signal('');
  private readonly resultadoDoSalvamento = signal('');
  private readonly resultadoDaRemocao = signal('');
  private readonly chave = signal(idempotencyKey.create());
  private readonly linhaPerdida = signal(false);

  /**
   * A aresta que a pessoa acionou deixou a lista com a sobreposição ainda aberta: ao fechá-la, o
   * foco do navegador volta a um botão que já não existe e iria ao `body`. `true` quando a
   * sobreposição já fechou e a lista terminou de recarregar, momento de levar o foco ao título.
   */
  readonly devolverFocoAoTitulo = computed(
    () => this.linhaPerdida() && !this.aberto() && !this.confirmando() && !this.gravando(),
  );

  readonly tituloDoFormulario = computed(() =>
    this.modo() === 'criar' ? 'Nova aresta de precedência' : 'Editar aresta',
  );
  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const aresta = this.arestaParaRemover();
    if (!aresta) return '';
    if (this.removendo()) return `Removendo a aresta ${descreverAresta(aresta)}.`;
    const motivo = this.erroRemocao();
    return motivo ? `Não foi possível remover a aresta ${descreverAresta(aresta)}. ${motivo}` : '';
  });
  /** Dentro do drawer: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando aresta de precedência.' : this.recusaDoSalvamento(),
  );
  /** Na página: o desfecho, anunciado quando nenhuma sobreposição está aberta para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmando() || this.aberto()
      ? ''
      : this.resultadoDaRemocao() || this.resultadoDoSalvamento(),
  );
  readonly mensagemDaConfirmacao = computed(() => {
    const aresta = this.arestaParaRemover();
    return aresta
      ? `Deseja remover a aresta de ${aresta.antecessoraCodigo} para ${aresta.sucessoraCodigo}? Cronogramas já publicados não são afetados — a ordem vigente neles foi congelada por snapshot no momento da publicação.`
      : 'Deseja remover esta aresta de precedência?';
  });

  constructor() {
    merge(
      this.form.controls.antecessoraCodigo.valueChanges,
      this.form.controls.sucessoraCodigo.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => descartarErroDoPar(this.form));
  }

  abrirCadastro(): void {
    this.abrirFormulario('criar', null, valoresEmBrancoDaPrecedencia());
  }

  abrirEdicao(aresta: PrecedenciaFaseDto): void {
    this.abrirFormulario('editar', aresta.id, valoresDaPrecedencia(aresta));
  }

  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }

  pedirRemocao(aresta: PrecedenciaFaseDto): void {
    if (this.gravando()) return;
    this.linhaPerdida.set(false);
    this.limparResultados();
    this.erroRemocao.set(null);
    this.arestaParaRemover.set(aresta);
    this.confirmando.set(true);
  }

  focoDevolvidoAoTitulo(): void {
    this.linhaPerdida.set(false);
  }

  salvar(): void {
    if (this.gravando()) return;
    this.erro.set(null);
    this.recusaDoSalvamento.set('');
    this.descartarRecusasDoServidor();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.arestaEmEdicaoId();
    const modo = this.modo();
    const contexto = withIdempotencyKey(this.chave());
    const operacao: Observable<ApiResult<string | void>> =
      id === null
        ? this.api.criar(comandoDeCriacao(this.form), contexto)
        : this.api.atualizar(id, comandoDeAtualizacao(id, this.form), contexto);
    this.gravar('salvando', id, operacao, (result) => this.concluirSalvamento(result, modo));
  }

  removerConfirmado(): void {
    const aresta = this.arestaParaRemover();
    if (!aresta || this.gravando()) return;
    this.erroRemocao.set(null);
    this.gravar('removendo', aresta.id, this.api.remover(aresta.id), (result) =>
      this.concluirRemocao(aresta, result),
    );
  }

  private abrirFormulario(
    modo: ModoFormulario,
    id: string | null,
    valores: ReturnType<typeof valoresEmBrancoDaPrecedencia>,
  ): void {
    if (this.gravando()) return;
    this.linhaPerdida.set(false);
    this.limparResultados();
    this.modo.set(modo);
    this.arestaEmEdicaoId.set(id);
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
    this.resultadoDoSalvamento.set(criado ? 'Aresta criada.' : 'Aresta atualizada.');
    this.notifications.success(criado ? 'Aresta criada' : 'Aresta atualizada');
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(aresta: PrecedenciaFaseDto, result: ApiResult<void>): void {
    if (!result.ok) {
      this.recusarRemocao(result.problem);
      return;
    }
    this.resultadoDaRemocao.set(`Aresta ${descreverAresta(aresta)} removida.`);
    this.notifications.success('Aresta removida', descreverAresta(aresta));
    this.confirmando.set(false);
    this.arestaParaRemover.set(null);
    this.recarregar();
  }

  /** A aresta removida por outra pessoa já não existe: a lista recarrega para refletir isso. */
  private recusarRemocao(problem: ProblemDetails): void {
    const titulo = this.problemI18n.resolve(problem).title;
    this.erroRemocao.set(titulo);
    if (ausente(problem)) this.recarregarSemALinha();
    if (problem.status >= 500) this.notifications.errorFromProblem(problem, { title: titulo });
  }

  /** A aresta já não existe: a recarga a tira da lista, com a sobreposição ainda aberta. */
  private recarregarSemALinha(): void {
    this.linhaPerdida.set(true);
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
    if (deveRotacionarIdempotencyKey(problem)) this.renovarChave();
    if (this.aplicarRecusaDoGrafo(problem)) return;
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  /**
   * DomainError não traz `errors[]` (só o pipeline de validação traz): as recusas do grafo são
   * reconhecidas pelo `code`. Devolve se tratou a recusa.
   */
  private aplicarRecusaDoGrafo(problem: ProblemDetails): boolean {
    if (ausente(problem)) {
      this.recarregarSemALinha();
      this.erro.set(this.problemI18n.resolve(problem).title);
      return true;
    }
    const controle = this.controleDaRecusa(problem.code);
    if (controle === null) return false;
    this.marcarRecusa(controle, problem.code, this.problemI18n.resolve(problem).title);
    return true;
  }

  private controleDaRecusa(code: string): AbstractControl | null {
    if (CODIGOS_ERRO_DO_PAR.has(code)) return this.form.controls.sucessoraCodigo;
    const campo = CAMPO_DO_CODIGO_ISOLADO.get(code);
    return campo === undefined ? null : this.form.controls[campo];
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    for (const erro of errors) {
      const nome = controleDoCampoDoServidor(erro.field);
      if (nome === null) continue;
      this.marcarRecusa(this.form.controls[nome], erro.code, erro.message);
      aplicouAlgum = true;
    }
    this.erro.set(
      aplicouAlgum ? null : 'Não foi possível mapear os erros de validação. Revise os campos.',
    );
  }

  private marcarRecusa(controle: AbstractControl, code: string, message: string): void {
    controle.setErrors({ backend: { code, message } });
    controle.markAsTouched();
  }

  /** A recusa do servidor vale para o envio que a causou: ao reenviar, só a validação local barra. */
  private descartarRecusasDoServidor(): void {
    for (const controle of Object.values(this.form.controls)) controle.updateValueAndValidity();
  }

  private renovarChave(): void {
    this.chave.set(idempotencyKey.create());
  }
}

function ausente(problem: ProblemDetails): boolean {
  return problem.code === ERRO_NAO_ENCONTRADA || problem.status === STATUS_HTTP.NAO_ENCONTRADO;
}
