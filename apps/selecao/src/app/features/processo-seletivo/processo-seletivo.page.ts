import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  effect,
  inject,
  signal,
  viewChildren,
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
  private readonly document = inject<Document>(DOCUMENT);
  private readonly root = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly overlayScroll = inject(OverlayScrollService);

  /** Steps do wizard — cada um expõe validate(): StepValidation. */
  private readonly step01 = viewChildren(Step01TipoProcessoComponent);
  private readonly step02 = viewChildren(Step02IdentificacaoComponent);
  private readonly step03 = viewChildren(Step03ModalidadesComponent);
  private readonly step04 = viewChildren(Step04VagasComponent);
  private readonly step05 = viewChildren(Step05EtapasComponent);
  private readonly step06 = viewChildren(Step06FormulaComponent);
  private readonly step07 = viewChildren(Step07BonusComponent);
  private readonly step08 = viewChildren(Step08DesempateComponent);
  private readonly step09 = viewChildren(Step09EliminacaoComponent);
  private readonly step10 = viewChildren(Step10DocumentosComponent);
  private readonly step11 = viewChildren(Step11PolosComponent);
  private readonly step12 = viewChildren(Step12AtendimentoComponent);
  private readonly step13 = viewChildren(Step13RevisaoComponent);

  /** Retorna o componente do step ativo, se estiver instanciado. */
  private stepValidatorAt(index: number): { validate(): StepValidation } | undefined {
    const steps = [
      this.step01()[0],
      this.step02()[0],
      this.step03()[0],
      this.step04()[0],
      this.step05()[0],
      this.step06()[0],
      this.step07()[0],
      this.step08()[0],
      this.step09()[0],
      this.step10()[0],
      this.step11()[0],
      this.step12()[0],
      this.step13()[0],
    ] as const;
    return steps[index];
  }

  readonly sidebarMobileOpen = signal(false);
  readonly sidebarCollapsed = signal(false);
  readonly stepsOverlayOpen = signal(false);
  readonly a11yOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly showBackToTop = signal(false);
  readonly publicationMessage = signal('');
  readonly theme = signal<'light' | 'dark' | 'auto'>('auto');
  readonly highContrast = signal(false);
  readonly legibleFont = signal(false);
  readonly configurationItems = [
    'Cidade',
    'Campus',
    'Local de oferta',
    'Instituição',
    'Unidade',
    'Curso',
    'Oferta de curso',
    'Modalidade',
    'Tipo de Documento',
    'Condição de Atendimento',
    'Recurso de Acessibilidade',
    'Tipo de Deficiência',
    'Fase Canônica',
    'Tipo de Banca',
    'Reserva Demográfica',
    'Peso ENEM',
  ] as const;

  @ViewChild('stepBarButton') private stepBarButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('stepsOverlayClose') private stepsOverlayClose?: ElementRef<HTMLButtonElement>;
  @ViewChild('stepsOverlay') private stepsOverlay?: ElementRef<HTMLDialogElement>;

  constructor() {
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

  @HostListener('window:scroll') onScroll(): void {
    this.showBackToTop.set(window.scrollY > 500);
  }

  @HostListener('document:keydown.escape') onEscape(): void {
    if (this.stepsOverlayOpen()) this.closeStepsOverlay();
    if (this.sidebarMobileOpen()) this.closeMobileSidebar();
    this.a11yOpen.set(false);
    this.userMenuOpen.set(false);
  }

  toggleA11yMenu(): void {
    this.a11yOpen.update((value) => !value);
    this.userMenuOpen.set(false);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((value) => !value);
    this.a11yOpen.set(false);
  }

  toggleSidebar(): void {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      this.sidebarCollapsed.update((value) => !value);
      return;
    }
    if (this.sidebarMobileOpen()) {
      this.closeMobileSidebar();
    } else {
      this.openMobileSidebar();
    }
  }

  openMobileSidebar(): void {
    this.sidebarMobileOpen.set(true);
    this.overlayScroll.lock();
  }
  closeMobileSidebar(): void {
    if (!this.sidebarMobileOpen()) return;
    this.sidebarMobileOpen.set(false);
    this.overlayScroll.unlock();
  }
  /**
   * Abre a lista de etapas como diálogo modal. `showModal()` põe o elemento no
   * top layer e o navegador contém o foco; com um `<div>` sob `inert` parcial,
   * o Tab escapava para a topbar e a sidebar do layout, que não são
   * descendentes desta rota.
   */
  openStepsOverlay(): void {
    if (this.stepsOverlayOpen()) return;
    if (this.sidebarMobileOpen()) this.closeMobileSidebar();

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

  setTheme(value: 'light' | 'dark' | 'auto'): void {
    this.theme.set(value);
    this.document.documentElement.dataset['theme'] = value;
  }

  toggleContrast(): void {
    this.highContrast.update((value) => !value);
    this.document.documentElement.classList.toggle('high-contrast', this.highContrast());
  }

  toggleLegibleFont(): void {
    this.legibleFont.update((value) => !value);
    this.document.documentElement.classList.toggle('font-legible', this.legibleFont());
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/** Normaliza `message` (forma simples) e `messages` (lista) para `string[]`. */
function mensagensDe(resultado: StepValidation): string[] {
  if (resultado.messages && resultado.messages.length > 0) return resultado.messages;
  return [resultado.message ?? 'Preencha os campos obrigatórios para continuar.'];
}
