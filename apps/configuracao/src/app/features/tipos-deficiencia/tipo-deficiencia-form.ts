import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AtualizarTipoDeficienciaCommand,
  CriarTipoDeficienciaCommand,
  TipoDeficienciaDto,
} from '@uniplus/shared-data/configuracao';
import { CODIGO_CADASTRO_FORMATO, CODIGO_CADASTRO_TAMANHO_MAXIMO } from '@uniplus/shared-utils';
import {
  controlNameFromBackendField,
  mensagemDeErroDoCampoComFormato,
} from '../../shared/formulario';

export interface TipoDeficienciaForm {
  nome: FormControl<string>;
  codigo: FormControl<string>;
  descricao: FormControl<string>;
}

export type ValoresDoTipoDeficiencia = ReturnType<FormGroup<TipoDeficienciaForm>['getRawValue']>;

export const TIPO_EM_BRANCO: ValoresDoTipoDeficiencia = { nome: '', codigo: '', descricao: '' };

const MENSAGEM_DE_FORMATO =
  'Formato inválido. Use letras maiúsculas, números e sublinhado, iniciando por letra (ex.: VISUAL, DEFICIENCIA_VISUAL).';

const MENSAGEM_DE_DESCRICAO_EM_BRANCO = 'Informe um texto — apenas espaços não valem.';

const CONTROLES_DO_SERVIDOR: ReadonlySet<string> = new Set<keyof TipoDeficienciaForm>([
  'nome',
  'codigo',
  'descricao',
]);

export function criarFormularioDeTipoDeficiencia(): FormGroup<TipoDeficienciaForm> {
  return new FormGroup<TipoDeficienciaForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(200)],
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
      // `Validators.required` aceita só espaços, que o `trim()` do comando reduziria a vazio e a
      // API recusaria; o padrão exige ao menos um caractere significativo.
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(1000)],
    }),
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
    codigo: valores.codigo.trim(),
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
