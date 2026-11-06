import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BuscaDeMunicipios } from './busca-de-municipios';
import { CalendarioFormularioComponent } from './calendario-formulario.component';
import { EdicaoDoCalendario } from './edicao-do-calendario';

@Component({
  selector: 'cfg-calendario-dias-uteis-novo',
  standalone: true,
  imports: [RouterLink, CalendarioFormularioComponent],
  providers: [BuscaDeMunicipios, EdicaoDoCalendario],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendario-dias-uteis-novo.page.html',
  host: { class: 'cfg-page' },
})
export class CalendarioDiasUteisNovoPage {
  protected readonly edicao = inject(EdicaoDoCalendario);
  protected readonly busca = inject(BuscaDeMunicipios);
}
