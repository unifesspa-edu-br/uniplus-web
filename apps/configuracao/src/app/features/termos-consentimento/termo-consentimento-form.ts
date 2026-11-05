import { FormControl, FormGroup, Validators } from '@angular/forms';

export const NOME_MAX = 200;
export const TEXTO_MAX = 20000;
export const BASE_LEGAL_MAX = 500;
export const FORMA_ACEITE_DEFAULT = 'A_DEFINIR';

export type AcaoTermo = 'rascunho' | 'revisar' | 'promover' | 'remover';

export interface CriarForm {
  nome: FormControl<string>;
  texto: FormControl<string>;
  baseLegal: FormControl<string>;
  formaAceite: FormControl<string>;
}

export interface RascunhoForm {
  texto: FormControl<string>;
  baseLegal: FormControl<string>;
  formaAceite: FormControl<string>;
}

export function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function ultimaChaveDoCaminho(field: string): string {
  const normalizado =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  return normalizado.charAt(0).toLocaleLowerCase('pt-BR') + normalizado.slice(1);
}

export function criarFormulario(): FormGroup<CriarForm> {
  return new FormGroup<CriarForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(NOME_MAX)],
    }),
    texto: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(TEXTO_MAX)],
    }),
    baseLegal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(BASE_LEGAL_MAX)],
    }),
    formaAceite: new FormControl(FORMA_ACEITE_DEFAULT, { nonNullable: true }),
  });
}

export function criarFormularioRascunho(): FormGroup<RascunhoForm> {
  return new FormGroup<RascunhoForm>({
    texto: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(TEXTO_MAX)],
    }),
    baseLegal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(BASE_LEGAL_MAX)],
    }),
    formaAceite: new FormControl(FORMA_ACEITE_DEFAULT, { nonNullable: true }),
  });
}
