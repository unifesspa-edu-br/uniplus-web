import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CenarioDoComprovante,
  dado,
  FUSO,
  hrefDe,
  INSCRICAO_ID,
  links,
  PROCESSO,
  secao,
} from './comprovante-da-inscricao.page.testing';

describe('ComprovanteDaInscricaoPage', () => {
  let cenario: CenarioDoComprovante;

  beforeEach(() => {
    cenario = CenarioDoComprovante.preparar();
  });

  afterEach(() => {
    cenario.encerrar();
  });

  describe('navegação entre os envios', () => {
    it('mostra a posição pelo total da API e leva ao envio anterior pelo número que ela informa', async () => {
      const tela = await cenario.abrir();

      expect(tela.textContent).toContain('Envio 2 de 2');
      expect(links(tela)).toEqual(['‹ Envio anterior']);
      expect(hrefDe(tela, '‹ Envio anterior')).toBe(`/inscricao/comprovante/${INSCRICAO_ID}/1`);
    });

    it('no primeiro envio oferece só o seguinte', async () => {
      cenario.alteracoes = { inscricao: { total: 3, numeroAnterior: null, numeroSeguinte: 2 } };
      const tela = await cenario.abrir('1');

      expect(links(tela)).toEqual(['Envio seguinte ›']);
      expect(hrefDe(tela, 'Envio seguinte ›')).toBe(`/inscricao/comprovante/${INSCRICAO_ID}/2`);
    });

    it('o envio que vale leva a etiqueta e não avisa que foi substituído', async () => {
      const tela = await cenario.abrir();

      expect(dado(tela, 'Situação')).toBe('É o que vale');
      expect(tela.textContent).not.toContain('foi substituído');
    });

    it('o envio substituído avisa e aponta o último, pelo total, sem oferecer a correção', async () => {
      cenario.alteracoes = {
        inscricao: {
          vale: false,
          numeroSeguinte: 2,
          numeroAnterior: null,
          total: 3,
          prazoDaCorrecao: null,
        },
      };
      const tela = await cenario.abrir('1');

      expect(dado(tela, 'Situação')).toBe('Substituído');
      expect(tela.textContent).toContain('Este envio foi substituído por um mais recente');
      expect(hrefDe(tela, 'Ver o envio mais recente')).toBe(
        `/inscricao/comprovante/${INSCRICAO_ID}/3`,
      );
      expect(secao(tela, 'Prazo para correção')).toBeNull();
    });
  });

  describe('prazo da correção', () => {
    it('com o prazo aberto, diz até quando e leva à correção do processo', async () => {
      const tela = await cenario.abrir();

      const passos = secao(tela, 'Prazo para correção') as HTMLElement;
      expect(passos.textContent).toContain('19/12/2026, 23:59');
      expect(passos.textContent).toContain('horário de Belém (PA)');
      expect(hrefDe(tela, 'Corrigir dados')).toBe(`/inscricao/${PROCESSO}`);
    });

    it('com o prazo encerrado, diz que não se corrige mais e não oferece a correção', async () => {
      cenario.alteracoes = {
        inscricao: {
          prazoDaCorrecao: { fim: '2026-12-20T02:59:00Z', fusoHorario: FUSO, aberto: false },
        },
      };
      const tela = await cenario.abrir();

      expect(secao(tela, 'Prazo para correção')?.textContent).toContain(
        'Não é mais possível corrigir',
      );
      expect(hrefDe(tela, 'Corrigir dados')).toBeUndefined();
    });

    it('sem prazo na resposta, a seção não aparece', async () => {
      cenario.alteracoes = { inscricao: { prazoDaCorrecao: null } };
      const tela = await cenario.abrir();

      expect(secao(tela, 'Prazo para correção')).toBeNull();
    });
  });
});
