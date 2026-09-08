import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  ElementRef,
  HostListener,
  ViewChild,
  effect,
  inject,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ProblemI18nService, isApiOk } from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { ProcessoSeletivoStore } from './steps/processo-seletivo.store';
import { StepValidation } from './steps/processo-seletivo.models';
import { PASSOS } from './steps/processo-seletivo.data';
import { PASSO_DO_WIZARD, PassoDoWizard } from './steps/passo-do-wizard';
import type { ConfirmacaoDeGravacao } from './steps/passo-do-wizard';
import { CadastroInicialService } from './steps/shared/cadastro-inicial.service';
import { OverlayScrollService } from './steps/shared/overlay-scroll.service';
import { WizardStepperComponent } from './steps/shared/wizard-stepper.component';
import { TipoProcessoStepComponent } from './steps/steps/tipo-processo/tipo-processo.component';
import { IdentificacaoStepComponent } from './steps/steps/identificacao/identificacao.component';
import { PagamentoStepComponent } from './steps/steps/pagamento/pagamento.component';
import { VagasStepComponent } from './steps/steps/vagas/vagas.component';
import { CatalogosDoCronogramaService } from './steps/steps/cronograma/catalogos-do-cronograma.service';
import { CronogramaStepComponent } from './steps/steps/cronograma/cronograma.component';
import { FaseStepComponent } from './steps/steps/fase/fase.component';
import { CatalogosDeClassificacaoService } from './steps/steps/classificacao/catalogos-de-classificacao.service';
import { FormulaStepComponent } from './steps/steps/formula/formula.component';
import { BonusStepComponent } from './steps/steps/bonus/bonus.component';
import { DesempateStepComponent } from './steps/steps/desempate/desempate.component';
import { EliminacaoStepComponent } from './steps/steps/eliminacao/eliminacao.component';
import { PolosStepComponent } from './steps/steps/polos/polos.component';
import { AtendimentoStepComponent } from './steps/steps/atendimento/atendimento.component';
import { RevisaoStepComponent } from './steps/steps/revisao/revisao.component';
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
    DialogComponent,
    SpinnerComponent,
    WizardStepperComponent,
    TipoProcessoStepComponent,
    IdentificacaoStepComponent,
    PagamentoStepComponent,
    VagasStepComponent,
    CronogramaStepComponent,
    FaseStepComponent,
    FormulaStepComponent,
    BonusStepComponent,
    DesempateStepComponent,
    EliminacaoStepComponent,
    PolosStepComponent,
    AtendimentoStepComponent,
    RevisaoStepComponent,
  ],
  providers: [
    ProcessoSeletivoStore,
    CadastroInicialService,
    CatalogosDoCronogramaService,
    CatalogosDeClassificacaoService,
  ],
  templateUrl: './processo-seletivo.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessoSeletivoPage {
  /** Os passos na ordem em que o template os declara. */
  private readonly passos = viewChildren(PASSO_DO_WIZARD);

  readonly passoCorrente = computed(() => PASSOS[this.store.currentStep()]);

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

  /** Retorna o componente do step ativo, se estiver instanciado. */
  private stepValidatorAt(index: number): PassoDoWizard | undefined {
    return this.passos()[index];
  }

  /** Vez da leitura em curso — respostas de vezes anteriores são descartadas. */
  private leituraEmCurso = 0;

  /**
   * Resumo aguardando confirmação do operador. Enquanto não é `null`, nada foi
   * enviado à API — é exatamente esse o ponto do modal.
   */
  readonly confirmacaoPendente = signal<ConfirmacaoDeGravacao | null>(null);

  /**
   * Se o diálogo devolve o foco ao botão que o abriu. Só é desligado quando a
   * confirmação levou a um avanço de passo — aí a tela por trás mudou, e o
   * destino certo é o título do passo novo.
   */
  readonly restaurarFocoAoFechar = signal(true);

  /**
   * Rótulo do botão de avanço. O passo aberto pode dizer o seu; sem isso, o
   * shell diz "Próximo" — e "Publicar" no último. Um botão que grava e diz
   * "Próximo" descreve a navegação e esconde o efeito.
   */
  readonly rotuloDeAvanco = computed(() => {
    if (!this.store.edicaoPermitida()) return 'Próximo';
    if (this.store.isLast()) return 'Publicar';
    const passo = this.stepValidatorAt(this.store.currentStep());
    return passo?.rotuloDeAvanco?.() ?? 'Próximo';
  });

  /** No último passo o avanço só publica, e publicar exige rascunho. */
  readonly ofereceAvanco = computed(() => this.store.edicaoPermitida() || !this.store.isLast());

  readonly stepsOverlayOpen = signal(false);
  readonly showBackToTop = signal(false);
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

    // Um resumo aberto vale para o passo que o produziu. Trocar de passo — pelo
    // stepper, pelo histórico do navegador ou por uma troca de processo, já que
    // a rota reusa esta página — o torna obsoleto, e confirmá-lo depois
    // aplicaria a decisão lida numa tela ao efeito de outra.
    effect(() => {
      this.store.currentStep();
      untracked(() => this.confirmacaoPendente.set(null));
    });

    effect(() => {
      this.store.currentStep();
      // Numa entrada por `/:id` o painel só existe depois da leitura; sem
      // observar `hidratando`, o foco ficaria preso no estado de carregamento.
      this.store.hidratando();
      queueMicrotask(() => this.focarTituloDoPasso());
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
      this.store.projetarSecao('identificacao', { uploads: [vinculo] });
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

    // A rota reusa esta página, então um resumo aberto sobrevive à troca de
    // processo se ninguém o descartar. Confirmá-lo depois resolveria o passo
    // pelo estado novo enquanto exibia os dados do editor anterior — o resumo
    // vale para o rascunho que o produziu, e esse rascunho acabou de sumir.
    this.confirmacaoPendente.set(null);
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
    if (this.store.operacaoEmAndamento()) return;
    this.store.previous();
  }

  async nextOrPublish(): Promise<void> {
    // Single-flight: o passo 2 grava na API, e um duplo clique criaria dois
    // processos com chaves de idempotência diferentes. `operacaoEmAndamento()`
    // cobre também a janela de `publicar()` entre um passo terminar e o
    // próximo começar — `salvando()` sozinho fica `false` ali por um
    // instante real (achado do Codex na #486, P1).
    if (this.store.operacaoEmAndamento()) return;

    // Consultar um processo publicado é livre; escrever nele o servidor
    // recusaria, depois de o operador ter preenchido a tela inteira.
    if (!this.store.edicaoPermitida()) {
      this.store.next();
      return;
    }

    if (this.store.isLast()) {
      await this.publicar();
      return;
    }

    const validator = this.stepValidatorAt(this.store.currentStep());
    const result = validator?.validate();

    if (result && !result.valid) {
      this.store.setStepError(mensagensDe(result));
      this.revelarErro();
      return;
    }

    // A confirmação vem antes de qualquer requisição: é o momento em que o
    // operador ainda pode desistir. Depois de gravado, o cadastro inicial não
    // volta atrás pelo contrato desta tela.
    const confirmacao = validator?.confirmacaoDeGravacao?.();
    if (confirmacao) {
      this.restaurarFocoAoFechar.set(true);
      this.confirmacaoPendente.set(confirmacao);
      return;
    }

    await this.gravarEAvancar(validator);
  }

  /**
   * Confirma o resumo e grava. O passo de destino é lido de novo aqui, mas não
   * pode ter mudado — o resumo é descartado a cada troca de passo, justamente
   * para que confirmar signifique sempre o que o operador leu.
   *
   * O diálogo continua aberto enquanto a requisição corre. Fechá-lo no clique
   * devolveria o foco ao botão de avanço que `persistir()` acaba de desabilitar,
   * e o teclado ficaria sem ponto de partida por toda a espera; assim o foco
   * permanece dentro do diálogo, que anuncia a gravação em curso, e só volta ao
   * botão quando ele torna a aceitar foco.
   */
  async confirmarGravacao(): Promise<void> {
    if (this.confirmacaoPendente() === null || this.store.salvando()) return;
    try {
      // Avançar troca o passo por baixo do diálogo. Devolver o foco ao botão
      // que o abriu levaria a um rodapé que já não descreve o que está em
      // tela; quem passa a mandar no foco é o efeito de troca de passo, que
      // leva ao título do passo novo. Falhando, a tela é a mesma e a
      // restauração continua correta.
      const sucesso = await this.gravarEAvancar(this.stepValidatorAt(this.store.currentStep()));
      this.restaurarFocoAoFechar.set(!sucesso);

      // `store.next()` não avança a partir do último passo — não há passo
      // seguinte —, então o efeito de troca de passo (que move o foco ao
      // título do passo novo em qualquer outra gravação) não dispara depois
      // de publicar. Sem este destino explícito, fechar o diálogo de
      // confirmação da publicação deixa o foco sem lugar nenhum.
      if (sucesso && this.store.isLast()) {
        this.focarConfirmacaoDePublicacao();
      }
    } finally {
      this.confirmacaoPendente.set(null);
    }
  }

  /** Foca o título "Processo publicado" — só existe quando `persistir()` da Revisão confirmou o snapshot. */
  private focarConfirmacaoDePublicacao(): void {
    // `setTimeout`, não `queueMicrotask`: o bloco só entra no DOM depois que o
    // Angular processa `snapshotConfirmado()`, o que acontece depois da fila
    // de microtarefas — mesmo motivo de `revelarErro()`.
    setTimeout(() => {
      this.root.nativeElement
        .querySelector<HTMLElement>('.revisao-publicado-titulo')
        ?.focus({ preventScroll: true });
    });
  }

  /**
   * Desiste da gravação. Nada foi enviado e nada muda no rascunho: o operador
   * volta ao passo com o que digitou, que é o motivo de a confirmação vir
   * antes da requisição e não depois.
   *
   * Com a gravação em curso não há mais o que desistir — o comando já saiu — e
   * fechar aqui só tiraria da tela o aviso de que ela está acontecendo.
   */
  cancelarGravacao(): void {
    if (this.store.salvando()) return;
    this.confirmacaoPendente.set(null);
  }

  /**
   * Conclui o passo depois de a confirmação já ter sido resolvida — seja
   * porque o passo não pedia nenhuma, seja porque o operador confirmou.
   */
  private async gravarEAvancar(validator: PassoDoWizard | undefined): Promise<boolean> {
    // Passos que persistem expõem `persistir()`; os demais avançam direto.
    if (validator?.persistir) {
      const commit = await validator.persistir().catch(
        (): StepValidation => ({
          valid: false,
          messages: ['Não foi possível concluir a operação. Tente novamente.'],
        }),
      );
      if (!commit.valid) {
        // Lista de mensagens vazia é descarte deliberado: o resultado pertence
        // a um editor que já não está em tela, e anunciá-lo colocaria erro num
        // rascunho que ninguém tentou gravar.
        if (commit.messages?.length !== 0) {
          this.store.setStepError(mensagensDe(commit));
          this.revelarErro();
        }
        return false;
      }
    }

    this.store.setStepError(null);
    this.store.next();
    return true;
  }

  /**
   * Publica só com o rascunho inteiro válido. Como a navegação entre passos é
   * livre, chegar ao último passo não significa ter preenchido os anteriores:
   * sem esta checagem dá para saltar direto para a revisão e publicar um
   * rascunho vazio, ou invalidar um passo já concluído e voltar para cá.
   *
   * Duas passadas de `validarRascunho()`, não uma — a ordem não é a
   * intuitiva. A primeira cobre só os passos ANTERIORES à Revisão
   * (`totalSteps - 1`, exclusivo): rápida, sem rede, e barra de imediato um
   * passo genuinamente incompleto, sem arriscar `persistir()` contra um
   * rascunho que ainda não faz sentido. A Revisão fica de fora dela de
   * propósito — se ela entrasse aqui, `validate()` recusaria com o
   * checklist AINDA velho sempre que o operador tivesse acabado de corrigir
   * um passo anterior e voltado direto à Revisão pelo stepper livre (sem
   * "avançar", que gravaria): o portão barraria antes mesmo de
   * `gravarPassosAnteriores()` ter a chance de gravar a correção (achado do
   * Codex na #486, P1 — o mesmo estado intermediário tratado como final que
   * já apareceu nesta frente). Só depois de gravar de novo e recarregar o
   * checklist da Revisão é que a segunda passada — o rascunho inteiro,
   * Revisão incluída — faz sentido: agora ela vê o que a primeira acabou de
   * produzir, nunca uma foto de antes dela.
   *
   * `geracao` é conferida depois de cada await: `gravarPassosAnteriores()`
   * grava vários passos em sequência, e o operador pode trocar de processo
   * no meio da varredura — continuar dali gravaria no rascunho do processo
   * NOVO por engano (achado do Codex na #486, P1 — o mais sério dos três
   * desta rodada). Sai calada quando isso acontece, no mesmo silêncio que
   * `{ valid: false, messages: [] }` já tem em `gravarEAvancar()`.
   */
  private async publicar(): Promise<void> {
    const geracao = this.store.geracao();

    const pendentesAntesDeGravar = this.validarRascunho(this.store.totalSteps - 1);
    if (pendentesAntesDeGravar.length > 0) {
      this.store.setStepError(pendentesAntesDeGravar);
      this.revelarErro();
      return;
    }

    // `travamentoDeOrquestracao`, não só o `salvando()` de cada passo
    // individual: cada `persistir()` da varredura abaixo solta `salvando`
    // no próprio `finally` assim que a PRÓPRIA chamada termina, mas esta
    // orquestração — gravar os passos anteriores, recarregar o checklist,
    // validar de novo — ainda não acabou. Sem uma trava que cubra a
    // orquestração inteira, o intervalo entre um passo terminar e o
    // próximo começar (ou entre o último passo e a recarga que vem depois)
    // liberava o stepper e os campos por um instante real: o operador podia
    // navegar, editar e voltar antes da recarga concluir, e a confirmação
    // seguinte comparava contra um checklist que já não descrevia o
    // rascunho atual (achado do Codex na #486, P1 — a quarta ocorrência de
    // "estado intermediário tratado como final" nesta Story). Solta ao sair
    // — inclusive ao abrir o diálogo de confirmação: a partir dali é a
    // modalidade dele, não esta trava, que impede editar por baixo.
    this.store.travamentoDeOrquestracao.set(true);
    try {
      const falhasDeGravacao = await this.gravarPassosAnteriores();
      if (geracao !== this.store.geracao()) return;
      if (falhasDeGravacao.length > 0) {
        this.store.setStepError(falhasDeGravacao);
        this.revelarErro();
        return;
      }

      // A Revisão fica de fora da varredura acima — seu `persistir()`
      // publica de verdade, não é um resalvar — mas o checklist que ela
      // cacheia pode ter ficado desatualizado exatamente pelos passos que
      // acabamos de gravar de novo.
      await this.stepValidatorAt(this.store.totalSteps - 1)?.recarregarChecklist?.();
      if (geracao !== this.store.geracao()) return;

      const pendentes = this.validarRascunho();
      if (pendentes.length > 0) {
        this.store.setStepError(pendentes);
        this.revelarErro();
        return;
      }

      this.store.setStepError(null);

      const validator = this.stepValidatorAt(this.store.currentStep());
      const confirmacao = validator?.confirmacaoDeGravacao?.();
      if (confirmacao) {
        this.restaurarFocoAoFechar.set(true);
        this.confirmacaoPendente.set(confirmacao);
        return;
      }

      await this.gravarEAvancar(validator);
    } finally {
      if (geracao === this.store.geracao()) this.store.travamentoDeOrquestracao.set(false);
    }
  }

  /**
   * Traz o aviso de pendências para a vista e o entrega ao leitor de tela. O
   * resumo do último passo rola em 320 px e com zoom alto: sem isto, quem
   * publica a partir do rodapé com a lista rolada não recebe retorno visível.
   */
  /** Título do passo — o destino de foco a cada troca. */
  private focarTituloDoPasso(): void {
    this.root.nativeElement.querySelector<HTMLElement>('.step-head h1')?.focus({
      preventScroll: true,
    });
  }

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
   * Roda `validate()` dos passos de `0` até `ateIndice` (exclusive; todos
   * por padrão), reconcilia o progresso exibido nesse intervalo e devolve
   * uma mensagem por pendência, identificada pelo passo de origem. Todos os
   * passos ficam montados (`[hidden]`), então todos respondem.
   *
   * `ateIndice` existe só para `publicar()` chamar em duas passadas: a
   * primeira, sem a Revisão (`totalSteps - 1`), porque o `validate()` dela
   * depende de um checklist que só fica correto DEPOIS de
   * `gravarPassosAnteriores()` gravar as correções e `recarregarChecklist()`
   * atualizar o cache — incluí-la na primeira passada recusaria com a foto
   * de antes da correção e nunca chegaria a gravar nada (achado do Codex na
   * #486, P1). Passos fora do intervalo desta chamada mantêm o progresso que
   * já tinham.
   */
  private validarRascunho(ateIndice = this.store.totalSteps): string[] {
    const pendencias: string[] = [];
    const concluidos = new Set<number>(this.store.completedSteps());

    for (let index = 0; index < ateIndice; index += 1) {
      const resultado = this.stepValidatorAt(index)?.validate();

      if (resultado && !resultado.valid) {
        const detalhe = mensagensDe(resultado).join(' ');
        pendencias.push(`Passo ${index + 1} — ${this.store.labels[index]}: ${detalhe}`);
        concluidos.delete(index);
        continue;
      }

      concluidos.add(index);
    }

    this.store.syncCompleted(concluidos);
    return pendencias;
  }

  /**
   * Grava de novo cada passo anterior à Revisão que declara `persistir()` —
   * não só valida. A navegação entre passos é livre: o operador pode voltar
   * a um passo já gravado pelo stepper, editá-lo, e pular direto para a
   * Revisão sem passar pelo "avançar" que dispara `persistir()` de novo.
   * `validarRascunho()` só confere que o rascunho local está bem-formado —
   * não que bate com o que o servidor tem —, e sem esta varredura a
   * publicação confirmava sobre uma edição que nunca chegou ao servidor:
   * publica-se a configuração antiga enquanto o operador acredita publicar
   * a que acabou de editar (achado do Codex na #486, P1).
   *
   * Detectar "sujo" seção a seção exigiria um mapeamento de passo para
   * seção do `WizardDraft` que não existe em lugar nenhum do wizard de
   * propósito (`processo-seletivo.data.ts`: "nenhum componente de passo
   * declara a própria [posição]" — vale também para a seção) — e o
   * rascunho tem mais de um caminho de escrita (`patchObjectSection` do
   * operador, `patchSection`, `projetarSecao` de reconciliação com o
   * servidor), cada um por conta própria. Uma tentativa anterior comparou
   * um retrato do rascunho tirado após a hidratação contra o atual, e
   * quebrou toda retomada com edital confirmado porque a restauração do
   * anexo muda o rascunho de novo, assincronamente, depois do retrato — a
   * mesma classe de lacuna se repetiria a cada novo caminho de escrita que
   * aparecesse. Gravar de novo é mais caro (uma chamada a mais por passo já
   * visitado, mesmo sem edição), mas correto por construção: `persistir()`
   * de cada passo já é reenvio idempotente (`ChaveDeSubstituicao`), e
   * nenhum deles depende de `store.currentStep()` — todos já são chamados
   * genericamente por `gravarEAvancar()` fora desta varredura.
   */
  private async gravarPassosAnteriores(): Promise<string[]> {
    const pendencias: string[] = [];
    const geracao = this.store.geracao();

    for (let index = 0; index < this.store.totalSteps - 1; index += 1) {
      // Troca de processo em pleno voo — o operador navegou para outro
      // processo enquanto esta varredura sequencial ainda corria. Continuar
      // chamaria persistir() dos passos seguintes contra o rascunho do
      // processo NOVO, gravando lá por engano (achado do Codex na #486, P1
      // — o mais sério dos três desta rodada). Sai calada, sem pendência —
      // `publicar()` já confere `geracao` de novo ao voltar desta chamada e
      // não prossegue.
      if (geracao !== this.store.geracao()) return [];

      const validator = this.stepValidatorAt(index);
      if (validator === undefined) continue;

      // Confere localmente antes de tentar gravar — não só para poupar a
      // chamada, mas para não mandar ao servidor o comando de um passo que
      // o próprio operador ainda não terminou de preencher (um passo
      // posterior pode compor a partir do que este ainda não tem). Mantém
      // também a ordem e o texto que `validarRascunho()` já dava: quem lê
      // "Passo 1" quer o primeiro passo REALMENTE incompleto, não o
      // primeiro que por acaso declara `persistir()`.
      const conferencia = validator.validate();
      if (!conferencia.valid) {
        const detalhe = mensagensDe(conferencia).join(' ');
        pendencias.push(`Passo ${index + 1} — ${this.store.labels[index]}: ${detalhe}`);
        continue;
      }

      if (!validator.persistir) continue;

      const commit = await validator.persistir().catch(
        (): StepValidation => ({
          valid: false,
          messages: ['Não foi possível concluir a operação. Tente novamente.'],
        }),
      );

      if (geracao !== this.store.geracao()) return [];

      if (!commit.valid && commit.messages?.length !== 0) {
        const detalhe = mensagensDe(commit).join(' ');
        pendencias.push(`Passo ${index + 1} — ${this.store.labels[index]}: ${detalhe}`);
      }
    }

    return pendencias;
  }

  scrollToTop(): void {
    this.wizContent?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/** Normaliza `message` (forma simples) e `messages` (lista) para `string[]`. */
function mensagensDe(resultado: StepValidation): string[] {
  if (resultado.messages && resultado.messages.length > 0) return resultado.messages;
  return [resultado.message ?? 'Preencha os campos obrigatórios para continuar.'];
}
