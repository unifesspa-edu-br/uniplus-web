import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OfertaDaInscricao } from '../oferta-da-inscricao';
import { AnuncioDaInscricao } from './anuncio-da-inscricao';
import { EscolhaDoCurso, PASSO_DO_CURSO } from './escolha-do-curso';
import { type InscricaoCarregada, LeituraDaInscricao } from './leitura-da-inscricao';

const DIREITO = { id: 'oferta-1', nome: 'Direito' };
const MEDICINA = { id: 'oferta-2', nome: 'Medicina' };
const RECUSA_DA_2A = {
  codigo: 'uniplus.selecao.inscricao.segunda_opcao_igual_a_primeira',
  mensagem: 'A 2ª opção precisa ser outro curso.',
};

type CargaMinima = Pick<InscricaoCarregada, 'ofertas' | 'numeroDeOpcoes'> & {
  readonly inscricao: { ofertaCursoId: string | null; ofertaCursoSegundaOpcaoId: string | null };
};

function carga(
  ofertas: readonly OfertaDaInscricao[],
  numeroDeOpcoes: 1 | 2,
  gravadas: [string | null, string | null] = [null, null],
): CargaMinima {
  const [ofertaCursoId, ofertaCursoSegundaOpcaoId] = gravadas;
  return { ofertas, numeroDeOpcoes, inscricao: { ofertaCursoId, ofertaCursoSegundaOpcaoId } };
}

describe('EscolhaDoCurso', () => {
  const carregada = signal<CargaMinima | null>(null);
  let repetir: ReturnType<typeof vi.fn>;

  function escolha(dados: CargaMinima): EscolhaDoCurso {
    carregada.set(dados);
    return TestBed.inject(EscolhaDoCurso);
  }

  beforeEach(() => {
    carregada.set(null);
    repetir = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        EscolhaDoCurso,
        { provide: LeituraDaInscricao, useValue: { carregada } },
        { provide: AnuncioDaInscricao, useValue: { repetir } },
      ],
    });
  });

  describe('passo Curso', () => {
    it('com uma oferta só, não há passo: ela é escolhida sozinha', () => {
      const curso = escolha(carga([DIREITO], 2));

      expect(curso.passosPrefixados()).toEqual([]);
      expect(curso.ofertaEscolhida()).toBe(DIREITO.id);
    });

    it('com uma opção e nenhum curso escolhido, o passo está aberto e o resumo diz que falta escolher', () => {
      const curso = escolha(carga([DIREITO, MEDICINA], 1));

      expect(curso.passosPrefixados()).toEqual([
        {
          chave: PASSO_DO_CURSO,
          titulo: 'Curso',
          descricao: 'Escolha o curso em que você quer se inscrever neste processo seletivo.',
          concluido: false,
          comErro: false,
          resumo: [{ rotulo: 'Curso', valor: 'Ainda não escolhido' }],
        },
      ]);
    });

    it('com uma opção e o curso gravado, o passo está concluído e o resumo traz o nome do curso', () => {
      const curso = escolha(carga([DIREITO, MEDICINA], 1, [MEDICINA.id, null]));

      expect(curso.passosPrefixados()[0]).toMatchObject({
        concluido: true,
        resumo: [{ rotulo: 'Curso', valor: 'Medicina' }],
      });
    });

    it('com 2 opções, o passo escolhe a 1ª e a 2ª, e a 2ª fica como não declarada enquanto vazia', () => {
      const curso = escolha(carga([DIREITO, MEDICINA], 2, [DIREITO.id, null]));

      expect(curso.passosPrefixados()[0]).toMatchObject({
        descricao:
          'Escolha o curso da 1ª opção e, se quiser, o da 2ª opção neste processo seletivo.',
        concluido: true,
        resumo: [
          { rotulo: '1ª opção', valor: 'Direito' },
          { rotulo: '2ª opção', valor: 'Não declarada' },
        ],
      });
    });

    it('com 2 opções e nada escolhido, o resumo diz que a 1ª ainda não foi escolhida', () => {
      const curso = escolha(carga([DIREITO, MEDICINA], 2));

      expect(curso.passosPrefixados()[0]).toMatchObject({
        concluido: false,
        resumo: [
          { rotulo: '1ª opção', valor: 'Ainda não escolhida' },
          { rotulo: '2ª opção', valor: 'Não declarada' },
        ],
      });
    });

    it('o erro de qualquer das opções marca o passo com erro', () => {
      const curso = escolha(carga([DIREITO, MEDICINA], 2, [DIREITO.id, MEDICINA.id]));
      expect(curso.passosPrefixados()[0].comErro).toBe(false);

      curso.erroDaSegundaOferta.set('Revise.');
      expect(curso.passosPrefixados()[0].comErro).toBe(true);

      curso.erroDaSegundaOferta.set(null);
      curso.erroDaOferta.set('Revise.');
      expect(curso.passosPrefixados()[0].comErro).toBe(true);
    });
  });

  describe('onde cada recusa de oferta aparece', () => {
    it('sem o passo Curso, a recusa da 1ª sai como recusa geral e nenhum campo é tocado', () => {
      const curso = escolha(carga([DIREITO], 2));

      const mostradas = curso.mostrarRecusas('Escolha o curso.', RECUSA_DA_2A);

      expect(mostradas).toEqual({ textoGeral: 'Escolha o curso.', mostradas: 1 });
      expect(curso.erroDaOferta()).toBeNull();
      expect(curso.erroDaSegundaOferta()).toBeNull();
      expect(curso.pedidoDeFoco()).toBeNull();
    });

    it('sem o passo Curso e sem recusa da 1ª, a recusa da 2ª sai como recusa geral', () => {
      const curso = escolha(carga([DIREITO], 2));

      expect(curso.mostrarRecusas(null, RECUSA_DA_2A)).toEqual({
        textoGeral: RECUSA_DA_2A.mensagem,
        mostradas: 1,
      });
    });

    it('com 2 opções, cada recusa vai ao campo da sua opção e o foco vai à 1ª', () => {
      const curso = escolha(carga([DIREITO, MEDICINA], 2));

      const mostradas = curso.mostrarRecusas('Escolha o curso.', RECUSA_DA_2A);

      expect(mostradas).toEqual({ textoGeral: null, mostradas: 2 });
      expect(curso.erroDaOferta()).toBe('Escolha o curso.');
      expect(curso.erroDaSegundaOferta()).toBe(RECUSA_DA_2A.mensagem);
      expect(curso.pedidoDeFoco()).toEqual({ primeira: true });
    });

    it('com 2 opções e só a 2ª recusada, o foco vai ao campo da 2ª', () => {
      const curso = escolha(carga([DIREITO, MEDICINA], 2));

      const mostradas = curso.mostrarRecusas(null, RECUSA_DA_2A);

      expect(mostradas).toEqual({ textoGeral: null, mostradas: 1 });
      expect(curso.erroDaOferta()).toBeNull();
      expect(curso.erroDaSegundaOferta()).toBe(RECUSA_DA_2A.mensagem);
      expect(curso.pedidoDeFoco()).toEqual({ primeira: false });
    });

    it('com 1 opção, a recusa da 1ª vai ao campo e a da 2ª, que não tem campo, sai como geral', () => {
      const curso = escolha(carga([DIREITO, MEDICINA], 1));

      const mostradas = curso.mostrarRecusas('Escolha o curso.', RECUSA_DA_2A);

      expect(mostradas).toEqual({ textoGeral: RECUSA_DA_2A.mensagem, mostradas: 2 });
      expect(curso.erroDaOferta()).toBe('Escolha o curso.');
      expect(curso.erroDaSegundaOferta()).toBeNull();
      expect(curso.pedidoDeFoco()).toEqual({ primeira: true });
    });

    it('com 1 opção e só a recusa da 2ª, ela sai como geral e nenhum campo é tocado', () => {
      const curso = escolha(carga([DIREITO, MEDICINA], 1));

      const mostradas = curso.mostrarRecusas(null, RECUSA_DA_2A);

      expect(mostradas).toEqual({ textoGeral: RECUSA_DA_2A.mensagem, mostradas: 1 });
      expect(curso.erroDaOferta()).toBeNull();
      expect(curso.erroDaSegundaOferta()).toBeNull();
      expect(curso.pedidoDeFoco()).toBeNull();
    });

    it('com o passo na tela e sem recusa alguma, os campos ficam limpos e o foco pede a 2ª', () => {
      const curso = escolha(carga([DIREITO, MEDICINA], 2));
      curso.erroDaOferta.set('Antiga.');

      const mostradas = curso.mostrarRecusas(null, null);

      expect(mostradas).toEqual({ textoGeral: null, mostradas: 0 });
      expect(curso.erroDaOferta()).toBeNull();
      expect(curso.pedidoDeFoco()).toEqual({ primeira: false });
    });

    it('o curso ausente é recusa no campo da 1ª, com o foco nele', () => {
      const curso = escolha(carga([DIREITO, MEDICINA], 1));

      curso.recusarCursoAusente();

      expect(curso.erroDaOferta()).toBeTruthy();
      expect(curso.pedidoDeFoco()).toEqual({ primeira: true });
    });

    it('trocar a 1ª desfaz a recusa da 2ª que vem da 1ª e mantém a que não depende dela', () => {
      const curso = escolha(carga([DIREITO, MEDICINA], 2));
      curso.mostrarRecusas(null, RECUSA_DA_2A);
      curso.escolherOferta(DIREITO.id);
      expect(curso.erroDaSegundaOferta()).toBeNull();

      curso.mostrarRecusas(null, {
        codigo: 'uniplus.selecao.inscricao.nenhuma_modalidade',
        mensagem: 'x',
      });
      curso.escolherOferta(MEDICINA.id);
      expect(curso.erroDaSegundaOferta()).toBe('x');
    });
  });

  it('trocar a 1ª para o curso da 2ª limpa a 2ª e anuncia o aviso', () => {
    const curso = escolha(carga([DIREITO, MEDICINA], 2, [DIREITO.id, MEDICINA.id]));

    curso.escolherOferta(MEDICINA.id);

    expect(curso.segundaOfertaEscolhida()).toBeNull();
    expect(curso.avisoDaSegundaLimpa()).toContain('é o mesmo curso da nova 1ª opção');
    expect(repetir).toHaveBeenCalledWith(curso.avisoDaSegundaLimpa());
  });
});
