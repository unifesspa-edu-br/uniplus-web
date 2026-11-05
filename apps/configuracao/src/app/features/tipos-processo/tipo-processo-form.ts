import { FormControl } from '@angular/forms';

export interface TipoProcessoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
}

const TIPO_PROCESSO_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof TipoProcessoForm>([
  'codigo',
  'nome',
  'descricao',
]);

export function controlNameFromBackendField(field: string): keyof TipoProcessoForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return TIPO_PROCESSO_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof TipoProcessoForm) : null;
}

export function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
