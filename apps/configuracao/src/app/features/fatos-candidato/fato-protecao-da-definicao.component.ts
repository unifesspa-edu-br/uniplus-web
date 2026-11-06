import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import {
  AvisoDeNovaAprovacaoComponent,
  type OpcaoDeVocabulario,
} from '../../shared/protecao-do-catalogo';
import type { DefinicaoForm } from './fato-candidato-edicao-form';

type CampoDaProtecao = 'classificacaoProtecao' | 'hipoteseLegal' | 'finalidadeTratamento';

/** Os campos de proteção de dados da definição: classificação, hipótese legal e finalidade. */
@Component({
  selector: 'cfg-fato-protecao-da-definicao',
  imports: [ReactiveFormsModule, AvisoDeNovaAprovacaoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fato-protecao-da-definicao.component.html',
})
export class FatoProtecaoDaDefinicaoComponent {
  readonly form = input.required<DefinicaoForm>();
  readonly classificacoes = input.required<readonly OpcaoDeVocabulario[]>();
  readonly hipoteses = input.required<readonly OpcaoDeVocabulario[]>();
  /** A proteção mudou e o fato estava aprovado: a mudança volta à aprovação da proteção de dados. */
  readonly avisaNovaAprovacao = input.required<boolean>();

  protected erroDoCampo(campo: CampoDaProtecao): string | null {
    return mensagemDeErroDoControle(this.form().controls[campo]);
  }
}
