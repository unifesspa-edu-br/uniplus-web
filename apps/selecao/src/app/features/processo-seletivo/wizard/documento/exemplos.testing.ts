import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import inscricaoPeloSistema from '@uniplus/shared-data/openapi/exemplos/selecao/inscricao-pelo-sistema.json';
import resultadoImportado from '@uniplus/shared-data/openapi/exemplos/selecao/resultado-importado.json';

const EXEMPLOS = {
  'inscricao-pelo-sistema': inscricaoPeloSistema,
  'resultado-importado': resultadoImportado,
} as unknown as Record<NomeDoExemplo, DocumentoDaConfiguracao>;

export type NomeDoExemplo = 'inscricao-pelo-sistema' | 'resultado-importado';

export const NOMES_DOS_EXEMPLOS: readonly NomeDoExemplo[] = [
  'inscricao-pelo-sistema',
  'resultado-importado',
];

/** O documento de exemplo do contrato, como o arquivo o traz. */
export function exemploDoContrato(nome: NomeDoExemplo): DocumentoDaConfiguracao {
  return structuredClone(EXEMPLOS[nome]);
}

/** O menor documento que o esquema aceita: só o que o formato exige. */
export function documentoSemNada(): DocumentoDaConfiguracao {
  return { formato: 'uniplus.selecao.configuracao', versaoFormato: 1 };
}
