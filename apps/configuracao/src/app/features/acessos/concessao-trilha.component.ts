import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import type { EventoDaTrilhaDto } from '@uniplus/shared-data/autorizacao';
import {
  DrawerComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  type LeituraAcompanhada,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { RecusaDaLeituraComponent, type RecusaDaLeitura } from '../../shared/recusa-da-leitura';
import { TrilhaDeAcessoComponent } from './trilha-de-acesso.component';

/** A região da trilha: destino do foco quando a trilha volta a carregar depois de uma falha. */
export const ID_DA_TRILHA = 'cfg-concessao-trilha';

@Component({
  selector: 'cfg-concessao-trilha',
  standalone: true,
  imports: [
    DrawerComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    RecusaDaLeituraComponent,
    SpinnerComponent,
    TrilhaDeAcessoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './concessao-trilha.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class ConcessaoTrilhaComponent {
  protected readonly idDaTrilha = ID_DA_TRILHA;
  readonly aberto = model.required<boolean>();
  readonly leitura = input.required<LeituraAcompanhada>();
  readonly recusa = input.required<RecusaDaLeitura | null>();
  readonly eventos = input.required<readonly EventoDaTrilhaDto[]>();
}
