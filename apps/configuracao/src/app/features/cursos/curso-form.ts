import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AtualizarCursoCommand,
  AtualizarCursoCommandGrupoAreaEnem,
  CriarCursoCommand,
  CriarCursoCommandGrupoAreaEnem,
  CursoDto,
} from '@uniplus/shared-data/configuracao';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';
import { validadoresDoCodigo } from '../../shared/codigo-de-cadastro';

export interface CursoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  grau: FormControl<string>;
  nivelEnsino: FormControl<string>;
  grupoAreaEnem: FormControl<string>;
}

type ValoresDoCurso = ReturnType<FormGroup<CursoForm>['getRawValue']>;

export const CURSO_EM_BRANCO: ValoresDoCurso = {
  codigo: '',
  nome: '',
  grau: '',
  nivelEnsino: '',
  grupoAreaEnem: '',
};

const CONTROLES_DO_SERVIDOR: ReadonlySet<string> = new Set<keyof CursoForm>([
  'codigo',
  'nome',
  'grau',
  'nivelEnsino',
  'grupoAreaEnem',
]);

function obrigatorio(maximo: number): FormControl<string> {
  return new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(maximo)],
  });
}

export function criarFormularioDeCurso(): FormGroup<CursoForm> {
  return new FormGroup<CursoForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, ...validadoresDoCodigo(60)],
    }),
    nome: obrigatorio(200),
    grau: obrigatorio(60),
    nivelEnsino: obrigatorio(60),
    grupoAreaEnem: new FormControl('', { nonNullable: true }),
  });
}

export function valoresDoCurso(curso: CursoDto): ValoresDoCurso {
  return {
    codigo: curso.codigo,
    nome: curso.nome,
    grau: curso.grau,
    nivelEnsino: curso.nivelEnsino,
    grupoAreaEnem: curso.grupoAreaEnem?.codigo?.trim() ?? '',
  };
}

/** O controle do formulário que corresponde ao campo recusado pelo servidor, se houver. */
export function controleDoCampoDoServidor(field: string): keyof CursoForm | null {
  return controlNameFromBackendField<keyof CursoForm>(field, CONTROLES_DO_SERVIDOR);
}

/**
 * O grupo de área do ENEM vem do vocabulário que a própria API publica; o contrato o declara como
 * enumeração fechada. O grupo em branco continua indo como nulo, que a API aceita: o gerador
 * só deixou de listar o nulo no tipo.
 */
function grupoAreaEnemDoComando<T extends string>(valor: string): T | undefined {
  return nullIfBlank(valor) as T | undefined;
}

export function comandoDeCriacao(valores: ValoresDoCurso): CriarCursoCommand {
  return {
    codigo: valores.codigo,
    nome: nullIfBlank(valores.nome),
    grau: nullIfBlank(valores.grau),
    nivelEnsino: nullIfBlank(valores.nivelEnsino),
    grupoAreaEnem: grupoAreaEnemDoComando<CriarCursoCommandGrupoAreaEnem>(valores.grupoAreaEnem),
  };
}

export function comandoDeAtualizacao(id: string, valores: ValoresDoCurso): AtualizarCursoCommand {
  return {
    ...comandoDeCriacao(valores),
    id,
    grupoAreaEnem: grupoAreaEnemDoComando<AtualizarCursoCommandGrupoAreaEnem>(
      valores.grupoAreaEnem,
    ),
  };
}
