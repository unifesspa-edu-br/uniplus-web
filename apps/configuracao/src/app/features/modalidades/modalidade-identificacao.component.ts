import { textoDoFormatoDoCodigo } from '@uniplus/shared-utils';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RecusaDoCampoComponent, type RecusaDoCampo } from '@uniplus/shared-ui/components';
import { recusasDoControle } from '../../shared/formulario';

import { DESCRICAO_TAMANHO_MAXIMO, NOME_TAMANHO_MAXIMO } from './modalidade-form';
import { ModalidadeSecao } from './modalidade-secao';

@Component({
  selector: 'cfg-modalidade-identificacao',
  standalone: true,
  imports: [ReactiveFormsModule, RecusaDoCampoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidade-identificacao.component.html',
  styleUrl: '../../shared/formulario/secao-do-formulario.css',
})
export class ModalidadeIdentificacaoComponent extends ModalidadeSecao {
  protected readonly ajudaDoCodigo = textoDoFormatoDoCodigo(60);
  readonly modoEdicao = input.required<boolean>();
  readonly codigoSaiu = output<void>();

  protected readonly nomeMax = NOME_TAMANHO_MAXIMO;
  protected readonly descricaoMax = DESCRICAO_TAMANHO_MAXIMO;

  protected recusasDoCampo(nome: 'codigo' | 'nome'): readonly RecusaDoCampo[] {
    return recusasDoControle(this.form().controls[nome]);
  }
}
