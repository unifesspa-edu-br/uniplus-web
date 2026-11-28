import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  inject,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  acompanharLeitura,
  AlertComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  DialogComponent,
  SpinnerComponent,
  StepsResponsivoComponent,
  type StepItem,
} from '@uniplus/shared-ui/components';
import { andamentoDaPublicacao } from './andamento-da-publicacao';
import { ProcessoSeletivoStore } from './wizard/processo-seletivo.store';
import { PASSOS } from './wizard/processo-seletivo.data';
import { PASSO_DO_WIZARD } from './wizard/passo-do-wizard';
import { ConducaoDoWizard } from './editor/conducao-do-wizard.service';
import { FocoDoEditor } from './editor/foco-do-editor.service';
import { EnderecoDoEditor } from './editor/endereco-do-editor.service';
import { LeituraDoProcesso } from './editor/leitura-do-processo.service';
import { ResumoDoErroDoPassoComponent } from './editor/resumo-do-erro-do-passo.component';
import { CadastroInicial } from './wizard/shared/cadastro-inicial.service';
import { tituloDoPasso } from './wizard/shared/titulo-do-passo';
import { EnvioDoEdital } from './wizard/shared/envio-do-edital.service';
import { GravacaoDoProcesso } from './wizard/shared/gravacao/gravacao-do-processo';
import { GravacaoDosCamposPressupostos } from './wizard/shared/campos-pressupostos.service';
import { ReleituraDoSnapshot } from './wizard/shared/releitura-do-snapshot.service';
import { NumeracaoDasRespostasRecusadas } from './wizard/shared/recusas/numeracao-das-respostas-recusadas';
import { RecusasDaPublicacao } from './wizard/shared/recusas/recusas-da-publicacao.service';
import { TipoProcessoPassoComponent } from './wizard/passos/tipo-processo/tipo-processo.component';
import { IdentificacaoPassoComponent } from './wizard/passos/identificacao/identificacao.component';
import { PagamentoPassoComponent } from './wizard/passos/pagamento/pagamento.component';
import { VagasPassoComponent } from './wizard/passos/vagas/vagas.component';
import { CATALOGOS_DO_CRONOGRAMA } from './wizard/passos/cronograma/catalogos/catalogos-do-cronograma';
import { RecusasDaPublicacaoNoCronograma } from './wizard/passos/cronograma/servicos/recusas-da-publicacao-no-cronograma.service';
import { CronogramaPassoComponent } from './wizard/passos/cronograma/cronograma.component';
import { VocabulariosDaRegra } from './wizard/shared/deliberacao/vocabularios-da-regra.service';
import { FormularioPassoComponent } from './wizard/passos/formulario/formulario.component';
import { LeituraDoCadastroDePesos } from './wizard/passos/classificacao/leitura-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacao } from './wizard/passos/classificacao/catalogos-de-classificacao.service';
import { GravacaoDaClassificacao } from './wizard/passos/classificacao/gravacao-da-classificacao.service';
import { FormulaPassoComponent } from './wizard/passos/formula/formula.component';
import { FadaPassoComponent } from './wizard/passos/fada/fada.component';
import { DesempatePassoComponent } from './wizard/passos/desempate/desempate.component';
import { reavaliarRecusaPeloDesempate } from './wizard/passos/desempate/conferencia-do-desempate-gravado';
import { EliminacaoPassoComponent } from './wizard/passos/eliminacao/eliminacao.component';
import { AtendimentoPassoComponent } from './wizard/passos/atendimento/atendimento.component';
import { ProvaPresencialPassoComponent } from './wizard/passos/prova-presencial/prova-presencial.component';
import { RecusasDaPublicacaoNaProvaPresencial } from './wizard/passos/prova-presencial/recusas-da-publicacao-na-prova-presencial.service';
import { GravacaoDaProvaPresencialService } from './wizard/passos/prova-presencial/gravacao-da-prova-presencial.service';
import { RevisaoPassoComponent } from './wizard/passos/revisao/revisao.component';
import { avisarAoFecharAJanelaEnquanto } from './wizard/shared/aviso-ao-fechar-a-janela';

@Component({
  selector: 'sel-processo-seletivo',
  standalone: true,
  host: { class: 'sel-processo' },
  imports: [
    RouterLink,
    AlertComponent,
    DialogComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    ResumoDoErroDoPassoComponent,
    SpinnerComponent,
    TipoProcessoPassoComponent,
    IdentificacaoPassoComponent,
    PagamentoPassoComponent,
    VagasPassoComponent,
    CronogramaPassoComponent,
    FormularioPassoComponent,
    FormulaPassoComponent,
    FadaPassoComponent,
    DesempatePassoComponent,
    EliminacaoPassoComponent,
    AtendimentoPassoComponent,
    ProvaPresencialPassoComponent,
    RevisaoPassoComponent,
    StepsResponsivoComponent,
  ],
  providers: [
    ProcessoSeletivoStore,
    FocoDoEditor,
    ConducaoDoWizard,
    LeituraDoProcesso,
    EnderecoDoEditor,
    GravacaoDoProcesso,
    CadastroInicial,
    GravacaoDaProvaPresencialService,
    RecusasDaPublicacaoNaProvaPresencial,
    EnvioDoEdital,
    ...CATALOGOS_DO_CRONOGRAMA,
    GravacaoDosCamposPressupostos,
    CatalogosDeClassificacao,
    GravacaoDaClassificacao,
    LeituraDoCadastroDePesos,
    ReleituraDoSnapshot,
    NumeracaoDasRespostasRecusadas,
    RecusasDaPublicacao,
    RecusasDaPublicacaoNoCronograma,
  ],
  templateUrl: './processo-seletivo.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessoSeletivoPage {
  /** Os passos na ordem em que o template os declara. */
  private readonly passos = viewChildren(PASSO_DO_WIZARD);

  readonly store = inject(ProcessoSeletivoStore);
  protected readonly vocabulariosDaRegra = inject(VocabulariosDaRegra);
  protected readonly regraIndisponivel = computed(() => {
    const { fases, etapas } = this.store.draft().cronograma;
    const bancas = [
      ...fases.flatMap((fase) => fase.bancasRequeridas),
      ...etapas.flatMap((etapa) => etapa.bancas),
    ];
    return (
      this.store.cronogramaVisivel() &&
      this.vocabulariosDaRegra.indisponivel() &&
      bancas.some((banca) => banca.regraDeDeliberacao !== null)
    );
  });
  private readonly conducao = inject(ConducaoDoWizard);
  private readonly endereco = inject(EnderecoDoEditor);
  private readonly foco = inject(FocoDoEditor);
  private readonly cadastroDePesos = inject(LeituraDoCadastroDePesos);
  private readonly catalogosDeClassificacao = inject(CatalogosDeClassificacao);

  readonly passoCorrente = computed(() => PASSOS[this.store.passoAtual()]);
  readonly podePublicar = this.conducao.podePublicar;
  readonly confirmacaoPendente = this.conducao.confirmacaoPendente;
  readonly restaurarFocoAoFechar = this.conducao.restaurarFocoAoFechar;
  readonly atoDigitadoPendente = this.endereco.atoDigitadoPendente;

  /** Só a falha temporária admite repetir a leitura; as demais descrevem o endereço. */
  protected readonly leituraDoProcesso = acompanharLeitura({
    falha: computed(() => {
      const falha = this.store.falhaDeLeitura();
      return falha?.motivo === 'falhaTemporaria' ? falha.mensagem : null;
    }),
    pendente: this.store.hidratando,
    recarregar: () => this.endereco.tentarNovamente(),
    destino: tituloDoPasso,
    recusada: computed(() => {
      const falha = this.store.falhaDeLeitura();
      return falha !== null && falha.motivo !== 'falhaTemporaria';
    }),
  });

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

  /** Só `publicar()` liga `travamentoDeOrquestracao`: distingue a conferência da gravação de um passo. */
  protected readonly andamentoDaPublicacao = computed(() =>
    andamentoDaPublicacao(this.store.travamentoDeOrquestracao()),
  );

  /** No último passo o avanço só publica, e publicar exige rascunho e a permissão de publicar. */
  readonly ofereceAvanco = computed(
    () => !this.store.isLast() || (this.store.edicaoPermitida() && this.podePublicar()),
  );

  private readonly etapas = viewChild(StepsResponsivoComponent);
  private readonly rodape = viewChild<ElementRef<HTMLElement>>('wizFooter');

  constructor() {
    this.conducao.conectar(this.passos);
    avisarAoFecharAJanelaEnquanto(this.atoDigitadoPendente);
    this.esquecerAConfirmacaoAoTrocarDePasso();
    this.reavaliarARecusaPeloDesempate();
    this.foco.observarReservas(
      () => this.etapas()?.barra()?.nativeElement,
      () => this.rodape()?.nativeElement,
    );
    this.focarOTituloAoTrocarDePasso();
    this.endereco.acompanhar();
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
