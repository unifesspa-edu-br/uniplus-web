import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';

export interface AtalhoDoAcompanhamento {
  readonly rotulo: string;
  readonly destino: readonly string[];
}

/** Estados cadastrais em que a página administrativa de publicações existe; rascunho e desconhecido ficam fora. */
const COM_PUBLICACOES: ReadonlySet<string> = new Set([
  SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
  SituacaoDoProcessoSeletivoCodigo.ENCERRADO,
  SituacaoDoProcessoSeletivoCodigo.CANCELADO,
]);

interface ProcessoDoAcompanhamento {
  readonly id: string;
  readonly situacao: { readonly codigo: SituacaoDoProcessoSeletivoCodigo; readonly rotulo: string };
}

/**
 * Atalhos disponíveis. Sem a permissão de configurar (carregando, ausente ou com falha) nenhum é
 * oferecido. O status cadastral só decide Publicações; não é situação operacional.
 */
export function atalhosDoAcompanhamento(
  processo: ProcessoDoAcompanhamento,
  podeConfigurar: boolean,
): readonly AtalhoDoAcompanhamento[] {
  if (!podeConfigurar) return [];
  const base = ['/processo-seletivo', processo.id];
  const editar = { rotulo: 'Editar processo', destino: base };
  const publicacoes = { rotulo: 'Publicações', destino: [...base, 'publicacoes'] };
  return COM_PUBLICACOES.has(processo.situacao.codigo) ? [editar, publicacoes] : [editar];
}
