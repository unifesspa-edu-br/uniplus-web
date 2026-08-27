import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ProblemI18nService, isApiOk } from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { ProcessoSeletivoStore } from './steps/processo-seletivo.store';
import { StepValidation } from './steps/processo-seletivo.models';
import { CadastroInicialService } from './steps/shared/cadastro-inicial.service';
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
import { classificarDocumentos } from './steps/shared/hidratacao';
import type { MotivoFalhaDeLeitura } from './steps/processo-seletivo.models';

/** Formato do `:id` na rota — recusar aqui poupa uma ida ao servidor com lixo. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Traduz o status da recusa no que a tela pode oferecer. 404 e 403 descrevem
 * o endereço, não uma indisponibilidade: repetir a leitura daria o mesmo
 * resultado, então a saída é voltar à listagem. O resto admite retentativa.
 */
function motivoDe(status: number): MotivoFalhaDeLeitura {
  if (status === 404) return 'naoEncontrado';
  if (status === 403 || status === 401) return 'semPermissao';
  return 'falhaTemporaria';
}

@Component({
  selector: 'sel-processo-seletivo',
  standalone: true,
  host: { class: 'sel-processo' },
  imports: [
    RouterLink,
    AlertComponent,
    SpinnerComponent,
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
  providers: [ProcessoSeletivoStore, CadastroInicialService],
  templateUrl: './processo-seletivo.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessoSeletivoPage {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly root = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly overlayScroll = inject(OverlayScrollService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);

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

  /** Vez da leitura em curso — respostas de vezes anteriores são descartadas. */
  private leituraEmCurso = 0;

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
      // Numa entrada por `/:id` o painel só existe depois da leitura; sem
      // observar `hidratando`, o foco ficaria preso no estado de carregamento.
      this.store.hidratando();
      queueMicrotask(() => {
        const heading = this.root.nativeElement.querySelector<HTMLElement>(
          '.step-pane:not([hidden]) h1',
        );
        heading?.focus({ preventScroll: true });
      });
    });

    // CA-04: assim que a criação — disparada dentro do passo 2 — devolve o id,
    // o endereço passa a contê-lo. Sem isto, recarregar `/novo` depois de já
    // ter criado perderia o vínculo, e o passo 2 dispararia um segundo POST
    // para o mesmo rascunho.
    //
    // A transição preserva esta instância: as duas rotas do editor declaram a
    // mesma `reuseKey` (ver `editor-route-reuse.strategy.ts`). Sem isso o
    // wizard voltaria ao passo 1 no meio do anexo do edital, que é quando a
    // criação responde. `replaceUrl` porque não é navegação nova — é o mesmo
    // cadastro ganhando endereço próprio.
    effect(() => {
      const id = this.store.processoSeletivoId();
      if (id === null) return;
      untracked(() => {
        if (this.route.snapshot.paramMap.get('id') !== null) return;
        void this.router.navigate(['/processo-seletivo', id], { replaceUrl: true });
      });
    });

    // Reagir ao parâmetro, e não lê-lo uma vez: com a rota reusada o construtor
    // não roda de novo, então abrir outro processo pelo endereço precisa
    // disparar a leitura aqui. O id assumido logo após a criação não relê nada
    // — o editor já tem o que acabou de gravar.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');

      if (id === null) {
        // Entrar em `/novo` com a página reusada de um processo já carregado
        // deixaria o cadastro anterior em tela sob o endereço de cadastro novo
        // — com os campos congelados e o id de outro processo no store, o que
        // o operador continuasse preenchendo iria para o processo errado.
        //
        // `hidratando` entra na conta: uma leitura ainda em voo não deixou
        // rastro nos outros dois sinais, e sua resposta hidrataria o processo
        // sob `/novo` — o efeito do id levaria de volta a ele em seguida.
        const tinhaProcesso =
          this.store.processoSeletivoId() !== null ||
          this.store.falhaDeLeitura() !== null ||
          this.store.hidratando();

        if (tinhaProcesso) {
          this.leituraEmCurso += 1;
          this.limparEditor();
        }
        return;
      }

      if (id === this.store.processoSeletivoId()) {
        // Voltar ao processo que já está em tela não relê nada — exceto quando
        // a ida a outro endereço interrompeu a leitura no meio. Aí o que ficou
        // é um estado parcial: o detalhe hidratou, a resposta dos documentos
        // foi descartada, e o editor não sabe se existe edital. Ler de novo é
        // mais seguro do que consertar sinal por sinal — foi remendando esses
        // sinais que se chegou a um anexo destravado sobre estado desconhecido.
        if (this.store.falhaDeLeitura() !== null || this.store.hidratando()) {
          void this.retomar(id);
        }
        return;
      }

      void this.retomar(id);
    });
  }

  /**
   * Retomada por endereço (CA-05, CA-06, CA-08): lê o detalhe canônico e o
   * readback dos documentos do edital.
   *
   * Falha de leitura nunca vira rascunho vazio — abrir um cadastro novo sob o
   * id de outro processo levaria o operador a preencher tudo de novo e, no
   * passo de identificação, a criar uma duplicata.
   */
  protected async retomar(id: string): Promise<void> {
    // Com a página reusada, trocar de processo antes de a leitura anterior
    // responder deixa duas em voo. Se a mais antiga chegar por último, ela
    // sobrescreveria o store — o endereço mostraria B com os dados de A, e um
    // anexo enviado ali iria para o processo errado. Cada leitura carimba sua
    // vez e desiste ao descobrir que foi superada.
    const leitura = ++this.leituraEmCurso;
    const superada = (): boolean => leitura !== this.leituraEmCurso;

    if (!UUID.test(id)) {
      // A leitura anterior já foi superada pelo carimbo acima; sem encerrar o
      // carregamento aqui, voltar ao processo que estava aberto encontraria o
      // editor preso no indicador de progresso para sempre.
      this.store.hidratando.set(false);
      this.store.falhaDeLeitura.set({
        motivo: 'idInvalido',
        mensagem: 'O endereço não aponta para um identificador de processo válido.',
      });
      return;
    }

    // Abrir um processo por endereço sempre começa do zero. Hidratar por cima
    // do que estava em tela manteria o que o detalhe não traz — anexo,
    // metadados locais do edital e as seções ainda sem readback — atribuído ao
    // processo errado, e isso vale tanto vindo de outro `:id` quanto de um
    // `novo` já preenchido, onde ainda não há id no store para comparar.
    //
    // O caminho `novo` → id recém-criado não passa por aqui: o id já é o do
    // store, e ali o rascunho local pertence ao processo que acabou de nascer.
    this.limparEditor();

    this.store.falhaDeLeitura.set(null);
    this.store.hidratando.set(true);

    const detalhe = await firstValueFrom(this.api.obter(id));
    if (superada()) return;

    if (!isApiOk(detalhe)) {
      this.store.hidratando.set(false);
      this.store.falhaDeLeitura.set({
        motivo: motivoDe(detalhe.problem.status),
        mensagem: this.problemI18n.resolve(detalhe.problem).title,
      });
      return;
    }

    this.store.hidratar(detalhe.data);
    await this.restaurarDocumentoEdital(id, superada);
    if (superada()) return;

    this.store.hidratando.set(false);
  }

  /**
   * Um único documento confirmado restaura o vínculo sozinho; havendo mais de
   * um, a escolha é do administrador (CA-06) — presumir que o mais recente é
   * o oficial trocaria silenciosamente o edital do certame.
   *
   * Falha aqui não bloqueia o editor: o processo foi lido, e o passo de
   * identificação segue operável para anexar de novo. O aviso diz que o anexo
   * existente não pôde ser verificado, para o operador não concluir que não há
   * nenhum.
   */
  private async restaurarDocumentoEdital(
    processoSeletivoId: string,
    superada: () => boolean,
  ): Promise<void> {
    const resultado = await firstValueFrom(this.api.listarDocumentosEdital(processoSeletivoId));
    if (superada()) return;

    if (!isApiOk(resultado)) {
      this.store.avisoDocumentos.set(
        'Não foi possível verificar se este processo já tem edital anexado. Confira antes de enviar outro.',
      );
      return;
    }

    this.store.avisoDocumentos.set(null);

    const { vinculo, escolha } = classificarDocumentos(resultado.data);
    if (vinculo !== null) {
      this.store.patchObjectSection('identificacao', { uploads: [vinculo] });
    }
    this.store.documentosParaEscolha.set(escolha);
  }

  /**
   * Limpa o editor por inteiro. O store guarda o que está em tela; o serviço de
   * cadastro guarda o comando retido e as chaves de idempotência da criação em
   * andamento. Os dois descrevem o mesmo processo e precisam ser esquecidos
   * juntos — deixar as chaves para trás faria o próximo envio repetir o
   * cadastro anterior.
   */
  private limparEditor(): void {
    this.store.reset();
    this.cadastro.descartarCadastroEmAndamento();
  }

  /** Repete a leitura do endereço atual, para as falhas que admitem retentativa. */
  protected tentarNovamente(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id !== null && !this.store.hidratando()) void this.retomar(id);
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
