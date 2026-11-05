import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { DESCRICAO_TAMANHO_MAXIMO } from './modalidade-form';
import { ModalidadeSecao } from './modalidade-secao';

@Component({
  selector: 'cfg-modalidade-identificacao',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidade-identificacao.component.html',
  styleUrl: '../../shared/formulario/secao-do-formulario.css',
})
export class ModalidadeIdentificacaoComponent extends ModalidadeSecao {
  readonly modoEdicao = input.required<boolean>();
  readonly codigoSaiu = output<void>();

  protected readonly descricaoMax = DESCRICAO_TAMANHO_MAXIMO;

  /** O código é sempre maiúsculo; na edição ele é somente leitura. */
  protected normalizarCodigo(evento: Event): void {
    const alvo = evento.target;
    if (this.modoEdicao() || !(alvo instanceof HTMLInputElement)) return;
    const normalizado = alvo.value.toLocaleUpperCase('pt-BR');
    if (normalizado !== alvo.value) this.form().controls.codigo.setValue(normalizado);
  }
}
