import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { map } from 'rxjs';
import { ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  ProtecaoDoCatalogoApi,
  type DecidirProtecaoDoCatalogoRequest,
  type DecisaoDaProtecao,
  type DetalheDaProtecaoDoCatalogoDto,
  type ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { aguardarRecarga } from '../../shared/foco';
import { ProtecaoDoCatalogoStore } from './protecao-do-catalogo.store';
import {
  JUSTIFICATIVA_MAXIMA,
  justificativaPreenchida,
  recomendacoesPara,
  comandoPara,
  comandoDeJustificativa,
} from './decisao-da-protecao-form';

/** Recusas que dizem que o item já não está como a tela o mostrou: a fila é relida e a decisão se refaz. */
const RECUSAS_QUE_RELEEM_A_FILA: ReadonlySet<string> = new Set([
  'uniplus.configuracao.protecao_do_catalogo.item_fora_de_solicitacao',
  'uniplus.configuracao.protecao_do_catalogo.conflito_de_concorrencia',
  'uniplus.configuracao.protecao_do_catalogo.protecao_mudou',
  'uniplus.configuracao.fato_candidato.conflito_de_concorrencia',
  'uniplus.configuracao.tipo_documento.nao_encontrado',
  'uniplus.configuracao.fato_candidato.nao_encontrado',
]);

@Injectable()
export class EdicaoDaProtecaoDoCatalogo {
  private readonly api = inject(ProtecaoDoCatalogoApi);
  private readonly store = inject(ProtecaoDoCatalogoStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.erroDeCarga() !== null),
  );
  readonly detalheAberto = signal(false);
  readonly erroDaDecisao = signal<string | null>(null);
  readonly decidindo = signal(false);
  /** A decisão está sendo gravada ou a fila que a segue ainda é relida. */
  readonly gravando = computed(() => this.decidindo() || this.recarga.aguardando());
  readonly decisaoAberta = signal(false);
  readonly decisaoEmCurso = signal<DecisaoDaProtecao>('APROVAR');
  readonly erroDaDecisaoNoDialogo = signal<string | null>(null);
  readonly erroDaDecisaoNoDrawer = signal<string | null>(null);
  readonly tentouDecidir = signal(false);
  readonly recomendada = new FormControl('', { nonNullable: true });
  readonly justificativa = new FormControl('', { nonNullable: true });
  readonly tamanhoDaJustificativa = toSignal(
    this.justificativa.valueChanges.pipe(map((texto) => texto.length)),
    { initialValue: 0 },
  );

  /** A chave acompanha a intenção da decisão: repetir a mesma (rede, 5xx) reusa a chave; outra decisão ganha chave nova. */
  private chaveDaDecisao = idempotencyKey.create();
  private intencaoDaDecisao: string | null = null;

  readonly opcoesDaRecomendacao = computed(() => recomendacoesPara(this.store.detalhe()));

  /** O erro da justificativa só aparece depois da tentativa de decidir ou quando passa do limite digitado. */
  readonly erroDaJustificativa = computed<string | null>(() => {
    const tamanho = this.tamanhoDaJustificativa();
    if (tamanho > JUSTIFICATIVA_MAXIMA) return 'A justificativa aceita até 2.000 caracteres.';
    if (
      this.tentouDecidir() &&
      this.decisaoEmCurso() === 'REPROVAR' &&
      this.justificativa.invalid
    ) {
      return 'Informe a justificativa da reprovação.';
    }
    return null;
  });

  abrirDetalhe(item: ItemDaProtecaoDoCatalogoDto): void {
    if (this.decidindo()) return;
    this.erroDaDecisaoNoDrawer.set(null);
    this.detalheAberto.set(true);
    this.store.abrirDetalhe(item);
  }

  aprovar(): void {
    const item = this.store.detalhe();
    if (item === null || this.decidindo()) return;
    this.decisaoEmCurso.set('APROVAR');
    this.decidir(item, { ...comandoPara(item), decisao: 'APROVAR' }, 'Item aprovado');
  }

  abrirDecisao(decisao: Exclude<DecisaoDaProtecao, 'APROVAR'>): void {
    if (this.decidindo()) return;
    this.decisaoEmCurso.set(decisao);
    this.erroDaDecisaoNoDialogo.set(null);
    this.tentouDecidir.set(false);
    this.recomendada.reset('');
    this.justificativa.reset('');
    this.justificativa.setValidators(decisao === 'REPROVAR' ? [justificativaPreenchida] : []);
    this.justificativa.updateValueAndValidity();
    this.decisaoAberta.set(true);
  }

  confirmarDecisao(): void {
    const item = this.store.detalhe();
    if (item === null || this.decidindo()) return;
    this.tentouDecidir.set(true);
    const decisao = this.decisaoEmCurso();
    const justificativa = this.justificativa.value.trim();
    if (justificativa.length > JUSTIFICATIVA_MAXIMA) return;
    if (decisao === 'RECOMENDAR_AJUSTE' && this.recomendada.value === '') {
      this.recomendada.setErrors({ required: true });
      return;
    }
    if (decisao === 'REPROVAR' && justificativa.length === 0) return;
    const comando = comandoDeJustificativa(item, decisao, justificativa, this.recomendada.value);
    this.decidir(item, comando, decisao === 'REPROVAR' ? 'Item reprovado' : 'Ajuste recomendado');
  }

  fecharDetalhe(): void {
    if (!this.decidindo()) this.detalheAberto.set(false);
  }

  fecharDecisao(): void {
    if (!this.decidindo()) this.decisaoAberta.set(false);
  }

  /**
   * Registra a decisão. No sucesso o item sai da fila e o drawer fecha. Na recusa a mensagem da API
   * fica junto de onde a decisão foi tomada; quando a proteção mudou ou outra gravação venceu, a fila
   * é relida, porque repetir a mesma decisão não dá certo.
   */
  private decidir(
    item: DetalheDaProtecaoDoCatalogoDto,
    comando: DecidirProtecaoDoCatalogoRequest,
    sucesso: string,
  ): void {
    this.decidindo.set(true);
    this.erroDaDecisao.set(null);
    this.erroDaDecisaoNoDrawer.set(null);
    this.erroDaDecisaoNoDialogo.set(null);
    this.api
      .decidir(comando, withIdempotencyKey(this.chaveDaIntencao(comando)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.decidindo.set(false);
        if (resultado.ok) {
          this.intencaoDaDecisao = null;
          this.notifications.success(sucesso, item.nome);
          this.decisaoAberta.set(false);
          this.detalheAberto.set(false);
          this.relerAFila();
          return;
        }
        if (deveRotacionarIdempotencyKey(resultado.problem)) this.intencaoDaDecisao = null;
        this.recusar(resultado.problem);
      });
  }

  private chaveDaIntencao(comando: DecidirProtecaoDoCatalogoRequest): string {
    const intencao = JSON.stringify(comando);
    if (intencao !== this.intencaoDaDecisao) {
      this.chaveDaDecisao = idempotencyKey.create();
      this.intencaoDaDecisao = intencao;
    }
    return this.chaveDaDecisao;
  }

  private recusar(problem: ProblemDetails): void {
    const mensagem = this.problemI18n.resolve(problem).title;
    if (!RECUSAS_QUE_RELEEM_A_FILA.has(problem.code)) {
      this.mostrarRecusa(mensagem, problem);
      return;
    }
    this.decisaoAberta.set(false);
    this.detalheAberto.set(false);
    this.erroDaDecisao.set(`${mensagem}. A lista foi atualizada; confira o item e decida de novo.`);
    this.relerAFila();
  }

  private relerAFila(): void {
    this.recarga.iniciar();
    this.store.carregar();
  }

  private mostrarRecusa(mensagem: string, problem: ProblemDetails): void {
    if (this.decisaoEmCurso() === 'APROVAR') this.erroDaDecisaoNoDrawer.set(mensagem);
    else this.erroDaDecisaoNoDialogo.set(mensagem);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem, { title: mensagem });
  }
}
