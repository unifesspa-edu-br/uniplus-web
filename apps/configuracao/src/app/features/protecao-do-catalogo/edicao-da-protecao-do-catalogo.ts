import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { map, type Observable } from 'rxjs';
import { ProblemDetails, ProblemI18nService, type ApiResult } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  ProtecaoDoCatalogoApi,
  type DecidirProtecaoDoCatalogoRequest,
  type DecisaoDaProtecao,
  type DetalheDaProtecaoDoCatalogoDto,
  type ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { contarCaracteres } from '@uniplus/shared-utils';
import { aguardarRecarga } from '../../shared/foco';
import { marcarRecusaDoServidor } from '../../shared/formulario';
import { ProtecaoDoCatalogoStore } from './protecao-do-catalogo.store';
import {
  JUSTIFICATIVA_MAXIMA,
  justificativaPreenchida,
  recomendacoesPara,
  comandoDeJustificativa,
} from './decisao-da-protecao-form';
import { ChaveDaIntencao, enviarComRetentativa } from './envio-da-protecao';

const RAIZ = 'uniplus.configuracao.protecao_do_catalogo.';

/** Recusas que dizem que o item já não está como a tela o mostrou: a fila é relida e a decisão se refaz. */
const RECUSAS_QUE_RELEEM_A_FILA: ReadonlySet<string> = new Set([
  `${RAIZ}item_fora_de_solicitacao`,
  `${RAIZ}conflito_de_concorrencia`,
  `${RAIZ}protecao_mudou`,
  'uniplus.configuracao.tipo_documento.nao_encontrado',
  'uniplus.configuracao.fato_candidato.nao_encontrado',
]);

/**
 * Entrou manifestação técnica depois da leitura: o item é relido para a pessoa ler o que chegou, e a
 * decisão não se reenvia sozinha (UNI-REQ-0374).
 */
const MANIFESTACAO_NAO_LIDA = `${RAIZ}manifestacao_nao_lida`;

/** A manifestação desfavorável vigente exige a justificativa: o erro fica no campo. */
const JUSTIFICATIVA_EXIGIDA = `${RAIZ}justificativa_exigida_pela_manifestacao`;

const SUCESSO: Readonly<Record<DecisaoDaProtecao, string>> = {
  APROVAR: 'Item aprovado',
  RECOMENDAR_AJUSTE: 'Ajuste recomendado',
  REPROVAR: 'Item reprovado',
};

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
  private readonly chave = new ChaveDaIntencao();
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
  /** A recusa da API que fala da justificativa, mostrada no próprio campo. */
  private readonly recusaDaJustificativa = signal<string | null>(null);
  readonly recomendada = new FormControl('', { nonNullable: true });
  readonly justificativa = new FormControl('', { nonNullable: true });
  readonly tamanhoDaJustificativa = toSignal(
    this.justificativa.valueChanges.pipe(map(contarCaracteres)),
    { initialValue: 0 },
  );

  readonly opcoesDaRecomendacao = computed(() => recomendacoesPara(this.store.detalhe()));
  /** As manifestações vigentes do item aberto, que o diálogo da decisão mostra. */
  readonly manifestacoesVigentes = computed(
    () => this.store.detalhe()?.manifestacoesVigentes ?? [],
  );
  /** A reprovação sempre exige justificativa; as demais decisões, diante de manifestação desfavorável vigente. */
  readonly exigeJustificativa = computed(
    () =>
      this.decisaoEmCurso() === 'REPROVAR' ||
      this.store.detalhe()?.aprovacao.manifestacaoDesfavoravel === true,
  );

  /** O erro da justificativa só aparece depois da tentativa de decidir ou quando passa do limite digitado. */
  readonly erroDaJustificativa = computed<string | null>(() => {
    if (this.tamanhoDaJustificativa() > JUSTIFICATIVA_MAXIMA) {
      return 'A justificativa aceita até 2.000 caracteres.';
    }
    if (this.recusaDaJustificativa() !== null) return this.recusaDaJustificativa();
    return this.tentouDecidir() && this.justificativa.invalid ? this.faltaDeJustificativa() : null;
  });

  abrirDetalhe(item: ItemDaProtecaoDoCatalogoDto): void {
    if (this.decidindo()) return;
    this.erroDaDecisaoNoDrawer.set(null);
    this.detalheAberto.set(true);
    this.store.abrirDetalhe(item);
  }

  /**
   * A aprovação passa pelo diálogo, que mostra as manifestações vigentes e recebe a justificativa:
   * opcional, e obrigatória diante de manifestação desfavorável (UNI-REQ-0374).
   */
  aprovar(): void {
    this.abrirDecisao('APROVAR');
  }

  abrirDecisao(decisao: DecisaoDaProtecao): void {
    if (this.decidindo()) return;
    this.decisaoEmCurso.set(decisao);
    this.erroDaDecisaoNoDialogo.set(null);
    this.recusaDaJustificativa.set(null);
    this.tentouDecidir.set(false);
    this.recomendada.reset('');
    this.justificativa.reset('');
    this.justificativa.setValidators(this.exigeJustificativa() ? [justificativaPreenchida] : []);
    this.justificativa.updateValueAndValidity();
    this.decisaoAberta.set(true);
  }

  confirmarDecisao(): void {
    const item = this.store.detalhe();
    if (item === null || this.decidindo()) return;
    this.tentouDecidir.set(true);
    this.recusaDaJustificativa.set(null);
    if (!this.dialogoValido()) return;
    const decisao = this.decisaoEmCurso();
    const justificativa = this.justificativa.value.trim();
    this.decidir(
      item,
      comandoDeJustificativa(item, decisao, justificativa, this.recomendada.value),
    );
  }

  fecharDetalhe(): void {
    if (!this.decidindo()) this.detalheAberto.set(false);
  }

  fecharDecisao(): void {
    if (!this.decidindo()) this.decisaoAberta.set(false);
  }

  private faltaDeJustificativa(): string {
    return this.decisaoEmCurso() === 'REPROVAR'
      ? 'Informe a justificativa da reprovação.'
      : 'Há manifestação desfavorável vigente: informe a justificativa da decisão.';
  }

  private dialogoValido(): boolean {
    if (contarCaracteres(this.justificativa.value.trim()) > JUSTIFICATIVA_MAXIMA) return false;
    if (this.decisaoEmCurso() === 'RECOMENDAR_AJUSTE' && this.recomendada.value === '') {
      this.recomendada.setErrors({ required: true });
      return false;
    }
    return !this.justificativa.invalid;
  }

  /**
   * Registra a decisão. No sucesso o item sai da fila e o drawer fecha. Na recusa a mensagem da API
   * fica junto de onde a decisão foi tomada; quando a proteção mudou ou outra gravação venceu, a fila
   * é relida, porque repetir a mesma decisão não dá certo. O conflito retentável se repete uma vez.
   */
  private decidir(
    item: DetalheDaProtecaoDoCatalogoDto,
    comando: DecidirProtecaoDoCatalogoRequest,
  ): void {
    this.decidindo.set(true);
    this.erroDaDecisao.set(null);
    this.erroDaDecisaoNoDrawer.set(null);
    this.erroDaDecisaoNoDialogo.set(null);
    this.gravar(comando)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.decidindo.set(false);
        this.desfecho(item, comando, resultado);
      });
  }

  private gravar(comando: DecidirProtecaoDoCatalogoRequest): Observable<ApiResult<void>> {
    return enviarComRetentativa(
      (contexto) => this.api.decidir(comando, contexto),
      this.chave.para(comando),
    );
  }

  private desfecho(
    item: DetalheDaProtecaoDoCatalogoDto,
    comando: DecidirProtecaoDoCatalogoRequest,
    resultado: ApiResult<void>,
  ): void {
    this.chave.aposResposta(resultado);
    if (resultado.ok) this.concluir(item, SUCESSO[comando.decisao]);
    else this.recusar(resultado.problem);
  }

  private concluir(item: DetalheDaProtecaoDoCatalogoDto, sucesso: string): void {
    this.notifications.success(sucesso, item.nome);
    this.decisaoAberta.set(false);
    this.detalheAberto.set(false);
    this.relerAFila();
  }

  private recusar(problem: ProblemDetails): void {
    const mensagem = this.problemI18n.resolve(problem).title;
    if (this.marcarCampos(problem)) return;
    if (problem.code === JUSTIFICATIVA_EXIGIDA) {
      this.pedirJustificativa(mensagem);
    } else if (problem.code === MANIFESTACAO_NAO_LIDA) {
      this.relerOItem(mensagem);
    } else if (RECUSAS_QUE_RELEEM_A_FILA.has(problem.code)) {
      this.relerAposRecusa(mensagem);
    } else {
      this.mostrarRecusa(mensagem, problem);
    }
  }

  /**
   * A API devolve num lote só a justificativa exigida pela manifestação e a recusa da classificação
   * recomendada: cada erro vai ao seu campo de uma vez. Devolve se algum campo foi marcado.
   */
  private marcarCampos(problem: ProblemDetails): boolean {
    const erros = problem.errors ?? [];
    const daJustificativa = erros.find((erro) => erro.field.toLowerCase() === 'justificativa');
    const daRecomendada = erros.find(
      (erro) => erro.field.toLowerCase() === 'classificacaorecomendada',
    );
    if (daJustificativa) this.pedirJustificativa(daJustificativa.message);
    if (daRecomendada) {
      marcarRecusaDoServidor(this.recomendada, daRecomendada.code, daRecomendada.message);
    }
    return daJustificativa !== undefined || daRecomendada !== undefined;
  }

  /** A justificativa exigida pela manifestação fica no campo do diálogo da decisão. */
  private pedirJustificativa(mensagem: string): void {
    this.tentouDecidir.set(true);
    this.recusaDaJustificativa.set(mensagem);
  }

  private relerOItem(mensagem: string): void {
    this.decisaoAberta.set(false);
    this.erroDaDecisaoNoDrawer.set(
      `${mensagem}. O item foi relido; leia a manifestação nova e decida de novo.`,
    );
    this.store.recarregarDetalhe();
  }

  private relerAposRecusa(mensagem: string): void {
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
    if (this.decisaoAberta()) this.erroDaDecisaoNoDialogo.set(mensagem);
    else this.erroDaDecisaoNoDrawer.set(mensagem);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem, { title: mensagem });
  }
}
