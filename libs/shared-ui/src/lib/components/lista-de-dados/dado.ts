import { booleanAttribute, computed, Directive, inject, input, TemplateRef } from '@angular/core';

import type { UiValorEmConsulta } from './valor-apresentado';

/** Sem `valor`, o dado mostra o conteúdo do template: um CPF revelável, uma etiqueta, um `<time>`. */
const CONTEUDO_DO_DADO = Symbol('conteudo-do-dado');

/**
 * Um par rótulo/valor de um `ui-lista-de-dados`, declarado num `<ng-template uiDado>`. É a lista que
 * monta o `<div><dt><dd>`, para o `dl` conter só pares, como a lista de descrição exige. Com `valor`,
 * a apresentação é a do `ui-valor-apresentado`; sem ele, o `dd` recebe o conteúdo do template.
 */
@Directive({
  selector: 'ng-template[uiDado]',
  standalone: true,
})
export class DadoDirective {
  readonly rotulo = input.required<string>();
  readonly valor = input<UiValorEmConsulta | typeof CONTEUDO_DO_DADO>(CONTEUDO_DO_DADO);
  readonly seVazio = input<string>('Não informado');
  readonly ordenada = input(false, { transform: booleanAttribute });

  readonly conteudo = inject<TemplateRef<unknown>>(TemplateRef);

  /** O dado mostra o conteúdo do template, e não um valor. */
  readonly projetado = computed(() => this.valor() === CONTEUDO_DO_DADO);
  readonly valorDeclarado = computed<UiValorEmConsulta>(() => {
    const valor = this.valor();
    return valor === CONTEUDO_DO_DADO ? null : valor;
  });
}
