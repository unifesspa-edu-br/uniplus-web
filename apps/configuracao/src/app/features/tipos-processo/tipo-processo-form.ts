import { FormControl, FormGroup, Validators } from '@angular/forms';
import { validadoresDoCodigo } from '../../shared/codigo-de-cadastro';
import {
  TipoProcessoDto,
  type AtualizarTipoProcessoCommand,
  type CriarTipoProcessoCommand,
} from '@uniplus/shared-data/configuracao';
import { textoDoFormatoDoCodigo } from '@uniplus/shared-utils';
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

const MENSAGEM_DE_FORMATO = textoDoFormatoDoCodigo(80);

const CAMPOS: ReadonlySet<string> = new Set<keyof TipoProcessoForm>([
  'codigo',
  'nome',
  'descricao',
]);

function controleDoCodigo(): FormControl<string> {
  return new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, ...validadoresDoCodigo(80)],
  });
}

export function criarFormularioDeTipoProcesso(): FormGroup<TipoProcessoForm> {
  return new FormGroup<TipoProcessoForm>({
    codigo: controleDoCodigo(),
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
    codigo: valor.codigo,
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
