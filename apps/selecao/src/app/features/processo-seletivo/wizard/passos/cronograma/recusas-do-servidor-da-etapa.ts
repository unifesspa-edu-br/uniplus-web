/**
 * Texto próprio das recusas do servidor à etapa de nota do ENEM, que o título genérico não
 * orienta: cada um diz o que corrigir no passo.
 */
const RECUSA_DA_ETAPA_DE_NOTA_DO_ENEM: ReadonlyMap<string, string> = new Map([
  [
    'uniplus.selecao.processo_seletivo.etapa_nota_enem_nao_compoe_nota',
    'A etapa de nota do ENEM compõe a média: declare caráter classificatória (ou ambas) e um peso maior que zero.',
  ],
  [
    'uniplus.selecao.processo_seletivo.etapa_nota_enem_com_banca',
    'A etapa de nota do ENEM não admite banca: a nota é calculada, e quem julga o recurso é declarado na fase de recursos.',
  ],
  [
    'uniplus.selecao.processo_seletivo.etapa_nota_enem_com_produto_ou_recurso_em_ato',
    'A etapa de nota do ENEM não publica ato nem abre recurso contado de publicação: o resultado sai pela fase, e a nota se contesta no recurso da fase que a divulga.',
  ],
]);

/** O texto da recusa à etapa de nota do ENEM, ou `null` quando a recusa é outra. */
export function recusaDaEtapaDeNotaDoEnem(codigo: string): string | null {
  return RECUSA_DA_ETAPA_DE_NOTA_DO_ENEM.get(codigo) ?? null;
}
