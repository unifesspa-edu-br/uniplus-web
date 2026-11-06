import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  COMPOSICAO_RETIRA_DE,
  COMPOSICAO_VAGAS_DEFAULT,
  ComposicaoVagasToken,
  ModalidadeDto,
  ModalidadesApi,
  NATUREZA_LEGAL_DEFAULT,
  NaturezaLegalToken,
} from '@uniplus/shared-data/configuracao';

import { EdicaoDaRegraDeAplicabilidade } from './edicao-da-regra-de-aplicabilidade';
import {
  Condicionais,
  RegraSelecao,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeModalidade,
  ehDaRegra,
  marcarCodigoRepetido,
  naturezaCompativelComRegra,
  reconciliarCondicionais,
  remanejamentoPreenchido,
  resumoCondicional,
  valoresDaModalidade,
} from './modalidade-form';
import { ModalidadeFormStore } from './modalidade-form.store';
import type { OpcaoDeReferencia } from './opcao-de-referencia';
import {
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
  MENSAGEM_SEM_MAPEAMENTO,
} from '../../shared/formulario';

const CODIGO_JA_EXISTE = 'uniplus.configuracao.modalidade.codigo_ja_existe';
const CORPO_DIVERGENTE = 'uniplus.idempotency.body_mismatch';
const ROTA_DA_LISTA = ['/modalidades'];

/**
 * A escrita da modalidade: o formulário (campos condicionais, confirmação ao trocar a natureza),
 * a gravação e as recusas do servidor. É a única dona do indicador `salvando`: enquanto uma
 * gravação corre, outra não parte.
 */
@Injectable()
export class EdicaoDaModalidade {
  private readonly api = inject(ModalidadesApi);
  private readonly store = inject(ModalidadeFormStore);
  private readonly router = inject(Router);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly aplicabilidade = inject(EdicaoDaRegraDeAplicabilidade);

  readonly form = criarFormularioDeModalidade();
  private readonly id = this.store.id;
  readonly modoEdicao = this.id !== null;
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  /** Sobe a cada envio e a cada recusa: é quando as seções reavaliam os erros e o foco procura o campo recusado. */
  readonly conferencias = signal(0);
  private chaveDeIdempotencia = idempotencyKey.create();

  readonly natureza = signal<NaturezaLegalToken>(NATUREZA_LEGAL_DEFAULT);
  private readonly composicao = signal<ComposicaoVagasToken>(COMPOSICAO_VAGAS_DEFAULT);
  private readonly regra = signal<RegraSelecao>('');
  readonly mostraRemanejamento = computed(() => this.natureza() !== 'AMPLA');
  readonly mostraOrigem = computed(() => this.composicao() === COMPOSICAO_RETIRA_DE);
  readonly mostraDestino = computed(() => this.regra() === 'DESTINO_UNICO');
  readonly mostraParFallback = computed(() => this.regra() === 'CRUZADO');

  /** A modalidade em edição, para não oferecer a si mesma como referência nem acusar o próprio código. */
  private readonly codigoAtual = signal<string | null>(null);
  readonly opcoesReferencia = computed<readonly OpcaoDeReferencia[]>(() =>
    this.store
      .opcoes()
      .filter((m) => m.codigo !== this.codigoAtual())
      .map((m) => ({
        value: m.codigo,
        label: m.descricao ? `${m.codigo} — ${m.descricao}` : m.codigo,
      })),
  );

  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  readonly resumo = computed(() => {
    this.valores();
    return resumoCondicional(this.condicionais(), this.form.getRawValue());
  });

  readonly confirmandoReset = signal(false);
  private naturezaAnterior: NaturezaLegalToken = NATUREZA_LEGAL_DEFAULT;
  private naturezaPendente: NaturezaLegalToken | null = null;

  constructor() {
    effect(() => {
      const modalidade = this.store.modalidade();
      // Só a chegada da modalidade preenche: ler as escolhas dentro do preenchimento refaria o efeito a cada troca.
      if (modalidade !== null) untracked(() => this.preencher(modalidade));
    });
    if (this.id === null) this.reconciliar();
  }

  private condicionais(): Condicionais {
    return { natureza: this.natureza(), composicao: this.composicao(), regra: this.regra() };
  }

  aoMudarComposicao(): void {
    this.composicao.set(this.form.controls.composicaoVagas.value);
    this.reconciliar();
  }

  aoMudarRegra(): void {
    this.regra.set(this.form.controls.regraRemanejamento.value);
    this.reconciliar();
  }

  aoMudarNatureza(): void {
    const nova = this.form.controls.naturezaLegal.value;
    if (nova === this.naturezaAnterior) return;
    const perderiaArgumentos =
      remanejamentoPreenchido(this.form.getRawValue()) &&
      !naturezaCompativelComRegra(nova, this.form.controls.regraRemanejamento.value);
    if (perderiaArgumentos) {
      this.naturezaPendente = nova;
      this.confirmandoReset.set(true);
      return;
    }
    this.aplicarNatureza(nova);
  }

  confirmarResetNatureza(): void {
    if (this.naturezaPendente !== null) this.aplicarNatureza(this.naturezaPendente);
    this.naturezaPendente = null;
    this.confirmandoReset.set(false);
  }

  /** Reverte a seleção para a natureza anterior, preservando os campos. */
  cancelarResetNatureza(): void {
    this.form.controls.naturezaLegal.setValue(this.naturezaAnterior, { emitEvent: false });
    this.natureza.set(this.naturezaAnterior);
    this.naturezaPendente = null;
    this.confirmandoReset.set(false);
  }

  verificarCodigoDuplicado(): void {
    if (this.modoEdicao) return;
    const control = this.form.controls.codigo;
    const codigo = control.value.trim();
    const repetido = codigo.length > 0 && this.store.opcoes().some((m) => m.codigo === codigo);
    marcarCodigoRepetido(control, repetido);
  }

  salvar(): void {
    this.erro.set(null);
    this.aplicabilidade.recusas.set([]);
    this.conferencias.update((n) => n + 1);
    descartarRecusasDoServidor(this.form);
    this.verificarCodigoDuplicado();
    const regraValida = this.aplicabilidade.conferir();
    if (this.form.invalid || !regraValida) {
      this.form.markAllAsTouched();
      return;
    }
    this.gravar(this.operacaoDeGravacao());
  }

  private operacaoDeGravacao(): Observable<ApiResult<string | void>> {
    const valores = this.form.getRawValue();
    const regra = this.aplicabilidade.paraOWire();
    const contexto = withIdempotencyKey(this.chaveDeIdempotencia);
    return this.id === null
      ? this.api.criar(comandoDeCriacao(valores, regra), contexto)
      : this.api.atualizar(this.id, comandoDeAtualizacao(this.id, valores, regra), contexto);
  }

  private gravar(operacao: Observable<ApiResult<string | void>>): void {
    if (this.salvando()) return;
    this.salvando.set(true);
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      this.salvando.set(false);
      this.concluirGravacao(result);
    });
  }

  private concluirGravacao(result: ApiResult<string | void>): void {
    if (!result.ok) {
      this.aplicarFalha(result.problem);
      this.conferencias.update((n) => n + 1);
      return;
    }
    this.notifications.success(
      this.modoEdicao ? 'Modalidade atualizada' : 'Modalidade criada',
      this.form.getRawValue().codigo,
    );
    this.renovarChave();
    void this.router.navigate(ROTA_DA_LISTA);
  }

  private aplicarFalha(problem: ProblemDetails): void {
    const errosDeCampo = problem.errors ?? [];
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && errosDeCampo.length > 0) {
      this.renovarChave();
      this.aplicarErrosDeValidacao(errosDeCampo);
      return;
    }
    // O código comparado é o do wire (`uniplus.<modulo>.<razao>`); o de domínio é chave de busca do servidor.
    if (problem.code === CODIGO_JA_EXISTE) {
      this.renovarChave();
      this.recusarCodigoRepetido(problem);
      return;
    }
    if (problem.code === CORPO_DIVERGENTE) this.renovarChave();
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  private recusarCodigoRepetido(problem: ProblemDetails): void {
    const control = this.form.controls.codigo;
    marcarRecusaDoServidor(control, problem.code, 'Código já utilizado por outra modalidade viva.');
    this.erro.set(null);
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    const recusasDaRegra: string[] = [];
    for (const erro of errors) {
      if (ehDaRegra(erro.field)) {
        recusasDaRegra.push(erro.message);
        aplicouAlgum = true;
      } else {
        aplicouAlgum = this.marcarControle(erro) || aplicouAlgum;
      }
    }
    this.aplicabilidade.recusas.set(recusasDaRegra);
    this.erro.set(aplicouAlgum ? null : MENSAGEM_SEM_MAPEAMENTO);
  }

  private marcarControle(erro: ProblemValidationError): boolean {
    const nome = controleDoCampoDoServidor(erro.field);
    if (nome === null) return false;
    const control = this.form.controls[nome];
    marcarRecusaDoServidor(control, erro.code, erro.message);
    return true;
  }

  private renovarChave(): void {
    this.chaveDeIdempotencia = idempotencyKey.create();
  }

  private aplicarNatureza(nova: NaturezaLegalToken): void {
    this.natureza.set(nova);
    this.naturezaAnterior = nova;
    this.reconciliar();
  }

  private reconciliar(): void {
    reconciliarCondicionais(this.form, this.natureza(), this.composicao());
    this.regra.set(this.form.controls.regraRemanejamento.value);
  }

  private preencher(dto: ModalidadeDto): void {
    const valores = valoresDaModalidade(dto);
    this.codigoAtual.set(dto.codigo);
    this.form.patchValue(valores, { emitEvent: false });
    this.aplicabilidade.carregar(dto);
    this.form.controls.codigo.disable({ emitEvent: false });
    this.natureza.set(valores.naturezaLegal);
    this.composicao.set(valores.composicaoVagas);
    this.naturezaAnterior = valores.naturezaLegal;
    this.reconciliar();
  }
}
