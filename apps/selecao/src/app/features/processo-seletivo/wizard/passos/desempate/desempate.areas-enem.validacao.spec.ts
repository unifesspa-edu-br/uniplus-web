import { afterEach, describe, expect, it } from 'vitest';

import {
  RESOLUCAO,
  TECNOLOGICA,
  SAUDE,
  area,
  criterio,
} from './desempate.areas-enem.dados.testing';
import {
  montar,
  classificacaoGravada,
  criterioPorArea,
  seletor,
  opcoesDoSeletor,
  areasNaTela,
  textoDaTela,
  conferirERestaurar,
} from './desempate.areas-enem.montagem.testing';

describe('DesempatePassoComponent — ordem das áreas do ENEM: validação', () => {
  afterEach(conferirERestaurar);

  describe('validação', () => {
    it('recusa o critério por área sem nenhuma área', async () => {
      const m = await montar();
      criterioPorArea(m);

      expect(m.componente.validar()).toEqual({
        valid: false,
        messages: ['Critério de desempate 1: acrescente ao menos uma área do ENEM.'],
      });
    });

    it('recusa área que não é comum a todos os grupos, nomeada pelo rótulo na lista e na recusa', async () => {
      const m = await montar();
      m.store.patchSection('desempate', [criterio(['AREA_SO_DE_UM_GRUPO'])]);
      m.fixture.detectChanges();

      expect(areasNaTela(m, 0)).toEqual(['1ª Área de um grupo só']);
      expect(m.componente.validar()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: a área Área de um grupo só não é comum a todos os grupos da resolução de Peso por Área.',
        ],
      });
    });

    it('com o quadro sem nenhuma área comum a todos os grupos, diz que nenhuma área desempata', async () => {
      const m = await montar({
        antesDeMontar: classificacaoGravada(RESOLUCAO, [
          { grupoAreaEnem: TECNOLOGICA, baseLegal: 'Anexo I', areas: [area('REDACAO', 'Redação')] },
          { grupoAreaEnem: SAUDE, baseLegal: 'Anexo I', areas: [area('MATEMATICA', 'Matemática')] },
        ]),
      });
      m.store.patchSection('desempate', [criterio(['MATEMATICA'])]);
      m.fixture.detectChanges();

      expect(seletor(m, 0)).toBeNull();
      expect(textoDaTela(m)).toContain('Nenhuma área do ENEM está em todos os grupos');
      expect(m.componente.validar()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: nenhuma área do ENEM está em todos os grupos do quadro de Peso por Área, e só uma área comum a todos desempata; troque a regra do critério ou escolha outra resolução no passo Fórmula.',
        ],
      });
    });

    it('com a classificação gravada sem grupo no quadro, trata como gravada sem quadro', async () => {
      const m = await montar({ antesDeMontar: classificacaoGravada(RESOLUCAO, []) });
      criterioPorArea(m);

      expect(m.store.classificacao.gravada()).toEqual({ estado: 'sem-quadro' });
      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Matemática']);
    });

    it('recusa a área repetida no mesmo critério que veio gravada', async () => {
      const m = await montar();
      m.store.patchSection('desempate', [criterio(['REDACAO', 'MATEMATICA', 'REDACAO'])]);

      expect(m.componente.validar()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: a área Redação aparece mais de uma vez na ordem de desempate.',
        ],
      });
    });

    it('recusa a área repetida entre critérios que veio gravada, no critério que a repete', async () => {
      const m = await montar();
      m.store.patchSection('desempate', [
        criterio(['REDACAO']),
        criterio(['MATEMATICA', 'REDACAO']),
      ]);

      expect(m.componente.validar()).toEqual({
        valid: false,
        messages: ['Critério de desempate 2: a área Redação já é citada pelo critério 1.'],
      });
    });
  });
});
