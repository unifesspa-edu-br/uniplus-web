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
  BaseLegalBonusRegionalApi,
  BaseLegalBonusRegionalDto,
  BaseLegalBonusRegionalMunicipioDto,
} from '@uniplus/shared-data/configuracao';
import { aguardarRecarga } from '../../shared/foco';
import {
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
  MENSAGEM_SEM_MAPEAMENTO,
  nullIfBlank,
} from '../../shared/formulario';
import { BaseLegalBonusRegionalStore } from './base-legal-bonus-regional.store';
import {
  CampoDoServidor,
  ValoresDaBaseLegal,
  campoDoServidor,
  comandoDeAtualizacao,
  comandoDeCriacao,
  criarFormularioDeBaseLegal,
  valoresDaBaseLegal,
  valoresEmBrancoDaBaseLegal,
} from './base-legal-form';
import { MunicipiosDaBaseLegal } from './municipios-da-base-legal';
import { TiposDeInstrumento } from './tipos-de-instrumento';

type Escrita = 'salvando' | 'removendo';
type ModoFormulario = 'criar' | 'editar';

/**
 * Todas as escritas da tela de bases legais: o formulário, o salvamento e a remoção com
 * confirmação. É a única dona do indicador de gravação, então uma escrita impede a outra.
 */
@Injectable()
export class EdicaoDasBasesLegais {
  private readonly api = inject(BaseLegalBonusRegionalApi);
  private readonly store = inject(BaseLegalBonusRegionalStore);
  private readonly tipos = inject(TiposDeInstrumento);
  private readonly municipios = inject(MunicipiosDaBaseLegal);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDeBaseLegal();
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
  private readonly baseEmEdicaoId = signal<string | null>(null);
  private readonly baseParaRemover = signal<BaseLegalBonusRegionalDto | null>(null);
  private readonly recusaDoSalvamento = signal('');
  private readonly resultado = signal('');
  private readonly chave = signal(idempotencyKey.create());

  readonly tituloDoFormulario = computed(() =>
    this.modo() === 'criar' ? 'Nova base legal' : 'Editar base legal',
  );
  readonly mensagemDaConfirmacao = computed(() => {
    const base = this.baseParaRemover();
    return base
      ? `Tem certeza que deseja remover "${base.identificacao}"? Processos que já a referenciam mantêm o snapshot congelado.`
      : 'Tem certeza que deseja remover esta base legal?';
  });
  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const base = this.baseParaRemover();
    if (base === null) return '';
    if (this.removendo()) return `Removendo a base legal ${base.identificacao}.`;
    const motivo = this.erroRemocao();
    return motivo ? `Não foi possível remover a base legal ${base.identificacao}. ${motivo}` : '';
  });
  /** Dentro do drawer: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando base legal.' : this.recusaDoSalvamento(),
  );
  /** Na página: o desfecho, anunciado quando nenhuma sobreposição está aberta para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmando() || this.aberto() ? '' : this.resultado(),
  );

  abrirCadastro(): void {
    this.abrirFormulario('criar', null, valoresEmBrancoDaBaseLegal(), []);
  }

  abrirEdicao(base: BaseLegalBonusRegionalDto): void {
    this.abrirFormulario('editar', base.id, valoresDaBaseLegal(base), base.municipios);
  }

  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }

  pedirRemocao(base: BaseLegalBonusRegionalDto): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.erroRemocao.set(null);
    this.baseParaRemover.set(base);
    this.confirmando.set(true);
  }

  salvar(): void {
    this.erro.set(null);
    this.recusaDoSalvamento.set('');
    descartarRecusasDoServidor(this.form);
    this.municipios.descartarRecusa();
    this.municipios.exigir();
    if (this.form.invalid || this.municipios.vazia()) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.baseEmEdicaoId();
    const modo = this.modo();
    const contexto = withIdempotencyKey(this.chave());
    const operacao: Observable<ApiResult<string | void>> =
      id === null
        ? this.api.criar(comandoDeCriacao(this.form, this.municipios.itens()), contexto)
        : this.api.atualizar(
            id,
            comandoDeAtualizacao(id, this.form, this.municipios.itens()),
            contexto,
          );
    this.gravar('salvando', operacao, (result) => this.concluirSalvamento(result, modo));
  }

  removerConfirmado(): void {
    const base = this.baseParaRemover();
    if (base === null) return;
    this.erroRemocao.set(null);
    this.gravar('removendo', this.api.remover(base.id), (result) =>
      this.concluirRemocao(base, result),
    );
  }

  private abrirFormulario(
    modo: ModoFormulario,
    id: string | null,
    valores: ValoresDaBaseLegal,
    municipios: readonly BaseLegalBonusRegionalMunicipioDto[],
  ): void {
    if (this.gravando()) return;
    this.resultado.set('');
    this.modo.set(modo);
    this.baseEmEdicaoId.set(id);
    this.form.reset(valores);
    this.municipios.carregar(municipios);
    this.tipos.preparar(nullIfBlank(valores.tipoInstrumento));
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
    const criada = modo === 'criar';
    this.resultado.set(criada ? 'Base legal criada.' : 'Base legal atualizada.');
    this.notifications.success(criada ? 'Base legal criada' : 'Base legal atualizada');
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(base: BaseLegalBonusRegionalDto, result: ApiResult<void>): void {
    if (!result.ok) {
      const titulo = this.problemI18n.resolve(result.problem).title;
      this.erroRemocao.set(titulo);
      if (result.problem.status >= 500) {
        this.notifications.errorFromProblem(result.problem, { title: titulo });
      }
      return;
    }
    this.resultado.set(`Base legal ${base.identificacao} removida.`);
    this.notifications.success('Base legal removida', base.identificacao);
    this.confirmando.set(false);
    this.baseParaRemover.set(null);
    this.recarregar();
  }

  private recarregar(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }

  /**
   * A política de rotação da chave é do contrato: a API guarda a resposta de qualquer status
   * abaixo de 500 contra o hash do corpo, e `processing_conflict` é a exceção que pede retry do
   * mesmo comando com a mesma chave. A base legal não tem 409 de duplicidade: o conflito de
   * processamento e as demais recusas sem campo vão ao alerta.
   */
  private aplicarFalha(problem: ProblemDetails): void {
    if (deveRotacionarIdempotencyKey(problem)) this.renovarChave();
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    for (const recusa of errors) {
      const campo = campoDoServidor(recusa.field);
      if (campo === null) continue;
      this.marcarCampo(campo, recusa);
      aplicouAlgum = true;
    }
    this.erro.set(aplicouAlgum ? null : MENSAGEM_SEM_MAPEAMENTO);
  }

  private marcarCampo(campo: CampoDoServidor, recusa: ProblemValidationError): void {
    if (campo === 'municipios') {
      this.municipios.recusar(recusa.message);
      return;
    }
    const controle = this.form.controls[campo];
    marcarRecusaDoServidor(controle, recusa.code, recusa.message);
  }

  private renovarChave(): void {
    this.chave.set(idempotencyKey.create());
  }
}
