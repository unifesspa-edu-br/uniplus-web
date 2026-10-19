import { SituacaoDoRegistroDoAto, type AtoDoProcessoDto } from '@uniplus/shared-data/selecao';

/** O que a cadeia de correção lê de um ato do processo. */
export type AtoDaCadeia = Pick<AtoDoProcessoDto, 'id' | 'atoCorrigidoId' | 'situacao' | 'tipoCodigo'>;

/**
 * Os atos que já têm correção, pendente ou registrada. A cadeia é linear: cada ato é corrigido uma
 * vez, e a correção seguinte aponta o ato mais recente da cadeia.
 */
export function idsJaCorrigidos(atos: readonly AtoDaCadeia[]): ReadonlySet<string> {
  return new Set(atos.flatMap((ato) => (ato.atoCorrigidoId === null ? [] : [ato.atoCorrigidoId])));
}

/**
 * Os atos que a tela oferece para corrigir: publicados, ainda sem correção e de um tipo que não
 * congela a configuração. O edital e a retificação congelam, e só se corrigem por retificação do
 * edital, com nova versão; o servidor recusaria a correção avulsa deles.
 *
 * O servidor continua sendo quem decide: este recorte só evita oferecer o que ele sempre recusaria.
 */
export function atosQueAdmitemCorrecao<T extends AtoDaCadeia>(
  atos: readonly T[],
  tiposQueCongelam: ReadonlySet<string>,
): readonly T[] {
  const corrigidos = idsJaCorrigidos(atos);
  return atos.filter(
    (ato) =>
      ato.situacao === SituacaoDoRegistroDoAto.registrado &&
      !corrigidos.has(ato.id) &&
      !tiposQueCongelam.has(ato.tipoCodigo),
  );
}
