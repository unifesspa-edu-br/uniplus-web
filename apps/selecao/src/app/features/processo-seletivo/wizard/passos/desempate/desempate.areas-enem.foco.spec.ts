import { afterEach, describe, expect, it } from 'vitest';

import { criterio } from './desempate.areas-enem.dados.testing';
import {
  montar,
  responderPendentes,
  criterioPorArea,
  botao,
  acrescentarPelaTela,
  areasNaTela,
  conferirERestaurar,
} from './desempate.areas-enem.montagem.testing';

describe('DesempatePassoComponent — ordem das áreas do ENEM: foco', () => {
  afterEach(conferirERestaurar);

  describe('foco', () => {
    it('acompanha a área movida', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      acrescentarPelaTela(m, 0, 'MATEMATICA');

      botao(m, 'desemp-area-subir-0-1').click();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      // No topo, "para cima" fica indisponível: o foco vai para "para baixo" da mesma área.
      expect(document.activeElement?.id).toBe('desemp-area-descer-0-0');
    });

    it('retirada a primeira área, vai para a que passou a ocupar a posição dela', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      acrescentarPelaTela(m, 0, 'MATEMATICA');

      botao(m, 'desemp-area-remover-0-0').click();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(document.activeElement?.id).toBe('desemp-area-remover-0-0');
      expect(areasNaTela(m, 0)).toEqual(['1ª Matemática']);
    });

    it('retirada uma área depois da primeira, vai para a anterior', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      acrescentarPelaTela(m, 0, 'MATEMATICA');

      botao(m, 'desemp-area-remover-0-1').click();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(document.activeElement?.id).toBe('desemp-area-remover-0-0');
    });

    it('retirada a última área, vai para o seletor', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');

      botao(m, 'desemp-area-remover-0-0').click();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(document.activeElement?.id).toBe('desemp-area-nova-0');
    });

    it('retirada a última área sem o seletor na tela, vai para a regra do critério', async () => {
      const m = await montar({ classificacao: null });
      m.store.patchSection('desempate', [criterio(['REDACAO'])]);
      m.fixture.detectChanges();
      responderPendentes(m.controller);
      m.fixture.detectChanges();

      botao(m, 'desemp-area-remover-0-0').click();
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(document.activeElement?.id).toBe('desemp-regra-0');
    });

    it('acrescentada a última área oferecida, vai para a área que acabou de entrar', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      acrescentarPelaTela(m, 0, 'MATEMATICA');
      await m.fixture.whenStable();

      expect(document.activeElement?.id).toBe('desemp-area-remover-0-1');
    });
  });
});
