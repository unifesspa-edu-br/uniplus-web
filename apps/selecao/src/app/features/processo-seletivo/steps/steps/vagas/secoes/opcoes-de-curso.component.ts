import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { AJUDA_DAS_OPCOES, OPCOES_DE_CURSO } from '../opcoes-de-curso';
import { EstadoDoPassoDeVagas } from '../servicos/estado-do-passo-de-vagas';

/** O número de opções de curso que o candidato escolhe na inscrição. */
@Component({
  selector: 'div[selOpcoesDeCurso]',
  imports: [ValorLegivelDirective, ValorEmConsultaComponent],
  templateUrl: './opcoes-de-curso.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpcoesDeCursoComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly estado = inject(EstadoDoPassoDeVagas);
  protected readonly opcoesDeCurso = OPCOES_DE_CURSO;
  protected readonly ajudaDasOpcoes = AJUDA_DAS_OPCOES;

  protected alterar(numero: string): void {
    this.store.patchObjectSection('opcoesDeCurso', { numero });
  }
}
