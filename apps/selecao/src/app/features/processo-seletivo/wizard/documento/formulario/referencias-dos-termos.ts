import type { TermoConsentimentoDto } from '@uniplus/shared-data/configuracao';

export interface ReferenciaDaVersaoDoTermo {
  readonly termoId: string;
  readonly termoCodigo: string;
  readonly versaoId: string;
  readonly versaoNumero: number;
}

export type ReferenciasDosTermosDoFormulario = readonly ReferenciaDaVersaoDoTermo[];

export function referenciasDosTermos(
  termos: readonly TermoConsentimentoDto[],
): ReferenciasDosTermosDoFormulario {
  return termos.flatMap((termo) =>
    termo.versoes.map((versao) => ({
      termoId: termo.id,
      termoCodigo: termo.codigo,
      versaoId: versao.id,
      versaoNumero: versao.numero,
    })),
  );
}

/** Resolve somente uma correspondência exata entre as identidades da versão. */
export function referenciaPorCodigoENumero(
  referencias: ReferenciasDosTermosDoFormulario,
  termoCodigo: string,
  versaoNumero: number,
): ReferenciaDaVersaoDoTermo | undefined {
  const encontradas = referencias.filter(
    (referencia) =>
      referencia.termoCodigo === termoCodigo && referencia.versaoNumero === versaoNumero,
  );
  return encontradas.length === 1 ? encontradas[0] : undefined;
}

/** A versão precisa pertencer ao termo selecionado; referências ambíguas são recusadas. */
export function referenciaPorIdentificadores(
  referencias: ReferenciasDosTermosDoFormulario,
  termoId: string,
  versaoId: string,
): ReferenciaDaVersaoDoTermo | undefined {
  const encontradas = referencias.filter(
    (referencia) => referencia.termoId === termoId && referencia.versaoId === versaoId,
  );
  return encontradas.length === 1 ? encontradas[0] : undefined;
}
