import { PAPEL_DEFINITIVO, type FaseDoCronograma } from '../processo-seletivo.models';

/** A fase encerra a matéria que abriu: do que ela publica não cabe mais recurso. */
export function publicaResultadoDefinitivo(produtos: FaseDoCronograma['produtos']): boolean {
  return produtos.some((produto) => produto.papel === PAPEL_DEFINITIVO);
}
