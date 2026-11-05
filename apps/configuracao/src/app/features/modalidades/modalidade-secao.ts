import { Directive, input } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { ModalidadeForm, mensagemDoCampo } from './modalidade-form';

/** O que as seções do formulário da modalidade têm em comum: o formulário e a leitura dos erros. */
@Directive()
export abstract class ModalidadeSecao {
  readonly form = input.required<FormGroup<ModalidadeForm>>();
  /**
   * Muda a cada envio e a cada recusa. Os erros ficam nos controles do formulário reativo, fora
   * de signals; a seção, OnPush, só os relê quando um input muda.
   */
  readonly conferencias = input.required<number>();

  protected erroDoCampo(nome: keyof ModalidadeForm): string | null {
    return mensagemDoCampo(this.form().controls[nome]);
  }
}
