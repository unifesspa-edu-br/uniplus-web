import { describe, expect, it } from 'vitest';

import { recusaDaEtapaDeNotaDoEnem } from './recusas-do-servidor-da-etapa';

describe('recusas do servidor à etapa de nota do ENEM', () => {
  it('a recusa do servidor à etapa de nota do ENEM ganha texto próprio', () => {
    expect(
      recusaDaEtapaDeNotaDoEnem(
        'uniplus.selecao.processo_seletivo.etapa_nota_enem_nao_compoe_nota',
      ),
    ).toContain('compõe a média');
    expect(
      recusaDaEtapaDeNotaDoEnem('uniplus.selecao.processo_seletivo.etapa_nota_enem_com_banca'),
    ).toContain('não admite banca');
    expect(
      recusaDaEtapaDeNotaDoEnem(
        'uniplus.selecao.processo_seletivo.etapa_nota_enem_com_produto_ou_recurso_em_ato',
      ),
    ).toContain('recurso da fase que a divulga');
    expect(
      recusaDaEtapaDeNotaDoEnem('uniplus.selecao.processo_seletivo.etapa_nota_enem_com_lancamento'),
    ).toBeNull();
  });
});
