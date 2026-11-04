import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import { type StepValidation } from '../../processo-seletivo.models';
import { FaseStepComponent } from '../fase/fase.component';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { EtapasOrfasComponent } from './etapas-orfas.component';
import { DadosDaFaseComponent } from './fase/dados-da-fase.component';
import { CabecalhoDaFaseComponent } from './fase/cabecalho-da-fase.component';
import { NovaFaseComponent } from './fase/nova-fase.component';
import { ConvencaoDeContagemComponent } from './convencao-de-contagem.component';
import { FaseEmConsultaComponent } from './consulta/fase-em-consulta.component';
import { CatalogosDoCronograma } from './catalogos-do-cronograma.service';
import { ConferenciaDoCronograma } from './servicos/conferencia-do-cronograma.service';
import { EdicaoDaEtapa } from './servicos/edicao-da-etapa.service';
import { ExpansaoDoCronograma } from './servicos/expansao-do-cronograma.service';
import { FormularioDoCronograma } from './servicos/formulario-do-cronograma.service';
import { GravacaoDasExigenciasDocumentais } from './servicos/gravacao-das-exigencias-documentais.service';
import { GravacaoDoCronograma } from './servicos/gravacao-do-cronograma.service';
import { LeituraDaLinhaDoTempo } from './servicos/leitura-da-linha-do-tempo.service';
import { RecusasDoServidorNasEtapas } from './servicos/recusas-do-servidor-nas-etapas.service';
import { ReleituraDasEtapas } from './servicos/releitura-das-etapas.service';
import { UnidadesResponsaveisDasFases } from './servicos/unidades-responsaveis-das-fases.service';
import { convencaoLida } from './convencao-de-contagem';
import { EtapasDaFaseComponent } from './fase/etapas-da-fase.component';

@Component({
  selector: 'sel-step-cronograma',
  imports: [
    ValorEmConsultaComponent,
    ReactiveFormsModule,
    FaseStepComponent,
    FaseEmConsultaComponent,
    ConvencaoDeContagemComponent,
    NovaFaseComponent,
    CabecalhoDaFaseComponent,
    DadosDaFaseComponent,
    EtapasOrfasComponent,
    EtapasDaFaseComponent,
  ],
  templateUrl: './cronograma.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provePassoDoWizard(CronogramaStepComponent),
    UnidadesResponsaveisDasFases,
    ReleituraDasEtapas,
    FormularioDoCronograma,
    RecusasDoServidorNasEtapas,
    EdicaoDaEtapa,
    LeituraDaLinhaDoTempo,
    ConferenciaDoCronograma,
    GravacaoDasExigenciasDocumentais,
    GravacaoDoCronograma,
    ExpansaoDoCronograma,
  ],
})
export class CronogramaStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDoCronograma);
  protected readonly releituraDasEtapas = inject(ReleituraDasEtapas);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly conferencia = inject(ConferenciaDoCronograma);
  protected readonly gravacao = inject(GravacaoDoCronograma);
  protected readonly leitura = inject(LeituraDaLinhaDoTempo);
  protected readonly expansao = inject(ExpansaoDoCronograma);

  readonly formulario = this.cronograma.formulario;
  readonly fases = this.cronograma.fases;
  readonly etapas = this.cronograma.etapas;
  readonly linhaDoTempo = this.cronograma.linhaDoTempo;
  readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  readonly avisoDeReordenacao = this.cronograma.avisoDeReordenacao;
  readonly releituraPendente = this.releituraDasEtapas.releituraPendente;
  readonly relendo = this.releituraDasEtapas.relendo;
  readonly erroDeReleitura = this.releituraDasEtapas.erroDeReleitura;
  private readonly versaoDoFormulario = this.cronograma.versao;

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
