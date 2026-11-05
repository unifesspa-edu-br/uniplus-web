import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import type { EventoDaTrilhaDto } from '@uniplus/shared-data/autorizacao';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { TrilhaDeAcessoComponent } from './trilha-de-acesso.component';

@Component({
  selector: 'cfg-concessao-trilha',
  standalone: true,
  imports: [AlertComponent, DrawerComponent, SpinnerComponent, TrilhaDeAcessoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './concessao-trilha.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class ConcessaoTrilhaComponent {
  readonly aberto = model.required<boolean>();
  readonly carregando = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly eventos = input.required<readonly EventoDaTrilhaDto[]>();
}
