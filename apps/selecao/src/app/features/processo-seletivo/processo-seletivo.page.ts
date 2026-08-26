import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ProcessoSeletivoStore } from './steps/processo-seletivo.store';
import { StepValidation } from './steps/processo-seletivo.models';
import { CadastroInicialService } from './steps/shared/cadastro-inicial.service';
import { OverlayScrollService } from './steps/shared/overlay-scroll.service';
import { WizardStepperComponent } from './steps/shared/wizard-stepper.component';
import { Step01TipoProcessoComponent } from './steps/steps/step-01-tipo-processo/step-01-tipo-processo.component';
import { Step02IdentificacaoComponent } from './steps/steps/step-02-identificacao/step-02-identificacao.component';
import { Step03PagamentoIsencaoComponent } from './steps/steps/step-03-pagamento-isencao/step-03-pagamento-isencao.component';
import { Step04ModalidadesComponent } from './steps/steps/step-04-modalidades/step-04-modalidades.component';
import { Step05VagasComponent } from './steps/steps/step-05-vagas/step-05-vagas.component';
import { Step06EtapasComponent } from './steps/steps/step-06-etapas/step-06-etapas.component';
import { Step07FormulaComponent } from './steps/steps/step-07-formula/step-07-formula.component';
import { Step08BonusComponent } from './steps/steps/step-08-bonus/step-08-bonus.component';
import { Step09DesempateComponent } from './steps/steps/step-09-desempate/step-09-desempate.component';
import { Step10EliminacaoComponent } from './steps/steps/step-10-eliminacao/step-10-eliminacao.component';
import { Step11DocumentosComponent } from './steps/steps/step-11-documentos/step-11-documentos.component';
import { Step12PolosComponent } from './steps/steps/step-12-polos/step-12-polos.component';
import { Step13AtendimentoComponent } from './steps/steps/step-13-atendimento/step-13-atendimento.component';
import { Step14RevisaoComponent } from './steps/steps/step-14-revisao/step-14-revisao.component';

@Component({
  selector: 'sel-processo-seletivo',
  standalone: true,
  host: { class: 'sel-processo' },
  imports: [
    WizardStepperComponent,
    Step01TipoProcessoComponent,
    Step02IdentificacaoComponent,
    Step03PagamentoIsencaoComponent,
    Step04ModalidadesComponent,
    Step05VagasComponent,
    Step06EtapasComponent,
    Step07FormulaComponent,
    Step08BonusComponent,
    Step09DesempateComponent,
    Step10EliminacaoComponent,
    Step11DocumentosComponent,
    Step12PolosComponent,
    Step13AtendimentoComponent,
    Step14RevisaoComponent,
  ],
  providers: [ProcessoSeletivoStore, CadastroInicialService],
  templateUrl: './processo-seletivo.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessoSeletivoPage {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly root = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly overlayScroll = inject(OverlayScrollService);
  private readonly destroyRef = inject(DestroyRef);

  /** Steps do wizard — cada um expõe validate(): StepValidation. */
  private readonly step01 = viewChild(Step01TipoProcessoComponent);
  private readonly step02 = viewChild(Step02IdentificacaoComponent);
  private readonly step03 = viewChild(Step03PagamentoIsencaoComponent);
  private readonly step04 = viewChild(Step04ModalidadesComponent);
  private readonly step05 = viewChild(Step05VagasComponent);
  private readonly step06 = viewChild(Step06EtapasComponent);
  private readonly step07 = viewChild(Step07FormulaComponent);
  private readonly step08 = viewChild(Step08BonusComponent);
  private readonly step09 = viewChild(Step09DesempateComponent);
  private readonly step10 = viewChild(Step10EliminacaoComponent);
  private readonly step11 = viewChild(Step11DocumentosComponent);
  private readonly step12 = viewChild(Step12PolosComponent);
  private readonly step13 = viewChild(Step13AtendimentoComponent);
  private readonly step14 = viewChild(Step14RevisaoComponent);

  /** Retorna o componente do step ativo, se estiver instanciado. */
  private stepValidatorAt(index: number): { validate(): StepValidation } | undefined {
    const steps = [
      this.step01(),
      this.step02(),
      this.step03(),
      this.step04(),
      this.step05(),
      this.step06(),
      this.step07(),
      this.step08(),
      this.step09(),
      this.step10(),
      this.step11(),
      this.step12(),
      this.step13(),
      this.step14(),
    ] as const;
    return steps[index];
  }

  readonly stepsOverlayOpen = signal(false);
  readonly showBackToTop = signal(false);
  readonly publicationMessage = signal('');
  @ViewChild('stepBarButton') private stepBarButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('stepsOverlayClose') private stepsOverlayClose?: ElementRef<HTMLButtonElement>;
  @ViewChild('stepsOverlay') private stepsOverlay?: ElementRef<HTMLDialogElement>;
  @ViewChild('wizContent') private wizContent?: ElementRef<HTMLElement>;

  constructor() {
    // Navegar com o overlay ou a sidebar abertos destruía a página sem liberar
    // o lock, e a rota seguinte ficava sem scroll.
    this.destroyRef.onDestroy(() => {
      if (this.stepsOverlayOpen()) this.overlayScroll.unlock();
    });

    effect(() => {
      this.store.currentStep();
      queueMicrotask(() => {
        const heading = this.root.nativeElement.querySelector<HTMLElement>(
          '.step-pane:not([hidden]) h1',
        );
        heading?.focus({ preventScroll: true });
      });
    });
  }

  /**
   * O scroller do wizard costuma ser `.wiz-content`, mas em telas baixas — ou
   * com zoom alto — o conteúdo ultrapassa a viewport e quem rola é o documento.
   * O botão precisa reagir aos dois, senão fica invisível justamente onde é
   * mais útil.
   */
  onContentScroll(event: Event): void {
    const scroller = event.target as HTMLElement;
    this.showBackToTop.set(scroller.scrollTop > 500 || window.scrollY > 500);
  }

  @HostListener('window:scroll') onDocumentScroll(): void {
    const scroller = this.wizContent?.nativeElement;
    this.showBackToTop.set(window.scrollY > 500 || (scroller?.scrollTop ?? 0) > 500);
  }

  @HostListener('document:keydown.escape') onEscape(): void {
    if (this.stepsOverlayOpen()) this.closeStepsOverlay();
  }

  /**
   * Abre a lista de etapas como diálogo modal. `showModal()` põe o elemento no
   * top layer e o navegador contém o foco; com um `<div>` sob `inert` parcial,
   * o Tab escapava para a topbar e a sidebar do layout, que não são
   * descendentes desta rota.
   */
  openStepsOverlay(): void {
    if (this.stepsOverlayOpen()) return;

    this.stepsOverlay?.nativeElement.showModal();
    this.stepsOverlayOpen.set(true);
    this.overlayScroll.lock();
    queueMicrotask(() => this.stepsOverlayClose?.nativeElement.focus());
  }

  closeStepsOverlay(): void {
    if (!this.stepsOverlayOpen()) return;
    // O estado é sincronizado em `onStepsOverlayClose`, que também atende ao
    // fechamento por Esc — tratado pelo próprio elemento.
    this.stepsOverlay?.nativeElement.close();
  }

  /** Esc no diálogo: deixa o elemento fechar e sincroniza pelo evento `close`. */
  onStepsOverlayCancel(event: Event): void {
    event.preventDefault();
    this.stepsOverlay?.nativeElement.close();
  }

  onStepsOverlayClose(): void {
    if (!this.stepsOverlayOpen()) return;
    this.stepsOverlayOpen.set(false);
    this.overlayScroll.unlock();
    queueMicrotask(() => this.stepBarButton?.nativeElement.focus());
  }

  previous(): void {
    if (this.store.salvando()) return;
    this.store.previous();
  }

  async nextOrPublish(): Promise<void> {
    // Single-flight: o passo 2 grava na API, e um duplo clique criaria dois
    // processos com chaves de idempotência diferentes.
    if (this.store.salvando()) return;

    if (this.store.isLast()) {
      this.publicar();
      return;
    }

    const validator = this.stepValidatorAt(this.store.currentStep());
    const result = validator?.validate();

    if (result && !result.valid) {
      this.store.setStepError(mensagensDe(result));
      this.revelarErro();
      return;
    }

    // Passos que persistem expõem `persistir()`; os demais avançam direto.
    const persistivel = validator as Partial<StepCommit> | undefined;
    if (persistivel?.persistir) {
      const commit = await persistivel.persistir().catch(
        (): StepValidation => ({
          valid: false,
          messages: ['Não foi possível concluir a operação. Tente novamente.'],
        }),
      );
      if (!commit.valid) {
        this.store.setStepError(mensagensDe(commit));
        this.revelarErro();
        return;
      }
    }

    this.store.setStepError(null);
    this.store.next();
  }

  /**
   * Publica só com o rascunho inteiro válido. Como a navegação entre passos é
   * livre, chegar ao último passo não significa ter preenchido os anteriores:
   * sem esta checagem dá para saltar direto para a revisão e publicar um
   * rascunho vazio, ou invalidar um passo já concluído e voltar para cá.
   */
  private publicar(): void {
    const pendentes = this.validarRascunho();

    if (pendentes.length > 0) {
      this.publicationMessage.set('');
      this.store.setStepError(pendentes);
      this.revelarErro();
      return;
    }

    this.store.setStepError(null);
    this.publicationMessage.set(
      'Rascunho validado. A publicação será habilitada quando a integração com a API estiver disponível.',
    );
  }

  /**
   * Traz o aviso de pendências para a vista e o entrega ao leitor de tela. O
   * resumo do último passo rola em 320 px e com zoom alto: sem isto, quem
   * publica a partir do rodapé com a lista rolada não recebe retorno visível.
   */
  private revelarErro(): void {
    // `setTimeout` e não `queueMicrotask`: o aviso só existe no DOM depois que
    // o Angular processa a mudança do signal, o que ocorre após a fila de
    // microtarefas.
    setTimeout(() => {
      const alerta = this.root.nativeElement.querySelector<HTMLElement>('.step-error');
      if (alerta === null) return;

      alerta.setAttribute('tabindex', '-1');
      // O scroll do wizard vive em `.wiz-content` — rolar o documento com
      // `scrollIntoView` empurraria a institutional-bar/header/sidebar para
      // fora do topo (somem) e deixaria folga embaixo. Rola somente o
      // container, calculando o offset interno pelo getBoundingClientRect.
      const scroller = this.wizContent?.nativeElement;
      if (scroller) {
        try {
          const topoAlerta = alerta.getBoundingClientRect().top;
          const topoScroller = scroller.getBoundingClientRect().top;
          scroller.scrollTo({
            top: scroller.scrollTop + (topoAlerta - topoScroller),
            behavior: 'smooth',
          });
        } catch {
          // jsdom não implementa scrollTo(options); o foco não pode ser bloqueado.
        }
      }
      alerta.focus({ preventScroll: true });
    });
  }

  /**
   * Roda `validate()` de todos os passos, reconcilia o progresso exibido e
   * devolve uma mensagem por pendência, identificada pelo passo de origem.
   * Todos os passos ficam montados (`[hidden]`), então todos respondem.
   */
  private validarRascunho(): string[] {
    const pendencias: string[] = [];
    const concluidos = new Set<number>();

    for (let index = 0; index < this.store.totalSteps; index += 1) {
      const resultado = this.stepValidatorAt(index)?.validate();

      if (resultado && !resultado.valid) {
        const detalhe = mensagensDe(resultado).join(' ');
        pendencias.push(`Passo ${index + 1} — ${this.store.labels[index]}: ${detalhe}`);
        continue;
      }

      concluidos.add(index);
    }

    this.store.syncCompleted(concluidos);
    return pendencias;
  }

  scrollToTop(): void {
    this.wizContent?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * Passo que grava na API antes de liberar o avanço. `validate()` continua
 * síncrono e responde pela consistência do rascunho; `persistir()` responde
 * pelo efeito remoto.
 */
interface StepCommit {
  persistir(): Promise<StepValidation>;
}

/** Normaliza `message` (forma simples) e `messages` (lista) para `string[]`. */
function mensagensDe(resultado: StepValidation): string[] {
  if (resultado.messages && resultado.messages.length > 0) return resultado.messages;
  return [resultado.message ?? 'Preencha os campos obrigatórios para continuar.'];
}
