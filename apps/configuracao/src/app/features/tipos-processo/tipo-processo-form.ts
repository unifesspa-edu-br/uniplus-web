import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  TipoProcessoDto,
  type AtualizarTipoProcessoCommand,
  type CriarTipoProcessoCommand,
} from '@uniplus/shared-data/configuracao';
import { CODIGO_CADASTRO_FORMATO, CODIGO_CADASTRO_TAMANHO_MAXIMO } from '@uniplus/shared-utils';
import {
  controlNameFromBackendField,
  mensagemDeErroDoCampoComFormato,
  nullIfBlank,
} from '../../shared/formulario';

export interface TipoProcessoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
}

export type ValoresDoTipoProcesso = ReturnType<FormGroup<TipoProcessoForm>['getRawValue']>;

/** Limites de tamanho dos campos editáveis (Domain `TipoProcesso`, uniplus-api). */
const NOME_TAMANHO_MAXIMO = 200;
const DESCRICAO_TAMANHO_MAXIMO = 1000;
const CODIGO_TAMANHO_MINIMO = 2;

const MENSAGEM_DE_FORMATO =
  'Use caixa alta, começando por letra, com letras, números e sublinhado.';

const CAMPOS: ReadonlySet<string> = new Set<keyof TipoProcessoForm>([
  'codigo',
  'nome',
  'descricao',
]);

export function criarFormularioDeTipoProcesso(): FormGroup<TipoProcessoForm> {
  return new FormGroup<TipoProcessoForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(CODIGO_TAMANHO_MINIMO),
        Validators.maxLength(CODIGO_CADASTRO_TAMANHO_MAXIMO),
        Validators.pattern(CODIGO_CADASTRO_FORMATO),
      ],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(NOME_TAMANHO_MAXIMO)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(DESCRICAO_TAMANHO_MAXIMO)],
    }),
  });
}

export function valoresEmBrancoDoTipoProcesso(): ValoresDoTipoProcesso {
  return { codigo: '', nome: '', descricao: '' };
}

export function valoresDoTipoProcesso(tipo: TipoProcessoDto): ValoresDoTipoProcesso {
  return { codigo: tipo.codigo, nome: tipo.nome, descricao: tipo.descricao ?? '' };
}

export function controleDoCampoDoServidor(field: string): keyof TipoProcessoForm | null {
  return controlNameFromBackendField<keyof TipoProcessoForm>(field, CAMPOS);
}

export function comandoDeCriacao(form: FormGroup<TipoProcessoForm>): CriarTipoProcessoCommand {
  const valor = form.getRawValue();
  return {
    codigo: valor.codigo.trim(),
    nome: valor.nome.trim(),
    descricao: nullIfBlank(valor.descricao),
  };
}

export function comandoDeAtualizacao(
  id: string,
  form: FormGroup<TipoProcessoForm>,
): AtualizarTipoProcessoCommand {
  const valor = form.getRawValue();
  return { id, nome: valor.nome.trim(), descricao: nullIfBlank(valor.descricao) };
}

/** A mensagem do campo: a do servidor ou a obrigatoriedade; no mais, a regra de tamanho ou formato violada. */
export function mensagemDoCampo(controle: FormControl<string>): string | null {
  return mensagemDeErroDoCampoComFormato(controle, MENSAGEM_DE_FORMATO);
}
