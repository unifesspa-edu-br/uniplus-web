import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ACOES_QUANDO_INDEFERIDO } from '@uniplus/shared-data/configuracao';

import { ModalidadeSecao } from './modalidade-secao';

@Component({
  selector: 'cfg-modalidade-enquadramento',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidade-enquadramento.component.html',
  styleUrl: '../../shared/formulario/secao-do-formulario.css',
})
export class ModalidadeEnquadramentoComponent extends ModalidadeSecao {
  protected readonly acoes = ACOES_QUANDO_INDEFERIDO;
}
