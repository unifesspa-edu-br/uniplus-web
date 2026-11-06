import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  CriarTermoConsentimentoCommand,
  EditarRascunhoTermoConsentimentoCommand,
  TermoConsentimentoDto,
} from '@uniplus/shared-data/configuracao';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';

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

/** O campo do servidor e o controle do formulário que o recebe. */
const CONTROLE_DO_CAMPO: Readonly<Record<string, keyof CriarForm>> = {
  nome: 'nome',
  textoRascunho: 'texto',
  baseLegalRascunho: 'baseLegal',
  formaAceiteRascunho: 'formaAceite',
};

const CAMPOS_DO_SERVIDOR: ReadonlySet<string> = new Set(Object.keys(CONTROLE_DO_CAMPO));

/** O controle que corresponde ao campo recusado pelo servidor, ou `null` se o formulário não o tem. */
export function controleDoCampoDoServidor(field: string): keyof CriarForm | null {
  const campo = controlNameFromBackendField<string>(field, CAMPOS_DO_SERVIDOR);
  return campo === null ? null : CONTROLE_DO_CAMPO[campo];
}

function controleDeTexto(maximo: number): FormControl<string> {
  return new FormControl('', { nonNullable: true, validators: [Validators.maxLength(maximo)] });
}

export function criarFormulario(): FormGroup<CriarForm> {
  return new FormGroup<CriarForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(NOME_MAX)],
    }),
    texto: controleDeTexto(TEXTO_MAX),
    baseLegal: controleDeTexto(BASE_LEGAL_MAX),
    formaAceite: new FormControl(FORMA_ACEITE_DEFAULT, { nonNullable: true }),
  });
}

export function criarFormularioRascunho(): FormGroup<RascunhoForm> {
  return new FormGroup<RascunhoForm>({
    texto: controleDeTexto(TEXTO_MAX),
    baseLegal: controleDeTexto(BASE_LEGAL_MAX),
    formaAceite: new FormControl(FORMA_ACEITE_DEFAULT, { nonNullable: true }),
  });
}

export function valoresDoRascunho(termo: TermoConsentimentoDto): {
  texto: string;
  baseLegal: string;
  formaAceite: string;
} {
  return {
    texto: termo.textoRascunho ?? '',
    baseLegal: termo.baseLegalRascunho ?? '',
    formaAceite: termo.formaAceiteRascunho,
  };
}

export function comandoDeCriacao(form: FormGroup<CriarForm>): CriarTermoConsentimentoCommand {
  const valores = form.getRawValue();
  return {
    nome: nullIfBlank(valores.nome),
    textoRascunho: nullIfBlank(valores.texto),
    baseLegalRascunho: nullIfBlank(valores.baseLegal),
    formaAceiteRascunho: valores.formaAceite,
  };
}

export function comandoDeRascunho(
  id: string,
  form: FormGroup<RascunhoForm>,
): EditarRascunhoTermoConsentimentoCommand {
  const valores = form.getRawValue();
  return {
    id,
    textoRascunho: nullIfBlank(valores.texto),
    baseLegalRascunho: nullIfBlank(valores.baseLegal),
    formaAceiteRascunho: valores.formaAceite,
  };
}
