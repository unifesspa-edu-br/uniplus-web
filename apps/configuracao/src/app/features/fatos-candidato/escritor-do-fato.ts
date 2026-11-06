import { DestroyRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { FormGroup } from '@angular/forms';
import type { Observable } from 'rxjs';
import { ApiResult, ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import { deveRotacionarIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { aguardarRecarga, focarPrimeiroCampoInvalido } from '../../shared/foco';
import { ChavesDeIdempotencia } from './chaves-do-fato';
import { ehConflitoDeConcorrencia } from './conflitos-do-fato';
import { descartarRecusasDoServidor } from './fato-candidato.regras';
import { FatoEmEdicaoStore } from './fato-em-edicao.store';
import { FatosCandidatoStore } from './fatos-candidato.store';
import { idDoValor } from './ids-do-fato';

const MENSAGEM_DE_CONCORRENCIA =
  'Outra pessoa alterou este fato enquanto você editava. A versão atual foi carregada: refaça a alteração.';

/** Uma escrita da edição: a operação, o que dizer quando dá certo e o que fazer em cada desfecho. */
export interface Escrita {
  readonly operacao: Observable<ApiResult<void>>;
  readonly sucesso: string;
  readonly aoSalvar?: () => void;
  /** Põe a recusa onde a pessoa a vê; devolve `false` se não coube em lugar nenhum. */
  readonly aoRecusar?: (problem: ProblemDetails) => boolean;
  readonly aoPerderParaOutra?: () => void;
}

/**
 * A trava e o desfecho das escritas da edição de um fato. É a única dona do indicador de gravação:
 * uma escrita impede a outra, e, depois de uma que deu certo, o fato recarregado ainda não chegou
 * — a lista na tela é a antiga, e reordenar ou corrigir a partir dela reenviaria a ordem velha.
 */
export abstract class EscritorDeFato {
  protected readonly problemI18n = inject(ProblemI18nService);
  protected readonly notifications = inject(NotificationService);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly injector = inject(Injector);
  protected readonly lista = inject(FatosCandidatoStore);
  readonly leitura = inject(FatoEmEdicaoStore);

  /** O valor cuja descrição e orientação estão em edição na própria linha. */
  readonly editando = signal<string | null>(null);
  readonly erro = signal<string | null>(null);
  readonly anuncio = signal('');

  private readonly escrevendo = signal(false);
  protected readonly aguardandoRecarga = signal(false);
  readonly gravando = this.escrevendo.asReadonly();
  private readonly recargaDaLista = aguardarRecarga(
    this.lista.carregando,
    computed(() => this.lista.mensagemDeErro() !== null),
  );
  /** A lista ainda não reflete o que a edição gravou: quem devolve o foco a ela espera. */
  readonly aguardandoLista = this.recargaDaLista.aguardando;
  /** Também enquanto o fato recarregado não chega: ordem e total de valores seriam os velhos. */
  readonly bloqueado = computed(() => this.escrevendo() || this.aguardandoRecarga());

  protected readonly chaves = new ChavesDeIdempotencia();
  protected focoAposRecarga: string | null = null;

  /**
   * Executa uma escrita: no sucesso recarrega o fato e a lista; na falha mostra a recusa — no
   * campo quando a API diz qual — e troca a chave quando o próximo envio for outro comando. Esta é
   * a única trava de gravação.
   */
  protected executar(escrita: Escrita): void {
    if (this.bloqueado()) return;
    this.escrevendo.set(true);
    this.erro.set(null);
    this.anuncio.set('');
    escrita.operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      this.escrevendo.set(false);
      if (resultado.ok) this.concluir(escrita);
      else this.recusar(escrita, resultado.problem);
    });
  }

  private concluir(escrita: Escrita): void {
    this.aguardandoRecarga.set(true);
    escrita.aoSalvar?.();
    this.anuncio.set(`${escrita.sucesso}.`);
    this.notifications.success(escrita.sucesso);
    this.leitura.recarregar();
    this.recargaDaLista.iniciar();
    this.lista.recarregar();
  }

  private recusar(escrita: Escrita, problem: ProblemDetails): void {
    if (deveRotacionarIdempotencyKey(problem)) this.chaves.rotacionarTodas();
    const perdeu = ehConflitoDeConcorrencia(problem);
    if (perdeu) this.recarregarAposPerder(escrita);
    else if (!escrita.aoRecusar?.(problem)) this.erro.set(this.problemI18n.resolve(problem).title);
    this.anuncio.set(this.erro() ?? 'Revise os campos indicados.');
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  /** A escrita perdeu para outra: relê o fato e fecha a edição em linha, para refazer sobre a versão atual. */
  private recarregarAposPerder(escrita: Escrita): void {
    // Fechar a edição tira do DOM o botão que tinha o foco: ele volta ao Editar da mesma linha.
    const emEdicao = this.editando();
    if (emEdicao !== null) this.focoAposRecarga = idDoValor(emEdicao, 'editar');
    escrita.aoPerderParaOutra?.();
    this.editando.set(null);
    this.aguardandoRecarga.set(true);
    this.leitura.recarregar();
    this.erro.set(MENSAGEM_DE_CONCORRENCIA);
  }

  /** Envio barrado na tela: marca os campos e leva o foco ao primeiro inválido. */
  protected conferido(
    formulario: FormGroup,
    idDoFormulario: string,
    antes: () => void = () => undefined,
  ): boolean {
    descartarRecusasDoServidor(formulario);
    antes();
    if (formulario.valid) return true;
    formulario.markAllAsTouched();
    this.focarPrimeiroInvalidoEm(idDoFormulario);
    return false;
  }

  /** O botão que recebe o foco quando o fato recarregado chega: desativar ou reativar troca o botão da linha. */
  protected devolverFoco(): void {
    const id = this.focoAposRecarga;
    if (id === null) return;
    this.focoAposRecarga = null;
    this.focarQuandoRenderizar(id);
  }

  protected focarQuandoRenderizar(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }

  protected focarPrimeiroInvalidoEm(idDoFormulario: string): void {
    afterNextRender(
      () => {
        const raiz = document.getElementById(idDoFormulario);
        if (raiz !== null) focarPrimeiroCampoInvalido(raiz);
      },
      { injector: this.injector },
    );
  }
}
