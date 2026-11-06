import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AtualizarRecursoAcessibilidadeCommand,
  CriarRecursoAcessibilidadeCommand,
  RecursoAcessibilidadeDto,
} from '@uniplus/shared-data/configuracao';
import { CODIGO_CADASTRO_FORMATO, CODIGO_CADASTRO_TAMANHO_MAXIMO } from '@uniplus/shared-utils';
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

const MENSAGEM_DE_FORMATO =
  'Formato inválido. Use letras maiúsculas, números e sublinhado, iniciando por letra (ex.: LEDOR, SALA_DE_FACIL_ACESSO).';

const CONTROLES_DO_SERVIDOR: ReadonlySet<string> = new Set<keyof RecursoAcessibilidadeForm>([
  'nome',
  'codigo',
  'descricao',
]);

export function criarFormularioDeRecurso(): FormGroup<RecursoAcessibilidadeForm> {
  return new FormGroup<RecursoAcessibilidadeForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(255)],
    }),
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(CODIGO_CADASTRO_TAMANHO_MAXIMO),
        Validators.pattern(CODIGO_CADASTRO_FORMATO),
      ],
    }),
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
    codigo: nullIfBlank(valores.codigo),
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
