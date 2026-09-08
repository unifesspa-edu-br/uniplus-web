import { InjectionToken, Provider, Type, forwardRef } from '@angular/core';

import { StepValidation } from './processo-seletivo.models';

/**
 * Resumo do que será gravado, exibido antes de qualquer requisição.
 * Declarado pelo passo que grava, porque é ele que conhece os campos.
 */
export interface ConfirmacaoDeGravacao {
  readonly titulo: string;
  readonly aviso: string;
  readonly itens: readonly ItemDeConfirmacao[];
  readonly rotuloDeConfirmar: string;
}

/** Um campo do resumo de confirmação, com o rótulo que o operador viu. */
export interface ItemDeConfirmacao {
  readonly rotulo: string;
  readonly valor: string;
}

/**
 * O que o wizard espera de um passo. `validate()` é o mínimo; o resto é de quem
 * grava na API.
 *
 * A posição não está aqui de propósito: o passo não sabe se é o segundo ou o
 * quinto, e é isso que permite reordená-los sem tocar em nenhum.
 */
export interface PassoDoWizard {
  validate(): StepValidation;

  /** Grava na API antes de liberar o avanço. */
  persistir?(): Promise<StepValidation>;

  /** Rótulo do botão de avanço enquanto este passo estiver aberto. */
  rotuloDeAvanco?(): string;

  /** O que confirmar antes de gravar, ou `null` quando não há o que confirmar. */
  confirmacaoDeGravacao?(): ConfirmacaoDeGravacao | null;

  /**
   * Refaz, a partir do servidor, o que este passo cacheia para `validate()`
   * decidir. A maioria dos passos não tem cache — só a Revisão, cujo
   * checklist é lido uma vez e reaproveitado enquanto o operador estiver
   * nela. Sem isto, gravar de novo um passo anterior (`gravarPassosAnte-
   * riores`) não se reflete no checklist da Revisão, e `validate()` recusa
   * com a foto de antes da correção (achado do Codex na #486, P1).
   */
  recarregarChecklist?(): Promise<void>;
}

/** Token pelo qual a página coleta os passos, na ordem do template. */
export const PASSO_DO_WIZARD = new InjectionToken<PassoDoWizard>('PassoDoWizard');

/**
 * Declara um componente como passo do wizard. `forwardRef` porque o provider é
 * avaliado enquanto a própria classe ainda está sendo definida.
 */
export function provePassoDoWizard(componente: Type<PassoDoWizard>): Provider {
  return { provide: PASSO_DO_WIZARD, useExisting: forwardRef(() => componente) };
}
