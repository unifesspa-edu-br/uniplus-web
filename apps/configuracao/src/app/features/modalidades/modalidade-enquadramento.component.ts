import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { VocabulariosDaModalidade } from './vocabularios-da-modalidade';
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
  protected readonly acoes = inject(VocabulariosDaModalidade).acoes;
}
