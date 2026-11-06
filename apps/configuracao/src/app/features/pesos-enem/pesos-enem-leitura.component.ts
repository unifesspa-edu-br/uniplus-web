import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AreaPesoAreaEnemDto, PesoAreaEnemDto } from '@uniplus/shared-data/configuracao';
import { PesosEnemColunasComponent } from './pesos-enem-colunas.component';
import { PesosEnemNotaComponent } from './pesos-enem-nota.component';
import {
  corteExibido,
  idCampoLeitura,
  rotuloDaArea,
  rotuloDoCampo,
  rotuloDoGrupo,
  valorDaArea,
} from './pesos-enem-rotulos';

/** A grade de uma resolução em leitura: uma linha por grupo de curso, peso e corte por área. */
@Component({
  selector: 'div[cfgPesosEnemLeitura]',
  standalone: true,
  imports: [PesosEnemColunasComponent, PesosEnemNotaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pesos-enem-leitura.component.html',
  host: {
    class: 'num-grid pe-grid',
    tabindex: '-1',
    '[style.--pe-colunas]': 'areas().length',
    '[attr.aria-label]': '"Pesos do ENEM — " + resolucao()',
  },
})
export class PesosEnemLeituraComponent {
  readonly resolucao = input.required<string>();
  readonly areas = input.required<readonly AreaPesoAreaEnemDto[]>();
  readonly linhas = input.required<readonly PesoAreaEnemDto[]>();

  protected readonly rotuloDoGrupo = rotuloDoGrupo;
  protected readonly corteExibido = corteExibido;
  protected readonly valorDaArea = valorDaArea;
  protected readonly idCampoLeitura = idCampoLeitura;

  protected rotuloDoPeso(area: AreaPesoAreaEnemDto, grupo: string): string {
    return rotuloDoCampo('peso', rotuloDaArea(this.areas(), area.codigo), grupo);
  }
}
