import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { AJUDA_DAS_OPCOES, OPCOES_DE_CURSO } from '../opcoes-de-curso';
import { OpcoesDeCursoService } from '../servicos/opcoes-de-curso.service';

/** O número de opções de curso que o candidato escolhe na inscrição. */
@Component({
  selector: 'div[selOpcoesDeCurso]',
  imports: [ValorLegivelDirective, ValorEmConsultaComponent],
  templateUrl: './opcoes-de-curso.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpcoesDeCursoComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly opcoes = inject(OpcoesDeCursoService);
  protected readonly opcoesDeCurso = OPCOES_DE_CURSO;
  protected readonly ajudaDasOpcoes = AJUDA_DAS_OPCOES;
}
