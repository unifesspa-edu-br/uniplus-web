/**
 * O texto de cada recusa do servidor à declaração dos tipos de decisão de uma fase ou de uma etapa.
 * O servidor recusa um código fora do vocabulário, o mesmo código repetido e, ao tirar um tipo, o
 * recurso que ainda tem procedimento para ele.
 */
const RECUSA_DOS_TIPOS_DE_DECISAO: ReadonlyMap<string, string> = new Map([
  [
    'uniplus.selecao.motivo_de_decisao.tipo_invalido',
    'Um tipo de decisão enviado não é reconhecido pelo servidor.',
  ],
  [
    'uniplus.selecao.motivo_de_decisao.tipo_de_decisao_duplicado',
    'O mesmo tipo de decisão foi enviado mais de uma vez.',
  ],
  [
    'uniplus.selecao.regra_recurso_fase.procedimento_para_decisao_nao_declarada',
    'O recurso tem procedimento para uma decisão que deixou de ser declarada aqui; marque o tipo de novo.',
  ],
  [
    'uniplus.selecao.recurso_da_etapa.procedimento_para_decisao_nao_declarada',
    'O recurso tem procedimento para uma decisão que deixou de ser declarada aqui; marque o tipo de novo.',
  ],
]);

/** O texto da recusa à declaração dos tipos de decisão, ou `null` quando a recusa é outra. */
export function textoDaRecusaDosTiposDeDecisao(codigo: string): string | null {
  return RECUSA_DOS_TIPOS_DE_DECISAO.get(codigo) ?? null;
}
