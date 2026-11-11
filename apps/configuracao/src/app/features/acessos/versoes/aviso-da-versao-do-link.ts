import type { PerfilDto } from '@uniplus/shared-data/autorizacao';
import { situacaoEncerrada } from './rotulos-da-versao';

export const TITULO_DO_AVISO_DA_VERSAO = 'A versão do link já não está pendente';
const ATUAL = 'Abaixo está a situação atual do perfil.';

type VersaoEncerrada = NonNullable<PerfilDto['ultimaVersaoEncerradaSemVigor']>;

function encerradaCitadaNoAviso(
  perfil: PerfilDto,
  versaoId: string | undefined,
): VersaoEncerrada | null {
  const semPendente = perfil.versaoPendente === null;
  const emVigor = perfil.composicaoEmVigor?.versaoId === versaoId;
  return versaoId !== undefined && semPendente && !emVigor
    ? perfil.ultimaVersaoEncerradaSemVigor
    : null;
}

/**
 * A última versão encerrada sem vigor que o aviso do link ainda não cita; `null` quando não há
 * versão encerrada ou o aviso do link já a traz.
 */
export function encerradaForaDoAvisoDoLink(
  perfil: PerfilDto,
  versaoId: string | undefined,
): VersaoEncerrada | null {
  return encerradaCitadaNoAviso(perfil, versaoId) === null
    ? perfil.ultimaVersaoEncerradaSemVigor
    : null;
}

/**
 * O que aconteceu com a versão que o link abriu, quando ela já não é a pendente; `null` quando o
 * link não traz versão ou ela é a pendente.
 */
export function avisoDaVersaoDoLink(
  perfil: PerfilDto,
  versaoId: string | undefined,
): string | null {
  if (versaoId === undefined || perfil.versaoPendente?.versaoId === versaoId) return null;
  if (perfil.composicaoEmVigor?.versaoId === versaoId) {
    return `Esta versão foi aprovada e está em vigor. ${ATUAL}`;
  }
  const encerrada = encerradaCitadaNoAviso(perfil, versaoId);
  return encerrada === null
    ? `Esta versão não está mais pendente. ${ATUAL}`
    : `Esta versão não está mais pendente. A última versão proposta, a ${encerrada.numero}, foi ${situacaoEncerrada(encerrada.situacao)}. ${ATUAL}`;
}
