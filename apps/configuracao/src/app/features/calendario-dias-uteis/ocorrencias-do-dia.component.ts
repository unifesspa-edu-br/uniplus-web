import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { AbrangenciaCodigo, type DiaNaoUtilDto } from '@uniplus/shared-data/configuracao';
import { formatIsoDateBr } from '@uniplus/shared-data/utils';
import { DrawerComponent, TagComponent } from '@uniplus/shared-ui/components';
import { abrangenciaLegivel, municipioLegivel, ufLegivel } from './dia-nao-util-legivel';

/**
 * O painel do dia escolhido na grade: as ocorrências dele e a entrada para cadastrar mais uma. Mostra
 * a data inteira, inclusive o que o recorte esconde da grade, para o dia oculto não parecer vazio.
 */
@Component({
  selector: 'cfg-ocorrencias-do-dia',
  standalone: true,
  imports: [DrawerComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ocorrencias-do-dia.component.html',
  styleUrls: ['../../shared/sobreposicao/sobreposicao.css', './ocorrencias-do-dia.component.css'],
})
export class OcorrenciasDoDiaComponent {
  readonly aberto = model.required<boolean>();
  readonly titulo = input.required<string>();
  readonly ocorrencias = input.required<readonly DiaNaoUtilDto[]>();
  readonly ocultas = input<readonly DiaNaoUtilDto[]>([]);
  readonly adicionar = output<void>();
  readonly fechado = output<void>();

  protected readonly itens = computed(() => [
    ...this.ocorrencias().map((dia) => ({ dia, oculta: false })),
    ...this.ocultas().map((dia) => ({ dia, oculta: true })),
  ]);
  protected readonly avisoDasOcultas = computed(() => {
    const ocultas = this.ocultas().length;
    if (ocultas === 0) return '';
    return ocultas === 1
      ? 'Um dia não útil desta data está oculto na grade pelo filtro e continua valendo.'
      : `${ocultas} dias não úteis desta data estão ocultos na grade pelo filtro e continuam valendo.`;
  });

  protected readonly abrangencias = AbrangenciaCodigo;
  protected readonly abrangenciaLegivel = abrangenciaLegivel;
  protected readonly municipioLegivel = municipioLegivel;
  protected readonly ufLegivel = ufLegivel;
  protected readonly formatarData = formatIsoDateBr;
}
