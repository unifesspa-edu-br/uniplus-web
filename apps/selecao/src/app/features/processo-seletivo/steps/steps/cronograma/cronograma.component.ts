import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import { ValorLegivelDirective, ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import { type StepValidation } from '../../processo-seletivo.models';
import { FaseStepComponent } from '../fase/fase.component';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CamposPressupostosService } from '../../shared/campos-pressupostos.service';
import { EtapasOrfasComponent } from './etapas-orfas.component';
import { DadosDaFaseComponent } from './fase/dados-da-fase.component';
import { CabecalhoDaFaseComponent } from './fase/cabecalho-da-fase.component';
import { NovaFaseComponent } from './fase/nova-fase.component';
import { ConvencaoDeContagemComponent } from './convencao-de-contagem.component';
import { FaseEmConsultaComponent } from './consulta/fase-em-consulta.component';
import { CatalogosDoCronogramaService } from './catalogos-do-cronograma.service';
import { ConferenciaDoCronograma } from './servicos/conferencia-do-cronograma.service';
import { pisoDeData } from './cronograma-form';
import { EdicaoDaEtapa } from './servicos/edicao-da-etapa.service';
import { ExpansaoDoCronograma } from './servicos/expansao-do-cronograma.service';
import { FormularioDoCronograma } from './servicos/formulario-do-cronograma.service';
import { GravacaoDasExigenciasDocumentais } from './servicos/gravacao-das-exigencias-documentais.service';
import { GravacaoDoCronograma } from './servicos/gravacao-do-cronograma.service';
import { LeituraDaLinhaDoTempo } from './servicos/leitura-da-linha-do-tempo.service';
import { RecusasDasEtapas } from './servicos/recusas-das-etapas.service';
import { ReconciliacaoDasEtapas } from './servicos/reconciliacao-das-etapas.service';
import { UnidadesDasFases } from './servicos/unidades-das-fases.service';
import { convencaoLida } from './convencao-de-contagem';
import { ItensDeAvaliacaoDaEtapaComponent } from './itens-de-avaliacao-da-etapa.component';
import { RecursosDaEtapaComponent } from './etapa/recursos-da-etapa.component';

@Component({
  selector: 'sel-step-cronograma',
  imports: [
    ItensDeAvaliacaoDaEtapaComponent,
    ValorLegivelDirective,
    ValorEmConsultaComponent,
    ReactiveFormsModule,
    FaseStepComponent,
    FaseEmConsultaComponent,
    ConvencaoDeContagemComponent,
    NovaFaseComponent,
    CabecalhoDaFaseComponent,
    DadosDaFaseComponent,
    EtapasOrfasComponent,
    RecursosDaEtapaComponent,
  ],
  templateUrl: './cronograma.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provePassoDoWizard(CronogramaStepComponent),
    UnidadesDasFases,
    ReconciliacaoDasEtapas,
    FormularioDoCronograma,
    RecusasDasEtapas,
    EdicaoDaEtapa,
    LeituraDaLinhaDoTempo,
    ConferenciaDoCronograma,
    GravacaoDasExigenciasDocumentais,
    GravacaoDoCronograma,
    ExpansaoDoCronograma,
  ],
})
export class CronogramaStepComponent {
  private readonly destroyRef = inject(DestroyRef);
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDoCronogramaService);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly camposPressupostos = inject(CamposPressupostosService);
  private readonly injector = inject(Injector);
  protected readonly unidades = inject(UnidadesDasFases);
  protected readonly reconciliacao = inject(ReconciliacaoDasEtapas);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly recusas = inject(RecusasDasEtapas);
  protected readonly conferencia = inject(ConferenciaDoCronograma);
  protected readonly gravacao = inject(GravacaoDoCronograma);
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly leitura = inject(LeituraDaLinhaDoTempo);
  protected readonly expansao = inject(ExpansaoDoCronograma);

  readonly formulario = this.cronograma.formulario;
  readonly fases = this.cronograma.fases;
  readonly etapas = this.cronograma.etapas;
  readonly linhaDoTempo = this.cronograma.linhaDoTempo;
  readonly fasesDisponiveis = this.cronograma.fasesDisponiveis;
  readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  readonly avisoDeReordenacao = this.cronograma.avisoDeReordenacao;
  readonly reconciliacaoPendente = this.reconciliacao.reconciliacaoPendente;
  readonly relendo = this.reconciliacao.relendo;
  readonly erroDeReleitura = this.reconciliacao.erroDeReleitura;
  private readonly versaoDoFormulario = this.cronograma.versao;

  readonly pisoDeData = pisoDeData;
  readonly algoritmoDeclaradoNoServidor = this.gravacao.algoritmoDeclaradoNoServidor;

  constructor() {
    this.catalogos.carregar();
  }

  readonly convencaoDeContagemLida = computed(() => {
    this.versaoDoFormulario();
    const { algoritmoContagemCodigo, algoritmoContagemVersao } = this.formulario.controls;
    return convencaoLida(algoritmoContagemCodigo.value, algoritmoContagemVersao.value);
  });

  validate(): StepValidation {
    return this.conferencia.validar();
  }

  persistir(): Promise<StepValidation> {
    return this.gravacao.persistir();
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }
}
