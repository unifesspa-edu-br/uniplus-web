import type { TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';

import { vigenteNoDia } from '../steps/shared/vigencia';

/**
 * Os tipos que o catálogo declara publicáveis como documento avulso e que vigoram no dia, um por
 * código e por nome. Quais são (aviso, comunicado, errata) é cadastro: nenhum código aqui compara o
 * tipo com um literal.
 */
export function tiposDeDocumentoAvulso(
  tipos: readonly TipoAtoPublicadoDto[],
  dia: string,
): readonly TipoAtoPublicadoDto[] {
  const porCodigo = new Map<string, TipoAtoPublicadoDto>();
  for (const tipo of tipos) {
    if (tipo.publicavelComoAvulso && vigenteNoDia(tipo, dia) && !porCodigo.has(tipo.codigo)) {
      porCodigo.set(tipo.codigo, tipo);
    }
  }
  return [...porCodigo.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Os códigos que alguma versão do catálogo declara como congelantes de configuração. */
export function codigosQueCongelam(tipos: readonly TipoAtoPublicadoDto[]): ReadonlySet<string> {
  return new Set(tipos.filter((tipo) => tipo.congelaConfiguracao).map((tipo) => tipo.codigo));
}
