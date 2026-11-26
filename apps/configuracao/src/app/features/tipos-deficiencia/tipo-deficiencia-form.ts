import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { validadoresDoCodigo } from '../../shared/codigo-de-cadastro';
import {
  AtualizarTipoDeficienciaCommand,
  CriarTipoDeficienciaCommand,
  TipoDeficienciaDto,
} from '@uniplus/shared-data/configuracao';
import { textoDoFormatoDoCodigo } from '@uniplus/shared-utils';
import {
  controlNameFromBackendField,
  mensagemDeErroDoCampoComFormato,
} from '../../shared/formulario';

export const LIMITE_DO_CODIGO_DO_TIPO_DE_DEFICIENCIA = 50;

export interface TipoDeficienciaForm {
  nome: FormControl<string>;
  codigo: FormControl<string>;
  descricao: FormControl<string>;
}

export type ValoresDoTipoDeficiencia = ReturnType<FormGroup<TipoDeficienciaForm>['getRawValue']>;

export const TIPO_EM_BRANCO: ValoresDoTipoDeficiencia = { nome: '', codigo: '', descricao: '' };

const VALIDADORES_DO_CODIGO = [
  Validators.required,
  ...validadoresDoCodigo(LIMITE_DO_CODIGO_DO_TIPO_DE_DEFICIENCIA),
];

const MENSAGEM_DE_FORMATO = textoDoFormatoDoCodigo(LIMITE_DO_CODIGO_DO_TIPO_DE_DEFICIENCIA);

const MENSAGEM_DE_DESCRICAO_EM_BRANCO = 'Informe um texto — apenas espaços não valem.';

const CONTROLES_DO_SERVIDOR: ReadonlySet<string> = new Set<keyof TipoDeficienciaForm>([
  'nome',
  'codigo',
  'descricao',
]);

function controleDoDescricao(): FormControl<string> {
  return new FormControl('', {
    nonNullable: true,
    // `Validators.required` aceita só espaços, que o `trim()` do comando reduziria a vazio e a
    // API recusaria; o padrão exige ao menos um caractere significativo.
    validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(1000)],
  });
}

export function criarFormularioDeTipoDeficiencia(): FormGroup<TipoDeficienciaForm> {
  return new FormGroup<TipoDeficienciaForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(200)],
    }),
    codigo: new FormControl('', {
      nonNullable: true,
      validators: VALIDADORES_DO_CODIGO,
    }),
    descricao: controleDoDescricao(),
  });
}

export function valoresDoTipoDeficiencia(tipo: TipoDeficienciaDto): ValoresDoTipoDeficiencia {
  return {
    nome: tipo.nome,
    codigo: tipo.codigo,
    descricao: tipo.descricao ?? '',
  };
}

export function controleDoCampoDoServidor(field: string): keyof TipoDeficienciaForm | null {
  return controlNameFromBackendField<keyof TipoDeficienciaForm>(field, CONTROLES_DO_SERVIDOR);
}

export function comandoDeCriacao(valores: ValoresDoTipoDeficiencia): CriarTipoDeficienciaCommand {
  return {
    codigo: valores.codigo,
    nome: valores.nome.trim(),
    descricao: valores.descricao.trim(),
  };
}

/**
 * O PUT substitui o registro inteiro: campo omitido é campo apagado. A tela não edita a
 * classificação de permanência, então reenvia a que leu para não zerá-la.
 */
export function comandoDeAtualizacao(
  id: string,
  valores: ValoresDoTipoDeficiencia,
  permanente: boolean | null,
): AtualizarTipoDeficienciaCommand {
  return { id, ...comandoDeCriacao(valores), permanente };
}

/** A mensagem do campo: a do servidor ou a obrigatoriedade; no mais, a regra de tamanho ou formato violada. */
export function mensagemDoCampo(
  control: AbstractControl,
  campo: keyof TipoDeficienciaForm,
): string | null {
  const formato = campo === 'descricao' ? MENSAGEM_DE_DESCRICAO_EM_BRANCO : MENSAGEM_DE_FORMATO;
  return mensagemDeErroDoCampoComFormato(control, formato);
}
