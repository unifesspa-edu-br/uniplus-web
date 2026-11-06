import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import type { DiaNaoUtilDto } from '@uniplus/shared-data/configuracao';
import { formatIsoDateBr } from '@uniplus/shared-data/utils';
import { DrawerComponent } from '@uniplus/shared-ui/components';
import { abrangenciaLegivel, municipioLegivel, ufLegivel } from './dia-nao-util-legivel';

/** O painel do dia escolhido na grade: as ocorrências dele e a entrada para cadastrar mais uma. */
@Component({
  selector: 'cfg-ocorrencias-do-dia',
  standalone: true,
  imports: [DrawerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ocorrencias-do-dia.component.html',
  styleUrls: ['../../shared/sobreposicao/sobreposicao.css', './ocorrencias-do-dia.component.css'],
})
export class OcorrenciasDoDiaComponent {
  readonly aberto = model.required<boolean>();
  readonly titulo = input.required<string>();
  readonly ocorrencias = input.required<readonly DiaNaoUtilDto[]>();
  readonly adicionar = output<void>();
  readonly fechado = output<void>();

  protected readonly abrangenciaLegivel = abrangenciaLegivel;
  protected readonly municipioLegivel = municipioLegivel;
  protected readonly ufLegivel = ufLegivel;
  protected readonly formatarData = formatIsoDateBr;
}
