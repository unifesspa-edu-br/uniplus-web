import { formatarDataBr } from '@uniplus/shared-utils';

/**
 * Concessão vigente de perfil de acesso, como `GET /api/profile/me` a devolve em `perfis`.
 * Escrito à mão: `shared-auth` não depende de `shared-data`, e o nome da unidade já vem na resposta.
 */
export interface PerfilConcedido {
  readonly concessaoId: string;
  readonly perfilId: string;
  readonly nome: string;
  readonly escopoTipo: 'unidade' | 'instituicao';
  readonly unidadeId: string | null;
  readonly unidadeSigla: string | null;
  readonly unidadeNome: string | null;
  readonly validaAte: string | null;
}

/** Resposta de `GET /api/profile/me` (`UserProfileResponse` da uniplus-api). */
export interface RespostaDoPerfil {
  readonly userId: string | null;
  readonly name: string | null;
  readonly email: string | null;
  readonly cpf: string | null;
  readonly nomeSocial: string | null;
  readonly perfis: readonly PerfilConcedido[];
  readonly timestamp: string;
}

export const UNIDADE_NAO_IDENTIFICADA = 'Unidade não identificada';

/** Onde o perfil vale: a sigla da unidade (ou o nome, sem sigla), ou a instituição inteira. */
export function escopoDoPerfil(perfil: PerfilConcedido): string {
  if (perfil.escopoTipo === 'instituicao') return 'Instituição';
  return perfil.unidadeSigla?.trim() || perfil.unidadeNome?.trim() || UNIDADE_NAO_IDENTIFICADA;
}

export function rotuloDoPerfil(perfil: PerfilConcedido): string {
  return `${perfil.nome} — ${escopoDoPerfil(perfil)}`;
}

/** `dd/mm/aaaa` da data-limite da concessão, ou `null` quando ela não tem prazo. */
export function prazoDoPerfil(perfil: PerfilConcedido): string | null {
  return perfil.validaAte === null ? null : formatarDataBr(perfil.validaAte, 'short') || null;
}
