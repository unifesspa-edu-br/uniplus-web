import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import {
  ApiResult,
  type CausaDeCampo,
  type CausasDoProblema,
  ProblemDetails,
  ProblemI18nService,
  separarCausas,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  ComposicaoVagasCodigo,
  ModalidadeDto,
  ModalidadesApi,
  NaturezaLegalCodigo,
  RegraRemanejamentoCodigo,
} from '@uniplus/shared-data/configuracao';

import { VocabulariosDaModalidade } from './vocabularios-da-modalidade';
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
  textoDaAreaGeral,
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

  readonly vocabularios = inject(VocabulariosDaModalidade);
  readonly form = criarFormularioDeModalidade();
  private readonly id = this.store.id;
  readonly modoEdicao = this.id !== null;
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  /** Sobe a cada envio e a cada recusa: é quando as seções reavaliam os erros e o foco procura o campo recusado. */
  readonly conferencias = signal(0);
  private chaveDeIdempotencia = idempotencyKey.create();

  readonly natureza = signal<NaturezaLegalCodigo | ''>('');
  private readonly composicao = signal<ComposicaoVagasCodigo | ''>('');
  private readonly regra = signal<RegraSelecao>('');
  readonly mostraRemanejamento = computed(
    () => this.natureza() !== '' && this.natureza() !== NaturezaLegalCodigo.AMPLA,
  );
  readonly mostraOrigem = computed(
    () => this.composicao() === ComposicaoVagasCodigo.RETIRADA_DE_OUTRA_MODALIDADE,
  );
  readonly mostraDestino = computed(() => this.regra() === RegraRemanejamentoCodigo.DESTINO_UNICO);
  readonly mostraParFallback = computed(() => this.regra() === RegraRemanejamentoCodigo.CRUZADO);

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
    const rotulo =
      this.vocabularios.composicoes().find((item) => item.codigo === this.composicao())?.rotulo ??
      '';
    return resumoCondicional(this.condicionais(), this.form.getRawValue(), rotulo);
  });

  readonly confirmandoReset = signal(false);
  private naturezaAnterior: NaturezaLegalCodigo | '' = '';
  private naturezaPendente: NaturezaLegalCodigo | '' | null = null;

  constructor() {
    effect(() => {
      const modalidade = this.store.modalidade();
      // Só a chegada da modalidade preenche: ler as escolhas dentro do preenchimento refaria o efeito a cada troca.
      if (modalidade !== null) untracked(() => this.preencher(modalidade));
    });
    this.inicializarEscolhas();
  }

  private inicializarEscolhas(): void {
    effect(() => {
      const naturezas = this.vocabularios.naturezas();
      const composicoes = this.vocabularios.composicoes();
      if (this.id !== null) return;
      if (!this.form.controls.naturezaLegal.value && naturezas[0]) {
        this.form.controls.naturezaLegal.setValue(naturezas[0].codigo);
        this.aoMudarNatureza();
      }
      if (!this.form.controls.composicaoVagas.value && composicoes[0]) {
        this.form.controls.composicaoVagas.setValue(composicoes[0].codigo);
        this.aoMudarComposicao();
      }
    });
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
    const codigo = control.value;
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
    const regra = this.aplicabilidade.paraOContrato();
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
    if (this.recusarNoFormulario(problem)) {
      this.renovarChave();
      return;
    }
    if (problem.code === CORPO_DIVERGENTE) this.renovarChave();
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  /** Marca a recusa junto do campo ou da regra; diz se a recusa coube no formulário. */
  private recusarNoFormulario(problem: ProblemDetails): boolean {
    const errosDeCampo = problem.errors ?? [];
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && errosDeCampo.length > 0) {
      this.aplicarErrosDeValidacao(separarCausas(errosDeCampo));
      return true;
    }
    // O código comparado é o do wire (`uniplus.<modulo>.<razao>`); o de domínio é chave de busca do servidor.
    if (problem.code !== CODIGO_JA_EXISTE) return false;
    this.recusarCodigoRepetido(problem);
    return true;
  }

  private recusarCodigoRepetido(problem: ProblemDetails): void {
    const control = this.form.controls.codigo;
    marcarRecusaDoServidor(control, problem.code, 'Código já utilizado por outra modalidade viva.');
    this.erro.set(null);
  }

  private aplicarErrosDeValidacao(causas: CausasDoProblema): void {
    let aplicouAlgum = false;
    const recusasDaRegra: string[] = [];
    for (const erro of causas.deCampo) {
      if (ehDaRegra(erro.field)) {
        recusasDaRegra.push(erro.message);
        aplicouAlgum = true;
      } else {
        aplicouAlgum = this.marcarControle(erro) || aplicouAlgum;
      }
    }
    this.aplicabilidade.recusas.set(recusasDaRegra);
    this.erro.set(textoDaAreaGeral(aplicouAlgum, causas));
  }

  private marcarControle(erro: CausaDeCampo): boolean {
    const nome = controleDoCampoDoServidor(erro.field);
    if (nome === null) return false;
    const control = this.form.controls[nome];
    marcarRecusaDoServidor(control, erro.code, erro.message);
    return true;
  }

  private renovarChave(): void {
    this.chaveDeIdempotencia = idempotencyKey.create();
  }

  private aplicarNatureza(nova: NaturezaLegalCodigo | ''): void {
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
