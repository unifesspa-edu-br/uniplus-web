import { Injectable } from '@angular/core';
import { ProblemDetails } from './problem-details';

export interface ProblemMessage {
  readonly title: string;
  readonly detail?: string;
  readonly action?: ProblemAction;
}

export interface ProblemAction {
  readonly route: string;
  readonly label: string;
}

/**
 * Override registrado para um `problem.code`.
 *
 * As funções recebem o `ProblemDetails` original — incluindo `detail`,
 * `errors[].message` e demais campos que podem conter PII residual. **Quem
 * registrar um override nunca deve interpolar `detail` ou `errors[].message`
 * diretamente em UI que possa ser logada, persistida ou compartilhada por
 * humanos.** Use `errors[].field` + `errors[].code` para mapear campos a
 * mensagens estáticas pt-BR; reserve `detail` para mensagens curtas que o
 * backend já garantiu serem PII-safe.
 */
export interface ProblemOverride {
  readonly title?: string | ((problem: ProblemDetails) => string);
  readonly detail?: string | ((problem: ProblemDetails) => string);
  readonly action?: ProblemAction;
}

/**
 * Hook de internacionalização por `problem.code` (ADR-0011/0012).
 *
 * Comportamento padrão (sem override): renderiza `title`/`detail` que vêm do
 * backend — já em pt-BR. Overrides registrados por código permitem customizar
 * a mensagem para um contexto específico de UI ou anexar uma call-to-action.
 *
 * **LGPD:** ver `ProblemOverride` para a regra de manuseio de `detail`/`errors[]`.
 */
@Injectable({ providedIn: 'root' })
export class ProblemI18nService {
  private readonly overrides = new Map<string, ProblemOverride>();

  /**
   * Registra um override para um `problem.code`. Veja `ProblemOverride` para
   * as restrições de PII no callback.
   */
  register(code: string, override: ProblemOverride): void {
    this.overrides.set(code, override);
  }

  unregister(code: string): void {
    this.overrides.delete(code);
  }

  resolve(problem: ProblemDetails): ProblemMessage {
    const override = this.overrides.get(problem.code);
    if (!override) {
      return { title: problem.title, detail: problem.detail };
    }

    return {
      title: resolveValue(override.title, problem) ?? problem.title,
      detail: resolveValue(override.detail, problem) ?? problem.detail,
      action: override.action,
    };
  }
}

function resolveValue(
  value: string | ((problem: ProblemDetails) => string) | undefined,
  problem: ProblemDetails,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === 'function' ? value(problem) : value;
}
