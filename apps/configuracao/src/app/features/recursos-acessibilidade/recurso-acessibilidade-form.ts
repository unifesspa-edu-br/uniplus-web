import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { validadoresDoCodigo } from '../../shared/codigo-de-cadastro';
import {
  AtualizarRecursoAcessibilidadeCommand,
  CriarRecursoAcessibilidadeCommand,
  RecursoAcessibilidadeDto,
} from '@uniplus/shared-data/configuracao';
import { textoDoFormatoDoCodigo } from '@uniplus/shared-utils';
import {
  controlNameFromBackendField,
  mensagemDeErroDoCampoComFormato,
  nullIfBlank,
} from '../../shared/formulario';

export interface RecursoAcessibilidadeForm {
  nome: FormControl<string>;
  codigo: FormControl<string>;
  descricao: FormControl<string>;
}

export type ValoresDoRecurso = ReturnType<FormGroup<RecursoAcessibilidadeForm>['getRawValue']>;

export const RECURSO_EM_BRANCO: ValoresDoRecurso = { nome: '', codigo: '', descricao: '' };

const MENSAGEM_DE_FORMATO = textoDoFormatoDoCodigo(50);

const CONTROLES_DO_SERVIDOR: ReadonlySet<string> = new Set<keyof RecursoAcessibilidadeForm>([
  'nome',
  'codigo',
  'descricao',
]);

function controleDoCodigo(): FormControl<string> {
  return new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, ...validadoresDoCodigo(50)],
  });
}

export function criarFormularioDeRecurso(): FormGroup<RecursoAcessibilidadeForm> {
  return new FormGroup<RecursoAcessibilidadeForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(200)],
    }),
    codigo: controleDoCodigo(),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
  });
}

export function valoresDoRecurso(recurso: RecursoAcessibilidadeDto): ValoresDoRecurso {
  return {
    nome: recurso.nome,
    codigo: recurso.codigo,
    descricao: recurso.descricao ?? '',
  };
}

export function controleDoCampoDoServidor(field: string): keyof RecursoAcessibilidadeForm | null {
  return controlNameFromBackendField<keyof RecursoAcessibilidadeForm>(field, CONTROLES_DO_SERVIDOR);
}

export function comandoDeCriacao(valores: ValoresDoRecurso): CriarRecursoAcessibilidadeCommand {
  return {
    codigo: valores.codigo || null,
    nome: nullIfBlank(valores.nome),
    descricao: nullIfBlank(valores.descricao),
  };
}

export function comandoDeAtualizacao(
  id: string,
  valores: ValoresDoRecurso,
): AtualizarRecursoAcessibilidadeCommand {
  return { id, ...comandoDeCriacao(valores) };
}

/** A mensagem do campo: a do servidor ou a obrigatoriedade; no mais, a regra de tamanho ou formato violada. */
export function mensagemDoCampo(control: AbstractControl): string | null {
  return mensagemDeErroDoCampoComFormato(control, MENSAGEM_DE_FORMATO);
}
