import { StatusProcessoCodigo } from '@uniplus/shared-data/selecao';

export interface AtalhoDoAcompanhamento {
  readonly rotulo: string;
  readonly destino: readonly string[];
}

/** Estados cadastrais em que a página administrativa de publicações existe; rascunho e desconhecido ficam fora. */
const COM_PUBLICACOES: ReadonlySet<string> = new Set([
  StatusProcessoCodigo.PUBLICADO,
  StatusProcessoCodigo.ENCERRADO,
  StatusProcessoCodigo.CANCELADO,
]);

/**
 * Atalhos disponíveis. Sem a permissão de configurar (carregando, ausente ou com falha) nenhum é
 * oferecido. O status cadastral só decide Publicações; não é situação operacional.
 */
export function atalhosDoAcompanhamento(
  processo: {
    readonly id: string;
    readonly status: { readonly codigo: StatusProcessoCodigo; readonly rotulo: string };
  },
  podeConfigurar: boolean,
): readonly AtalhoDoAcompanhamento[] {
  if (!podeConfigurar) return [];
  const base = ['/processo-seletivo', processo.id];
  const editar = { rotulo: 'Editar processo', destino: base };
  const publicacoes = { rotulo: 'Publicações', destino: [...base, 'publicacoes'] };
  return COM_PUBLICACOES.has(processo.status.codigo) ? [editar, publicacoes] : [editar];
}
