import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import type { PerfilDto } from '@uniplus/shared-data/autorizacao';
import { controlNameFromBackendField, mensagemDeErroDoControle } from '../../shared/formulario';

export type CampoDoPerfil = 'nome' | 'descricao';

/** Código de wire da recusa por já existir perfil com o nome informado (409). */
export const CODIGO_NOME_DUPLICADO = 'uniplus.autorizacao.perfil.nome_duplicado';

const CAMPOS = new Set<CampoDoPerfil>(['nome', 'descricao']);

const MENSAGEM_DE_OBRIGATORIO: Readonly<Record<CampoDoPerfil, string>> = {
  nome: 'Informe o nome do perfil.',
  descricao: 'Descreva o perfil.',
};

export function criarFormularioDePerfil() {
  return new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
}

export function valoresDoPerfil(perfil: PerfilDto | null) {
  return { nome: perfil?.nome ?? '', descricao: perfil?.descricao ?? '' };
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
