import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  ElementRef,
  effect,
  inject,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  ProblemI18nService,
  isApiOk,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import {
  FinalidadeDoDocumento,
  ProcessoSeletivoDto,
  ProcessosSeletivosApi,
} from '@uniplus/shared-data/selecao';
import {
  AlertComponent,
  DialogComponent,
  SpinnerComponent,
  StepsResponsivoComponent,
  type StepItem,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { ProcessoSeletivoStore } from './steps/processo-seletivo.store';
import { PASSOS } from './steps/processo-seletivo.data';
import { PASSO_DO_WIZARD } from './steps/passo-do-wizard';
import { ConducaoDoWizard } from './editor/conducao-do-wizard.service';
import { FocoDoEditor } from './editor/foco-do-editor.service';
import { RascunhoDaPublicacao } from './editor/rascunho-da-publicacao.service';
import { CadastroInicialService } from './steps/shared/cadastro-inicial.service';
import { EnvioDoEdital } from './steps/shared/envio-do-edital.service';
import { GravacaoDoProcesso } from './steps/shared/gravacao/gravacao-do-processo';
import { CamposPressupostosService } from './steps/shared/campos-pressupostos.service';
import { ReleituraDoSnapshot } from './steps/shared/releitura-do-snapshot.service';
import { TipoProcessoStepComponent } from './steps/steps/tipo-processo/tipo-processo.component';
import { IdentificacaoStepComponent } from './steps/steps/identificacao/identificacao.component';
import { PagamentoStepComponent } from './steps/steps/pagamento/pagamento.component';
import { VagasStepComponent } from './steps/steps/vagas/vagas.component';
import { CatalogosDoCronogramaService } from './steps/steps/cronograma/catalogos-do-cronograma.service';
import { CronogramaStepComponent } from './steps/steps/cronograma/cronograma.component';
import { FormularioStepComponent } from './steps/steps/formulario/formulario.component';
import { AcompanhamentoDoCadastroDePesos } from './steps/steps/classificacao/acompanhamento-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacaoService } from './steps/steps/classificacao/catalogos-de-classificacao.service';
import { FormulaStepComponent } from './steps/steps/formula/formula.component';
import { BonusStepComponent } from './steps/steps/bonus/bonus.component';
import { DesempateStepComponent } from './steps/steps/desempate/desempate.component';
import { reavaliarRecusaPeloDesempate } from './steps/steps/desempate/quadro-do-desempate';
import { EliminacaoStepComponent } from './steps/steps/eliminacao/eliminacao.component';
import { AtendimentoStepComponent } from './steps/steps/atendimento/atendimento.component';
import { RevisaoStepComponent } from './steps/steps/revisao/revisao.component';
import { classificarDocumentos } from './steps/shared/hidratacao';
import { passosConcluidosDe } from './steps/shared/passos-concluidos';
import {
  AVISO_DE_RASCUNHO_NAO_GRAVADO,
  ConfirmacaoDeSaida,
} from './steps/shared/rascunho-nao-gravado.guard';
import type { MotivoFalhaDeLeitura } from './steps/processo-seletivo.models';

/** Formato do `:id` na rota — recusar aqui poupa uma ida ao servidor com lixo. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 404 e 403 descrevem o endereço, não uma indisponibilidade: repetir a leitura daria o mesmo
 * resultado, e a saída é voltar à listagem. O resto admite retentativa. */
function motivoDe(status: number): MotivoFalhaDeLeitura {
  if (status === STATUS_HTTP.NAO_ENCONTRADO) return 'naoEncontrado';
  if (status === STATUS_HTTP.SEM_PERMISSAO || status === STATUS_HTTP.NAO_AUTENTICADO) {
    return 'semPermissao';
  }
  return 'falhaTemporaria';
}

@Component({
  selector: 'sel-processo-seletivo',
  standalone: true,
  host: { class: 'sel-processo', '(window:beforeunload)': 'aoFecharAJanela($event)' },
  imports: [
    DateBrPipe,
    RouterLink,
    AlertComponent,
    DialogComponent,
    SpinnerComponent,
    TipoProcessoStepComponent,
    IdentificacaoStepComponent,
    PagamentoStepComponent,
    VagasStepComponent,
    CronogramaStepComponent,
    FormularioStepComponent,
    FormulaStepComponent,
    BonusStepComponent,
    DesempateStepComponent,
    EliminacaoStepComponent,
    AtendimentoStepComponent,
    RevisaoStepComponent,
    StepsResponsivoComponent,
  ],
  providers: [
    ProcessoSeletivoStore,
    FocoDoEditor,
    RascunhoDaPublicacao,
    ConducaoDoWizard,
    GravacaoDoProcesso,
    CadastroInicialService,
    EnvioDoEdital,
    CatalogosDoCronogramaService,
    CamposPressupostosService,
    CatalogosDeClassificacaoService,
    AcompanhamentoDoCadastroDePesos,
    ReleituraDoSnapshot,
  ],
  templateUrl: './processo-seletivo.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessoSeletivoPage {
  /** Os passos na ordem em que o template os declara. */
  private readonly passos = viewChildren(PASSO_DO_WIZARD);

  readonly passoCorrente = computed(() => PASSOS[this.store.currentStep()]);

  readonly store = inject(ProcessoSeletivoStore);
  private readonly rascunho = inject(RascunhoDaPublicacao);
  private readonly conducao = inject(ConducaoDoWizard);

  readonly rascunhoPendente = this.rascunho.pendente;
  readonly rascunhoSalvoEm = this.rascunho.salvoEm;
  readonly avisoDoRascunho = this.rascunho.aviso;
  readonly salvandoRascunho = this.rascunho.salvando;
  readonly falhaDoRascunho = this.rascunho.falha;
  private readonly foco = inject(FocoDoEditor);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly releitura = inject(ReleituraDoSnapshot);
  private readonly cadastroDePesos = inject(AcompanhamentoDoCadastroDePesos);
  private readonly catalogosDeClassificacao = inject(CatalogosDeClassificacaoService);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly confirmacaoDeSaida = inject(ConfirmacaoDeSaida);

  readonly podePublicar = this.conducao.podePublicar;

  protected readonly itensDosPassos = computed<StepItem[]>(() =>
    this.store.labels.map((rotulo, index) => ({
      rotulo,
      status: this.store.status(index),
      concluido: this.store.completedSteps().has(index),
    })),
  );

  /** Vez da leitura em curso — respostas de vezes anteriores são descartadas. */
  private leituraEmCurso = 0;

  readonly confirmacaoPendente = this.conducao.confirmacaoPendente;
  readonly restaurarFocoAoFechar = this.conducao.restaurarFocoAoFechar;

  /**
   * Rótulo do botão de avanço. O passo aberto pode dizer o seu; sem isso, o
   * shell diz "Próximo" — e "Publicar" no último. Um botão que grava e diz
   * "Próximo" descreve a navegação e esconde o efeito.
   */
  readonly rotuloDeAvanco = computed(() => {
    if (!this.store.edicaoPermitida()) return 'Próximo';
    if (this.store.isLast()) return 'Publicar';
    const passo = this.conducao.passoNo(this.store.currentStep());
    return passo?.rotuloDeAvanco?.() ?? 'Próximo';
  });

  /** No último passo o avanço só publica, e publicar exige rascunho e a permissão de publicar. */
  readonly ofereceAvanco = computed(
    () => !this.store.isLast() || (this.store.edicaoPermitida() && this.podePublicar()),
  );

  private readonly etapas = viewChild(StepsResponsivoComponent);
  private readonly rodape = viewChild<ElementRef<HTMLElement>>('wizFooter');

  constructor() {
    this.conducao.conectar(this.passos);

    // Um resumo aberto vale para o passo que o produziu. Trocar de passo — pelo
    // stepper, pelo histórico do navegador ou por uma troca de processo, já que
    // a rota reusa esta página — o torna obsoleto, e confirmá-lo depois
    // aplicaria a decisão lida numa tela ao efeito de outra.
    effect(() => {
      this.store.currentStep();
      untracked(() => this.confirmacaoPendente.set(null));
    });

    // Cada leitura do cadastro de Peso por Área que dá certo, e cada mudança nos critérios de
    // desempate gravados, pode mostrar que acabou a pendência pela qual o servidor recusou a
    // classificação.
    effect(() => {
      this.catalogosDeClassificacao.pesosLidosNaLeitura();
      this.store.classificacao.criteriosDesempateGravados();
      untracked(() => reavaliarRecusaPeloDesempate(this.store, this.cadastroDePesos.leitura()));
    });

    this.foco.observarReservas(
      () => this.etapas()?.barra()?.nativeElement,
      () => this.rodape()?.nativeElement,
    );

    effect(() => {
      this.store.currentStep();
      // Numa entrada por `/:id` o painel só existe depois da leitura; sem
      // observar `hidratando`, o foco ficaria preso no estado de carregamento.
      this.store.hidratando();
      queueMicrotask(() => this.foco.focarTituloDoPasso());
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
          if (!this.podeTrocarDeProcesso()) {
            this.voltarAoProcessoAberto();
            return;
          }

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

      // A guarda da rota não roda aqui: mudar só o `:id` reusa a rota, e o componente nunca é
      // desativado. Sem perguntar neste ponto, a promessa dela valia para sair do editor e não
      // para trocar de processo — e é `retomar()` quem apaga a transcrição, logo em seguida.
      if (!this.podeTrocarDeProcesso()) {
        this.voltarAoProcessoAberto();
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
    await this.rascunho.restaurar(id, superada);
    if (superada()) return;
    await this.derivarPassosConcluidos(detalhe.data, superada);
    if (superada()) return;

    this.store.hidratando.set(false);
  }

  /**
   * O stepper de um processo retomado mostra o que o servidor tem gravado e conforme, não a
   * navegação desta sessão — que recomeça vazia a cada abertura. Sem o checklist não há como
   * afirmar a conformidade, então nenhum passo é dado por concluído: o mesmo estado de antes,
   * em vez de um verde que a Revisão contradiria.
   */
  private async derivarPassosConcluidos(
    detalhe: ProcessoSeletivoDto,
    superada: () => boolean,
  ): Promise<void> {
    const checklist = await firstValueFrom(this.api.obterConformidade(detalhe.id));
    if (superada() || !isApiOk(checklist)) return;
    this.store.syncCompleted(passosConcluidosDe(detalhe, checklist.data.itens));
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
    if (!this.podePublicar()) return;
    const resultado = await firstValueFrom(
      this.api.listarDocumentosAPublicar(processoSeletivoId, FinalidadeDoDocumento.documentoDoEdital),
    );
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
   * A guarda de saída — a rede que torna o botão de gravar suficiente.
   *
   * São dois mecanismos, e não três: trocar de passo dentro do wizard não perde nada, porque
   * `goTo` mexe só no passo corrente e o rascunho continua no store. O que perde é sair do
   * editor (tratado pelo `CanDeactivate` da rota) e recarregar ou fechar a aba, que é este.
   *
   * O navegador ignora qualquer texto que se ponha aqui e mostra o aviso genérico dele — por
   * isso não há mensagem a escrever, só o `preventDefault` que pede a confirmação.
   */
  protected aoFecharAJanela(evento: BeforeUnloadEvent): void {
    if (!this.rascunhoPendente()) return;
    evento.preventDefault();
  }

  protected salvarRascunhoDaPublicacao(): Promise<void> {
    return this.rascunho.salvar();
  }

  protected descartarRascunhoDaPublicacao(): Promise<void> {
    return this.rascunho.descartar();
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
    this.catalogosDeClassificacao.esquecerPesosAreaEnem();

    // A rota reusa esta página, então um resumo aberto sobrevive à troca de
    // processo se ninguém o descartar. Confirmá-lo depois resolveria o passo
    // pelo estado novo enquanto exibia os dados do editor anterior — o resumo
    // vale para o rascunho que o produziu, e esse rascunho acabou de sumir.
    this.conducao.confirmacaoPendente.set(null);

    // Mesmo motivo do resumo: o rastro do rascunho descreve o processo que estava aberto. Sem
    // esquecê-lo, a guarda de saída perguntaria sobre a transcrição do processo anterior.
    this.rascunho.esquecer();
  }

  /** Há transcrição por gravar, e quem está trocando de processo concordou em perdê-la? */
  private podeTrocarDeProcesso(): boolean {
    if (!this.rascunhoPendente()) return true;
    return this.confirmacaoDeSaida.confirmar(AVISO_DE_RASCUNHO_NAO_GRAVADO);
  }

  /**
   * Devolve o endereço ao processo que continua em tela.
   *
   * A assinatura do parâmetro dispara de novo, e o ramo que reconhece o processo já aberto não
   * relê nada — é por isso que voltar aqui não custa a transcrição que a recusa acabou de
   * proteger.
   */
  private voltarAoProcessoAberto(): void {
    const aberto = this.store.processoSeletivoId();

    // Sem processo aberto, o editor está no cadastro novo: é para lá que o endereço volta.
    // Deixá-lo no `:id` recusado punha o cadastro em andamento sob o endereço de outro
    // processo — e, ao criar, o efeito que ajusta a URL desistiria, porque ela já traz um id.
    void this.router.navigate(
      aberto === null ? ['/processo-seletivo', 'novo'] : ['/processo-seletivo', aberto],
      { replaceUrl: true },
    );
  }

  /** Repete a leitura do endereço atual, para as falhas que admitem retentativa. */
  protected tentarNovamente(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id !== null && !this.store.hidratando()) void this.retomar(id);
  }

  previous(): void {
    if (this.store.operacaoEmAndamento()) return;
    this.store.previous();
  }

  nextOrPublish(): Promise<void> {
    return this.conducao.avancar();
  }

  confirmarGravacao(): Promise<void> {
    return this.conducao.confirmarGravacao();
  }

  cancelarGravacao(): void {
    this.conducao.cancelarGravacao();
  }

  protected irParaPasso(index: number): void {
    this.store.goTo(index);
  }

  /**
   * O passo atual escolhido de novo na lista em diálogo não troca o passo, e o diálogo, ao fechar, não
   * devolve o foco a lugar nenhum: o foco vai ao título. Na coluna lateral nada disso acontece.
   */
  protected focarTituloAposAEscolha(): void {
    queueMicrotask(() => this.foco.focarTituloDoPasso());
  }
}
