import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import type { CategoriaDaRemocao, PerfilDto } from '@uniplus/shared-data/autorizacao';
import { controlNameFromBackendField, mensagemDeErroDoControle } from '../../shared/formulario';

export type CampoDoPerfil =
  | 'nome'
  | 'descricao'
  | 'protocolo'
  | 'motivoDaRemocao'
  | 'categoriaDaRemocao';

/** Código de wire da recusa por já existir perfil com o nome informado (409). */
export const CODIGO_NOME_DUPLICADO = 'uniplus.autorizacao.perfil.nome_duplicado';

const LIMITE_DO_NOME = 120;
const LIMITE_DA_DESCRICAO = 500;
const LIMITE_DO_PROTOCOLO = 60;
const LIMITE_DO_MOTIVO = 500;

const CAMPOS = new Set<CampoDoPerfil>([
  'nome',
  'descricao',
  'protocolo',
  'motivoDaRemocao',
  'categoriaDaRemocao',
]);

const MENSAGEM_DE_OBRIGATORIO: Readonly<Record<CampoDoPerfil, string>> = {
  nome: 'Informe o nome do perfil.',
  descricao: 'Descreva o perfil.',
  protocolo: 'Informe o número do protocolo do documento instituidor.',
  motivoDaRemocao: 'Informe o motivo da remoção de permissões.',
  categoriaDaRemocao: 'Escolha a categoria da remoção de permissões.',
};

export const CATEGORIAS_DA_REMOCAO: readonly {
  readonly value: CategoriaDaRemocao;
  readonly label: string;
}[] = [
  { value: 'incidente', label: 'Incidente de segurança' },
  { value: 'erro_de_composicao', label: 'Erro de composição do perfil' },
  { value: 'mudanca_de_funcao', label: 'Mudança de função' },
];

export type FormularioDePerfil = ReturnType<typeof criarFormularioDePerfil>;

function campoDeTexto(limite: number, obrigatorio: boolean) {
  return new FormControl('', {
    nonNullable: true,
    validators: obrigatorio
      ? [Validators.required, Validators.maxLength(limite)]
      : [Validators.maxLength(limite)],
  });
}

export function criarFormularioDePerfil() {
  return new FormGroup({
    nome: campoDeTexto(LIMITE_DO_NOME, true),
    descricao: campoDeTexto(LIMITE_DA_DESCRICAO, true),
    protocolo: campoDeTexto(LIMITE_DO_PROTOCOLO, true),
    motivoDaRemocao: campoDeTexto(LIMITE_DO_MOTIVO, false),
    categoriaDaRemocao: new FormControl('', { nonNullable: true }),
  });
}

export function valoresDoPerfil(perfil: PerfilDto | null) {
  return {
    nome: perfil?.nome ?? '',
    descricao: perfil?.descricao ?? '',
    protocolo: '',
    motivoDaRemocao: '',
    categoriaDaRemocao: '',
  };
}

/** Os campos que a proposta só pede quando muda o que importa a eles: o documento e a remoção de permissões. */
export function exigirCamposDaProposta(
  form: FormularioDePerfil,
  exigencias: { readonly documento: boolean; readonly remocao: boolean },
): void {
  alternarObrigatorio(form.controls.protocolo, exigencias.documento);
  alternarObrigatorio(form.controls.motivoDaRemocao, exigencias.remocao);
  alternarObrigatorio(form.controls.categoriaDaRemocao, exigencias.remocao);
}

function alternarObrigatorio(controle: AbstractControl, obrigatorio: boolean): void {
  if (obrigatorio === controle.hasValidator(Validators.required)) return;
  if (obrigatorio) controle.addValidators(Validators.required);
  else controle.removeValidators(Validators.required);
  controle.updateValueAndValidity({ emitEvent: false });
}

/** O controle que o servidor aponta pelo nome do campo, ou `null` se o campo não é do formulário. */
export function controleDoCampoDoServidor(campo: string): CampoDoPerfil | null {
  return controlNameFromBackendField<CampoDoPerfil>(campo, CAMPOS);
}

/** A mensagem do campo depois de tocado: a do servidor, a de obrigatório da tela ou a genérica. */
export function mensagemDoCampoDoPerfil(
  nome: CampoDoPerfil,
  controle: AbstractControl,
): string | null {
  if (controle.hasError('required') && (controle.touched || controle.dirty)) {
    return MENSAGEM_DE_OBRIGATORIO[nome];
  }
  return mensagemDeErroDoControle(controle);
}
