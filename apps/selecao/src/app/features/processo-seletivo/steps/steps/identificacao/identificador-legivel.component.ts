import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { GravacaoDaIdentificacaoService } from './servicos/gravacao-da-identificacao.service';

/** O endereço público do certame no portal, editável enquanto o processo for rascunho. */
@Component({
  selector: 'sel-identificador-legivel',
  imports: [ValorLegivelDirective, ReactiveFormsModule],
  templateUrl: './identificador-legivel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class IdentificadorLegivelComponent {
  protected readonly gravacao = inject(GravacaoDaIdentificacaoService);

  readonly controle = input.required<FormControl<string>>();
  readonly invalido = input.required<boolean>();
}
