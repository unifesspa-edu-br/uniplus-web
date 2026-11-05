import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { FaseCanonicaFormularioComponent } from './fase-canonica-formulario.component';
import { FaseCanonicaRemocaoComponent } from './fase-canonica-remocao.component';
import { FasesCanonicasListaComponent } from './fases-canonicas-lista.component';
import { FasesCanonicasStore } from './fases-canonicas.store';
import { EdicaoDasFasesCanonicas } from './edicao-das-fases-canonicas';

@Component({
  selector: 'cfg-fases-canonicas-page',
  standalone: true,
  imports: [
    AlertComponent,
    FasesCanonicasListaComponent,
    FaseCanonicaFormularioComponent,
    FaseCanonicaRemocaoComponent,
  ],
  providers: [FasesCanonicasStore, EdicaoDasFasesCanonicas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fases-canonicas.page.html',
  host: { class: 'cfg-page' },
})
export class FasesCanonicasPage {
  protected readonly store = inject(FasesCanonicasStore);
  protected readonly edicao = inject(EdicaoDasFasesCanonicas);
}
