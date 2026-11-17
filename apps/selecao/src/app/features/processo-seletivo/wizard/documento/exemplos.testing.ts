import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';

const EXEMPLOS = import.meta.glob<DocumentoDaConfiguracao>(
  '../../../../../../../../libs/shared-data/openapi/exemplos/selecao/*.json',
  {
    eager: true,
    import: 'default',
  },
);

export type NomeDoExemplo = 'inscricao-pelo-sistema' | 'resultado-importado';

export const NOMES_DOS_EXEMPLOS: readonly NomeDoExemplo[] = [
  'inscricao-pelo-sistema',
  'resultado-importado',
];

/** O documento de exemplo do contrato, como o arquivo o traz. */
export function exemploDoContrato(nome: NomeDoExemplo): DocumentoDaConfiguracao {
  const exemplo = Object.entries(EXEMPLOS).find(([caminho]) => caminho.endsWith(`/${nome}.json`));
  if (exemplo === undefined)
    throw new Error(`O exemplo "${nome}" não está em libs/shared-data/openapi/exemplos.`);
  return structuredClone(exemplo[1]);
}

/** O menor documento que o esquema aceita: só o que o formato exige. */
export function documentoSemNada(): DocumentoDaConfiguracao {
  return { formato: 'uniplus.selecao.configuracao', versaoFormato: 1 };
}
