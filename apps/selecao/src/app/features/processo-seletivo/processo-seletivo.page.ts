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
import { LeituraDoProcesso } from './editor/leitura-do-processo.service';
import { RascunhoDaPublicacao } from './editor/rascunho-da-publicacao.service';
import { CadastroInicial } from './steps/shared/cadastro-inicial.service';
import { EnvioDoEdital } from './steps/shared/envio-do-edital.service';
import { GravacaoDoProcesso } from './steps/shared/gravacao/gravacao-do-processo';
import { GravacaoDosCamposPressupostos } from './steps/shared/campos-pressupostos.service';
import { ReleituraDoSnapshot } from './steps/shared/releitura-do-snapshot.service';
import { TipoProcessoPassoComponent } from './steps/steps/tipo-processo/tipo-processo.component';
import { IdentificacaoPassoComponent } from './steps/steps/identificacao/identificacao.component';
import { PagamentoPassoComponent } from './steps/steps/pagamento/pagamento.component';
import { VagasPassoComponent } from './steps/steps/vagas/vagas.component';
import { CatalogosDoCronograma } from './steps/steps/cronograma/catalogos-do-cronograma.service';
import { CronogramaPassoComponent } from './steps/steps/cronograma/cronograma.component';
import { FormularioPassoComponent } from './steps/steps/formulario/formulario.component';
import { LeituraDoCadastroDePesos } from './steps/steps/classificacao/leitura-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacao } from './steps/steps/classificacao/catalogos-de-classificacao.service';
import { FormulaPassoComponent } from './steps/steps/formula/formula.component';
import { BonusPassoComponent } from './steps/steps/bonus/bonus.component';
import { DesempatePassoComponent } from './steps/steps/desempate/desempate.component';
import { reavaliarRecusaPeloDesempate } from './steps/steps/desempate/conferencia-do-desempate-gravado';
import { EliminacaoPassoComponent } from './steps/steps/eliminacao/eliminacao.component';
import { AtendimentoPassoComponent } from './steps/steps/atendimento/atendimento.component';
import { RevisaoPassoComponent } from './steps/steps/revisao/revisao.component';
import {
  AVISO_DE_RASCUNHO_NAO_GRAVADO,
  ConfirmacaoDeSaida,
} from './steps/shared/rascunho-nao-gravado.guard';

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
    TipoProcessoPassoComponent,
    IdentificacaoPassoComponent,
    PagamentoPassoComponent,
    VagasPassoComponent,
    CronogramaPassoComponent,
    FormularioPassoComponent,
    FormulaPassoComponent,
    BonusPassoComponent,
    DesempatePassoComponent,
    EliminacaoPassoComponent,
    AtendimentoPassoComponent,
    RevisaoPassoComponent,
    StepsResponsivoComponent,
  ],
  providers: [
    ProcessoSeletivoStore,
    FocoDoEditor,
    RascunhoDaPublicacao,
    ConducaoDoWizard,
    LeituraDoProcesso,
    GravacaoDoProcesso,
    CadastroInicial,
    EnvioDoEdital,
    CatalogosDoCronograma,
    GravacaoDosCamposPressupostos,
    CatalogosDeClassificacao,
    LeituraDoCadastroDePesos,
    ReleituraDoSnapshot,
  ],
  templateUrl: './processo-seletivo.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessoSeletivoPage {
  /** Os passos na ordem em que o template os declara. */
  private readonly passos = viewChildren(PASSO_DO_WIZARD);

  readonly store = inject(ProcessoSeletivoStore);
  private readonly conducao = inject(ConducaoDoWizard);
  private readonly leitura = inject(LeituraDoProcesso);
  private readonly rascunho = inject(RascunhoDaPublicacao);
  private readonly foco = inject(FocoDoEditor);
  private readonly cadastroDePesos = inject(LeituraDoCadastroDePesos);
  private readonly catalogosDeClassificacao = inject(CatalogosDeClassificacao);
  private readonly confirmacaoDeSaida = inject(ConfirmacaoDeSaida);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly passoCorrente = computed(() => PASSOS[this.store.passoAtual()]);
  readonly podePublicar = this.conducao.podePublicar;
  readonly confirmacaoPendente = this.conducao.confirmacaoPendente;
  readonly restaurarFocoAoFechar = this.conducao.restaurarFocoAoFechar;
  readonly rascunhoPendente = this.rascunho.pendente;
  readonly rascunhoSalvoEm = this.rascunho.salvoEm;
  readonly avisoDoRascunho = this.rascunho.aviso;
  readonly salvandoRascunho = this.rascunho.salvando;
  readonly falhaDoRascunho = this.rascunho.falha;

  protected readonly itensDosPassos = computed<StepItem[]>(() =>
    this.store.labels.map((rotulo, index) => ({
      rotulo,
      status: this.store.status(index),
      concluido: this.store.passosConcluidos().has(index),
    })),
  );

  /**
   * Rótulo do botão de avanço. O passo aberto pode dizer o seu; sem isso, o
   * shell diz "Próximo" — e "Publicar" no último. Um botão que grava e diz
   * "Próximo" descreve a navegação e esconde o efeito.
   */
  readonly rotuloDeAvanco = computed(() => {
    if (!this.store.edicaoPermitida()) return 'Próximo';
    if (this.store.isLast()) return 'Publicar';
    const passo = this.conducao.passoNo(this.store.passoAtual());
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
    this.esquecerAConfirmacaoAoTrocarDePasso();
    this.reavaliarARecusaPeloDesempate();
    this.foco.observarReservas(
      () => this.etapas()?.barra()?.nativeElement,
      () => this.rodape()?.nativeElement,
    );
    this.focarOTituloAoTrocarDePasso();
    this.darEnderecoAoProcessoCriado();
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.aoMudarOEndereco(params.get('id')));
  }

  /**
   * Um resumo aberto vale para o passo que o produziu. Trocar de passo — pelo stepper, pelo
   * histórico do navegador ou por uma troca de processo, já que a rota reusa esta página — o torna
   * obsoleto, e confirmá-lo depois aplicaria a decisão lida numa tela ao efeito de outra.
   */
  private esquecerAConfirmacaoAoTrocarDePasso(): void {
    effect(() => {
      this.store.passoAtual();
      untracked(() => this.confirmacaoPendente.set(null));
    });
  }

  /**
   * Cada leitura do cadastro de Peso por Área que dá certo, e cada mudança nos critérios de
   * desempate gravados, pode mostrar que acabou a pendência pela qual o servidor recusou a
   * classificação.
   */
  private reavaliarARecusaPeloDesempate(): void {
    effect(() => {
      this.catalogosDeClassificacao.pesosLidosNaLeitura();
      this.store.classificacao.criteriosDesempateGravados();
      untracked(() => reavaliarRecusaPeloDesempate(this.store, this.cadastroDePesos.leitura()));
    });
  }

  private focarOTituloAoTrocarDePasso(): void {
    effect(() => {
      this.store.passoAtual();
      // Numa entrada por `/:id` o painel só existe depois da leitura; sem
      // observar `hidratando`, o foco ficaria preso no estado de carregamento.
      this.store.hidratando();
      queueMicrotask(() => this.foco.focarTituloDoPasso());
    });
  }

  /**
   * CA-04: assim que a criação — disparada dentro do passo 2 — devolve o id, o endereço passa a
   * contê-lo. Sem isto, recarregar `/novo` depois de já ter criado perderia o vínculo, e o passo 2
   * dispararia um segundo POST para o mesmo rascunho.
   *
   * A transição preserva esta instância: as duas rotas do editor declaram a mesma `reuseKey` (ver
   * `editor-route-reuse.strategy.ts`). Sem isso o wizard voltaria ao passo 1 no meio do anexo do
   * edital, que é quando a criação responde. `replaceUrl` porque não é navegação nova — é o mesmo
   * cadastro ganhando endereço próprio.
   */
  private darEnderecoAoProcessoCriado(): void {
    effect(() => {
      const id = this.store.processoSeletivoId();
      if (id === null) return;
      untracked(() => {
        if (this.route.snapshot.paramMap.get('id') !== null) return;
        void this.router.navigate(['/processo-seletivo', id], { replaceUrl: true });
      });
    });
  }

  /**
   * Reage ao parâmetro, e não o lê uma vez: com a rota reusada o construtor não roda de novo, então
   * abrir outro processo pelo endereço precisa disparar a leitura aqui. O id assumido logo após a
   * criação não relê nada — o editor já tem o que acabou de gravar.
   */
  private aoMudarOEndereco(id: string | null): void {
    if (id === null) {
      this.aoEntrarEmProcessoNovo();
    } else if (id === this.store.processoSeletivoId()) {
      this.aoVoltarAoProcessoEmTela(id);
    } else if (this.podeTrocarDeProcesso()) {
      void this.leitura.retomar(id);
    } else {
      // A guarda da rota não roda aqui: mudar só o `:id` reusa a rota, e o componente nunca é
      // desativado. Sem perguntar neste ponto, a promessa dela valia para sair do editor e não
      // para trocar de processo — e é `retomar()` quem apaga a transcrição, logo em seguida.
      this.voltarAoProcessoAberto();
    }
  }

  /**
   * Entrar em `/novo` com a página reusada de um processo já carregado deixaria o cadastro anterior
   * em tela sob o endereço de cadastro novo — com os campos congelados e o id de outro processo no
   * store, o que o operador continuasse preenchendo iria para o processo errado.
   *
   * `hidratando` entra na conta: uma leitura ainda em voo não deixou rastro nos outros dois
   * sinais, e sua resposta hidrataria o processo sob `/novo` — o efeito do id levaria de volta a
   * ele em seguida.
   */
  private aoEntrarEmProcessoNovo(): void {
    const tinhaProcesso =
      this.store.processoSeletivoId() !== null ||
      this.store.falhaDeLeitura() !== null ||
      this.store.hidratando();
    if (!tinhaProcesso) return;

    if (!this.podeTrocarDeProcesso()) {
      this.voltarAoProcessoAberto();
      return;
    }
    this.leitura.abandonar();
  }

  /**
   * Voltar ao processo que já está em tela não relê nada — exceto quando a ida a outro endereço
   * interrompeu a leitura no meio. Aí o que ficou é um estado parcial: o detalhe hidratou, a
   * resposta dos documentos foi descartada, e o editor não sabe se existe edital. Ler de novo é
   * mais seguro do que consertar sinal por sinal — foi remendando esses sinais que se chegou a um
   * anexo destravado sobre estado desconhecido.
   */
  private aoVoltarAoProcessoEmTela(id: string): void {
    if (this.store.falhaDeLeitura() !== null || this.store.hidratando()) {
      void this.leitura.retomar(id);
    }
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
    if (id !== null && !this.store.hidratando()) void this.leitura.retomar(id);
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
