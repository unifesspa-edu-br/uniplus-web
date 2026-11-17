import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CenarioDoComprovante,
  COMPROVANTE_BASE,
  dado,
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

  describe('cursos e modalidades', () => {
    const modalidadesNaTela = (tela: HTMLElement): string[] =>
      Array.from(secao(tela, 'Modalidades de concorrência')?.querySelectorAll('ul > li') ?? []).map(
        (li) => li.textContent?.trim() ?? '',
      );

    it('o processo de uma opção cujo curso a versão não nomeia não mostra a seção "Inscrição"', async () => {
      const [primeira] = COMPROVANTE_BASE.opcoesDeCurso;
      cenario.alteracoes = { opcoesDeCurso: [{ ...primeira, nome: null }] };
      const tela = await cenario.abrir();

      expect(secao(tela, 'Inscrição')).toBeNull();
    });

    it('mostra o curso pelo nome da API e as modalidades na ordem dela, sem o código', async () => {
      const tela = await cenario.abrir();

      expect(dado(tela, 'Curso')).toBe('Direito (Bacharelado) — Campus Marabá');
      expect(modalidadesNaTela(tela)).toEqual([
        'Ampla concorrência',
        'Escola pública, independente de renda',
      ]);
      expect(tela.textContent).not.toContain('LI_EP');
    });

    it('com 2 opções, mostra a 1ª e a 2ª e as modalidades de cada uma', async () => {
      const [primeira] = COMPROVANTE_BASE.opcoesDeCurso;
      cenario.alteracoes = {
        numeroDeOpcoesDeCurso: 2,
        opcoesDeCurso: [
          primeira,
          {
            ordem: 2,
            nome: 'Medicina (Bacharelado) — Campus Marabá',
            modalidades: [{ codigo: 'AC', nome: 'Ampla concorrência', ordem: 0 }],
          },
        ],
      };
      const tela = await cenario.abrir();

      expect(dado(tela, '1ª opção')).toContain('Direito');
      expect(dado(tela, '2ª opção')).toContain('Medicina');
      expect(dado(tela, 'Curso')).toBeNull();
      const listas = Array.from(
        secao(tela, 'Modalidades de concorrência')?.querySelectorAll('ul') ?? [],
      ).map((ul) => Array.from(ul.querySelectorAll('li')).map((li) => li.textContent?.trim()));
      expect(listas).toEqual([
        ['Ampla concorrência', 'Escola pública, independente de renda'],
        ['Ampla concorrência'],
      ]);
    });

    it('o processo de 2 opções com a 2ª vazia mostra "Não declarada" e as modalidades só da 1ª', async () => {
      cenario.alteracoes = { numeroDeOpcoesDeCurso: 2 };
      const tela = await cenario.abrir();

      expect(dado(tela, '2ª opção')).toBe('Não declarada');
      expect(secao(tela, 'Modalidades de concorrência')?.querySelectorAll('ul')).toHaveLength(1);
    });

    it('o processo que não define as modalidades pela inscrição diz isso, sem lista', async () => {
      const [primeira] = COMPROVANTE_BASE.opcoesDeCurso;
      cenario.alteracoes = { opcoesDeCurso: [{ ...primeira, modalidades: null }] };
      const tela = await cenario.abrir();

      const modalidades = secao(tela, 'Modalidades de concorrência');
      expect(modalidades?.querySelector('ul')).toBeNull();
      expect(modalidades?.textContent?.replace(/\s+/g, ' ')).toContain(
        'Este processo seletivo não define pela inscrição as modalidades de concorrência. Consulte o edital.',
      );
    });
  });
});
