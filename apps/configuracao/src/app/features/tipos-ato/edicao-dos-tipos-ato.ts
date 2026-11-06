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
import { TipoAtoPublicadoDto, TiposAtoApi } from '@uniplus/shared-data/publicacoes';
import { formatIsoDateBr } from '@uniplus/shared-data/utils';
import { aguardarRecarga } from '../../shared/foco';
import {
  AtoForm,
  ValoresDoAto,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeAto,
  normalizarCaixaDoCodigo,
  valoresDoAto,
  valoresEmBrancoDoAto,
} from './tipo-ato-form';
import { TiposAtoStore } from './tipos-ato.store';
import {
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
  marcarRecusasDosCampos,
  MENSAGEM_SEM_MAPEAMENTO,
} from '../../shared/formulario';

/** Vendor code do DomainError `TipoAtoPublicado.VigenciaSobreposta` (409 em POST e PUT, sem `errors[]`). */
const VIGENCIA_SOBREPOSTA = 'uniplus.publicacoes.tipo_ato.vigencia_sobreposta';

const ORIENTACAO_DA_SOBREPOSICAO =
  'Já existe uma vigência deste código cobrindo parte deste período. Encerre a anterior ou escolha outro início.';

type Escrita = 'salvando' | 'removendo';
type ModoFormulario = 'criar' | 'editar';

/** Nomeia a vigência pelo código e pelo início: o mesmo código ocupa várias linhas da série. */
function descricaoDaVigencia(ato: TipoAtoPublicadoDto): string {
  return `${ato.codigo} iniciada em ${formatIsoDateBr(ato.vigenciaInicio)}`;
}

/**
 * Todas as escritas da tela de tipos de ato: o formulário, o salvamento e a remoção de vigência
 * com confirmação. É a única dona do indicador de gravação, então uma escrita impede a outra.
 */
@Injectable()
export class EdicaoDosTiposAto {
  private readonly api = inject(TiposAtoApi);
  private readonly store = inject(TiposAtoStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDeAto();
  private readonly escrita = signal<Escrita | null>(null);
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  /** Inclui a espera pela recarga: a lista só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.escrita() !== null || this.recarga.aguardando());
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');

  readonly aberto = signal(false);
  readonly modo = signal<ModoFormulario>('criar');
  readonly erro = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly erroRemocao = signal<string | null>(null);
  private readonly atoEmEdicaoId = signal<string | null>(null);
  private readonly atoParaRemover = signal<TipoAtoPublicadoDto | null>(null);
  private readonly recusaDoSalvamento = signal('');
  private readonly resultado = signal('');
  private readonly chave = signal(idempotencyKey.create());

  readonly tituloDoFormulario = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de ato' : 'Editar tipo de ato',
  );
  readonly mensagemDaConfirmacao = computed(() => {
    const ato = this.atoParaRemover();
    return ato
      ? `Deseja remover a vigência de ${ato.codigo} iniciada em ${formatIsoDateBr(ato.vigenciaInicio)}? Atos já publicados não são afetados — eles copiaram por valor o que precisavam.`
      : 'Deseja remover esta vigência?';
  });
  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const ato = this.atoParaRemover();
    if (ato === null) return '';
    if (this.removendo()) return `Removendo a vigência ${descricaoDaVigencia(ato)}.`;
    const motivo = this.erroRemocao();
    return motivo
      ? `Não foi possível remover a vigência ${descricaoDaVigencia(ato)}. ${motivo}`
      : '';
  });
  /** Dentro do drawer: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando tipo de ato.' : this.recusaDoSalvamento(),
  );
  /** Na página: o desfecho, anunciado quando nenhuma sobreposição está aberta para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmando() || this.aberto() ? '' : this.resultado(),
  );

  constructor() {
    normalizarCaixaDoCodigo(this.form, () => this.modo() === 'criar');
  }

  abrirCadastro(): void {
    this.abrirFormulario('criar', null, valoresEmBrancoDoAto());
  }

  abrirEdicao(ato: TipoAtoPublicadoDto): void {
    this.abrirFormulario('editar', ato.id, valoresDoAto(ato));
  }

  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }

  pedirRemocao(ato: TipoAtoPublicadoDto): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.erroRemocao.set(null);
    this.atoParaRemover.set(ato);
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
    const id = this.atoEmEdicaoId();
    const modo = this.modo();
    // Idempotency-Key só no POST: a ADR-0027 dispensa PUT puro, e a rota não declara o header.
    const operacao: Observable<ApiResult<string | void>> =
      id === null
        ? this.api.criar(comandoDeCriacao(this.form), withIdempotencyKey(this.chave()))
        : this.api.atualizar(id, comandoDeAtualizacao(id, this.form));
    this.gravar('salvando', operacao, (result) => this.concluirSalvamento(result, modo));
  }

  removerConfirmado(): void {
    const ato = this.atoParaRemover();
    if (ato === null) return;
    this.erroRemocao.set(null);
    this.gravar('removendo', this.api.remover(ato.id), (result) =>
      this.concluirRemocao(ato, result),
    );
  }

  private abrirFormulario(modo: ModoFormulario, id: string | null, valores: ValoresDoAto): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.modo.set(modo);
    this.atoEmEdicaoId.set(id);
    this.form.reset(valores);
    this.erro.set(null);
    this.recusaDoSalvamento.set('');
    this.renovarChave();
    this.aberto.set(true);
  }

  private gravar<T>(
    tipo: Escrita,
    operacao: Observable<ApiResult<T>>,
    concluir: (result: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) return;
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
    this.resultado.set(criado ? 'Tipo de ato cadastrado.' : 'Tipo de ato atualizado.');
    this.notifications.success(criado ? 'Tipo de ato cadastrado' : 'Tipo de ato atualizado');
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(ato: TipoAtoPublicadoDto, result: ApiResult<void>): void {
    if (!result.ok) {
      const titulo = this.problemI18n.resolve(result.problem).title;
      this.erroRemocao.set(titulo);
      if (result.problem.status >= 500) {
        this.notifications.errorFromProblem(result.problem, { title: titulo });
      }
      return;
    }
    this.resultado.set(`Vigência ${descricaoDaVigencia(ato)} removida.`);
    this.notifications.success('Vigência removida', ato.codigo);
    this.confirmando.set(false);
    this.atoParaRemover.set(null);
    this.recarregar();
  }

  private recarregar(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }

  /**
   * A política de rotação da chave é do contrato: a API guarda a resposta de qualquer status
   * abaixo de 500 contra o hash do corpo, e `processing_conflict` é a exceção que pede retry do
   * mesmo comando com a mesma chave. A sobreposição de vigência é um 409 único, sem `errors[]`:
   * a orientação vai ao alerta, pois ela não pertence a um campo só.
   */
  private aplicarFalha(problem: ProblemDetails): void {
    if (deveRotacionarIdempotencyKey(problem)) this.renovarChave();
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    this.erro.set(
      problem.code === VIGENCIA_SOBREPOSTA
        ? ORIENTACAO_DA_SOBREPOSICAO
        : this.problemI18n.resolve(problem).title,
    );
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    const aplicou = marcarRecusasDosCampos(errors, this.form, controleDoCampoDoServidor);
    this.erro.set(aplicou ? null : MENSAGEM_SEM_MAPEAMENTO);
  }

  private marcarCampo(nome: keyof AtoForm, code: string, message: string): void {
    const controle = this.form.controls[nome];
    marcarRecusaDoServidor(controle, code, message);
  }

  private renovarChave(): void {
    this.chave.set(idempotencyKey.create());
  }
}
