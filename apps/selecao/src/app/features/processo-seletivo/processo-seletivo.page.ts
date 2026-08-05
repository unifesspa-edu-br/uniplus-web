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
import { OverlayScrollService } from './steps/shared/overlay-scroll.service';
import { WizardStepperComponent } from './steps/shared/wizard-stepper.component';
import { Step01TipoProcessoComponent } from './steps/steps/step-01-tipo-processo/step-01-tipo-processo.component';
import { Step02IdentificacaoComponent } from './steps/steps/step-02-identificacao/step-02-identificacao.component';
import { Step03ModalidadesComponent } from './steps/steps/step-03-modalidades/step-03-modalidades.component';
import { Step04VagasComponent } from './steps/steps/step-04-vagas/step-04-vagas.component';
import { Step05EtapasComponent } from './steps/steps/step-05-etapas/step-05-etapas.component';
import { Step06FormulaComponent } from './steps/steps/step-06-formula/step-06-formula.component';
import { Step07BonusComponent } from './steps/steps/step-07-bonus/step-07-bonus.component';
import { Step08DesempateComponent } from './steps/steps/step-08-desempate/step-08-desempate.component';
import { Step09EliminacaoComponent } from './steps/steps/step-09-eliminacao/step-09-eliminacao.component';
import { Step10DocumentosComponent } from './steps/steps/step-10-documentos/step-10-documentos.component';
import { Step11PolosComponent } from './steps/steps/step-11-polos/step-11-polos.component';
import { Step12AtendimentoComponent } from './steps/steps/step-12-atendimento/step-12-atendimento.component';
import { Step13RevisaoComponent } from './steps/steps/step-13-revisao/step-13-revisao.component';

@Component({
  selector: 'sel-processo-seletivo',
  standalone: true,
  host: { class: 'sel-processo' },
  imports: [
    WizardStepperComponent,
    Step01TipoProcessoComponent,
    Step02IdentificacaoComponent,
    Step03ModalidadesComponent,
    Step04VagasComponent,
    Step05EtapasComponent,
    Step06FormulaComponent,
    Step07BonusComponent,
    Step08DesempateComponent,
    Step09EliminacaoComponent,
    Step10DocumentosComponent,
    Step11PolosComponent,
    Step12AtendimentoComponent,
    Step13RevisaoComponent,
  ],
  providers: [ProcessoSeletivoStore],
  templateUrl: './app.component.html',
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
  private readonly step03 = viewChild(Step03ModalidadesComponent);
  private readonly step04 = viewChild(Step04VagasComponent);
  private readonly step05 = viewChild(Step05EtapasComponent);
  private readonly step06 = viewChild(Step06FormulaComponent);
  private readonly step07 = viewChild(Step07BonusComponent);
  private readonly step08 = viewChild(Step08DesempateComponent);
  private readonly step09 = viewChild(Step09EliminacaoComponent);
  private readonly step10 = viewChild(Step10DocumentosComponent);
  private readonly step11 = viewChild(Step11PolosComponent);
  private readonly step12 = viewChild(Step12AtendimentoComponent);
  private readonly step13 = viewChild(Step13RevisaoComponent);

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

  /** O scroller do wizard é `.wiz-content`, não a janela. */
  onContentScroll(event: Event): void {
    const scroller = event.target as HTMLElement;
    this.showBackToTop.set(scroller.scrollTop > 500);
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
    this.store.previous();
  }

  nextOrPublish(): void {
    if (this.store.isLast()) {
      this.publicar();
      return;
    }

    const validator = this.stepValidatorAt(this.store.currentStep());
    const result = validator?.validate();

    if (result && !result.valid) {
      this.store.setStepError(mensagensDe(result));
      return;
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
      return;
    }

    this.store.setStepError(null);
    this.publicationMessage.set(
      'Rascunho validado. A publicação será habilitada quando a integração com a API estiver disponível.',
    );
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
  }
}

/** Normaliza `message` (forma simples) e `messages` (lista) para `string[]`. */
function mensagensDe(resultado: StepValidation): string[] {
  if (resultado.messages && resultado.messages.length > 0) return resultado.messages;
  return [resultado.message ?? 'Preencha os campos obrigatórios para continuar.'];
}
