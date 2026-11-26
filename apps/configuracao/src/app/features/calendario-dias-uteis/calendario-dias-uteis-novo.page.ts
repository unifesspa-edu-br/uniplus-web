import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUSCA_DE_MUNICIPIOS } from '@uniplus/shared-ui/components';
import { buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import { CalendarioFormularioComponent } from './calendario-formulario.component';
import { EdicaoDoCalendario } from './edicao-do-calendario';

@Component({
  selector: 'cfg-calendario-dias-uteis-novo',
  standalone: true,
  imports: [RouterLink, CalendarioFormularioComponent],
  providers: [
    { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
    EdicaoDoCalendario,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendario-dias-uteis-novo.page.html',
  host: { class: 'cfg-page' },
})
export class CalendarioDiasUteisNovoPage {
  protected readonly edicao = inject(EdicaoDoCalendario);
}
