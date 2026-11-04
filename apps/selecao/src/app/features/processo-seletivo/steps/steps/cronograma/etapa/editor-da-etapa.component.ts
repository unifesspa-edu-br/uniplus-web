import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import type { EtapaForm } from '../cronograma-form';
import { ItensDeAvaliacaoDaEtapaComponent } from '../itens-de-avaliacao-da-etapa.component';
import { EdicaoDaEtapa } from '../servicos/edicao-da-etapa.service';
import { ExpansaoDoCronograma } from '../servicos/expansao-do-cronograma.service';
import {
  FormularioDoCronograma,
  type FaseNaLinhaDoTempo,
} from '../servicos/formulario-do-cronograma.service';
import { RecusasDasEtapas } from '../servicos/recusas-das-etapas.service';
import { BancasDaEtapaComponent } from './bancas-da-etapa.component';
import { CabecalhoDaEtapaComponent } from './cabecalho-da-etapa.component';
import { JanelaDaEtapaComponent } from './janela-da-etapa.component';
import { PublicacoesDaEtapaComponent } from './publicacoes-da-etapa.component';
import { RecursosDaEtapaComponent } from './recursos-da-etapa.component';

@Component({
  selector: 'sel-editor-da-etapa',
  imports: [
    ValorLegivelDirective,
    ReactiveFormsModule,
    CabecalhoDaEtapaComponent,
    JanelaDaEtapaComponent,
    BancasDaEtapaComponent,
    PublicacoesDaEtapaComponent,
    RecursosDaEtapaComponent,
    ItensDeAvaliacaoDaEtapaComponent,
  ],
  templateUrl: './editor-da-etapa.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class EditorDaEtapaComponent {
  readonly grupo = input.required<FormGroup<EtapaForm>>();
  readonly indiceDaEtapa = input.required<number>();
  readonly fase = input.required<FaseNaLinhaDoTempo>();
  protected readonly edicao = inject(EdicaoDaEtapa);
  protected readonly expansao = inject(ExpansaoDoCronograma);
  protected readonly recusas = inject(RecusasDasEtapas);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
}
