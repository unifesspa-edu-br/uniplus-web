import { TestBed } from '@angular/core/testing';
import { GuardaDaVagaCodigo } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  MENSAGEM_DA_GUARDA_RETIRADA,
  MENSAGEM_DO_PRAZO_RETIRADO,
  type ParametrosDoRecurso,
} from './parametros-do-recurso';
import {
  montarParametrosDoRecurso,
  PARAMETROS_COM_INSTANCIA_SUPERIOR,
  PARAMETROS_SEM_INSTANCIA_SUPERIOR,
  PREFIXO_DOS_PARAMETROS as P,
  UNIDADES_DO_PRAZO_NA_API,
  umaLeituraDoRecurso,
} from './parametros-do-recurso.testing';

const por = (raiz: HTMLElement, id: string) => raiz.querySelector<HTMLElement>(`#${id}`);
const radio = (raiz: HTMLElement, id: string) => raiz.querySelector<HTMLInputElement>(`#${id}`);
const aviso = (raiz: HTMLElement) => (por(raiz, `${P}-aviso`)?.textContent ?? '').trim();

describe('ParametrosDoRecursoComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('o que mostra', () => {
    it('traz os parâmetros na ordem em que a pessoa os responde', () => {
      const { raiz } = montarParametrosDoRecurso({
        parametros: PARAMETROS_COM_INSTANCIA_SUPERIOR,
      });

      const legendas = Array.from(raiz.querySelectorAll('legend')).map((legenda) =>
        legenda.textContent?.trim(),
      );
      expect(legendas).toEqual([
        'Prazo de interposição (obrigatório)',
        'Admite instância superior? (obrigatório)',
        'Efeito suspensivo na 1ª instância (obrigatório)',
        'Guarda da vaga em disputa',
        'Prazo para recorrer em 2ª instância (obrigatório)',
      ]);
    });

    it('marca o que está gravado e oferece as opções que a API devolveu', () => {
      const { raiz } = montarParametrosDoRecurso();

      expect(por(raiz, `${P}-prazo-interposicao-valor`)).toHaveProperty('value', '2');
      expect(por(raiz, `${P}-prazo-interposicao-unidade`)).toHaveProperty('value', 'diasUteis');
      expect(radio(raiz, `${P}-superior-nao`)?.checked).toBe(true);
      expect(radio(raiz, `${P}-superior-sim`)?.checked).toBe(false);
      expect(radio(raiz, `${P}-efeito-opcao-semEfeitoSuspensivo`)?.checked).toBe(true);
      expect(radio(raiz, `${P}-guarda-opcao-ateOResultadoDefinitivo`)?.checked).toBe(true);
      expect(radio(raiz, `${P}-guarda-opcao-naoGuarda`)?.checked).toBe(false);
    });

    it('explica cada efeito e cada guarda com o texto que a API deu', () => {
      const { raiz } = montarParametrosDoRecurso();

      expect(raiz.textContent).toContain('O recurso não suspende o processo');
      expect(raiz.textContent).toContain(
        'A vaga fica guardada até a publicação do resultado definitivo.',
      );
    });

    it('com a instância superior em aberto, marca a pergunta como inválida e pede a resposta', () => {
      const { raiz } = montarParametrosDoRecurso({
        parametros: { ...PARAMETROS_SEM_INSTANCIA_SUPERIOR, admiteInstanciaSuperior: null },
      });

      const grupo = raiz.querySelector('fieldset[role="radiogroup"]');
      expect(grupo?.getAttribute('aria-invalid')).toBe('true');
      expect(por(raiz, `${P}-superior-erro`)?.getAttribute('role')).toBe('alert');
      expect(por(raiz, `${P}-superior-erro`)?.textContent).toContain(
        'Responda se o recurso admite instância superior.',
      );
    });

    it('respondida a instância superior, a pergunta deixa de ser inválida', () => {
      const { raiz } = montarParametrosDoRecurso();

      expect(
        raiz.querySelector('fieldset[role="radiogroup"]')?.getAttribute('aria-invalid'),
      ).toBeNull();
      expect(por(raiz, `${P}-superior-erro`)).toBeNull();
    });

    it('desabilita todos os controles quando a tela não aceita edição', () => {
      const { raiz } = montarParametrosDoRecurso({ desabilitado: true });

      const controles = Array.from(raiz.querySelectorAll<HTMLInputElement>('input, select'));
      expect(controles.length).toBeGreaterThan(0);
      expect(controles.filter((controle) => !controle.disabled)).toEqual([]);
    });
  });

  describe('o que avisa', () => {
    it('emite a mudança do prazo digitado, como texto', () => {
      const { raiz, alteracoes, fixture } = montarParametrosDoRecurso();
      const campo = por(raiz, `${P}-prazo-interposicao-valor`) as HTMLInputElement;

      campo.value = '5';
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(alteracoes).toEqual([{ campo: 'prazoValor', valor: '5' }]);
    });

    it('emite a unidade escolhida pelo código, e não pelo nome', () => {
      const { raiz, alteracoes } = montarParametrosDoRecurso();
      const campo = por(raiz, `${P}-prazo-interposicao-unidade`) as HTMLSelectElement;

      campo.value = 'horas';
      campo.dispatchEvent(new Event('change'));

      expect(alteracoes).toEqual([{ campo: 'prazoUnidade', valor: 'horas' }]);
    });

    it('emite a resposta da instância superior como booleano', () => {
      const { raiz, alteracoes } = montarParametrosDoRecurso();

      radio(raiz, `${P}-superior-sim`)?.click();

      expect(alteracoes).toEqual([{ campo: 'admiteInstanciaSuperior', valor: true }]);
    });

    it('emite o efeito e a guarda escolhidos pelo código', () => {
      const { raiz, alteracoes } = montarParametrosDoRecurso({
        parametros: { ...PARAMETROS_SEM_INSTANCIA_SUPERIOR, efeitoSuspensivo: '' },
      });

      radio(raiz, `${P}-efeito-opcao-semEfeitoSuspensivo`)?.click();
      radio(raiz, `${P}-guarda-opcao-naoGuarda`)?.click();

      expect(alteracoes).toEqual([
        { campo: 'efeitoSuspensivo', valor: 'semEfeitoSuspensivo' },
        { campo: 'guardaDaVaga', valor: 'naoGuarda' },
      ]);
    });
  });

  describe('a guarda da vaga com instância superior', () => {
    const comInstanciaSuperior = (guarda: ParametrosDoRecurso['guardaDaVaga']) => ({
      parametros: { ...PARAMETROS_COM_INSTANCIA_SUPERIOR, guardaDaVaga: guarda },
    });

    it('deixa de oferecer "não guarda"', () => {
      const { raiz } = montarParametrosDoRecurso(
        comInstanciaSuperior(GuardaDaVagaCodigo.ateOResultadoDefinitivo),
      );

      expect(radio(raiz, `${P}-guarda-opcao-naoGuarda`)).toBeNull();
      expect(radio(raiz, `${P}-guarda-opcao-ateOResultadoDefinitivo`)).not.toBeNull();
    });

    it('mantém "não guarda" à vista enquanto for o valor gravado, e explica que a vaga é fixa', () => {
      const { raiz } = montarParametrosDoRecurso(
        comInstanciaSuperior(GuardaDaVagaCodigo.naoGuarda),
      );

      expect(radio(raiz, `${P}-guarda-opcao-naoGuarda`)?.checked).toBe(true);
      expect(raiz.textContent).toContain(
        'Com 2ª instância, a vaga fica sempre guardada até o resultado definitivo.',
      );
    });
  });

  describe('o prazo da 2ª instância', () => {
    it('não aparece sem instância superior', () => {
      const { raiz } = montarParametrosDoRecurso();

      expect(por(raiz, `${P}-prazo-segunda-valor`)).toBeNull();
    });

    it('aparece com instância superior, obrigatório e sem botão de retirar', () => {
      const { raiz } = montarParametrosDoRecurso({ parametros: PARAMETROS_COM_INSTANCIA_SUPERIOR });

      expect(por(raiz, `${P}-prazo-segunda-valor`)?.getAttribute('aria-required')).toBe('true');
      expect(por(raiz, `${P}-prazo-segunda-retirar`)).toBeNull();
    });

    it('aparece quando a leitura o trouxe sem instância superior, com o botão de retirar', () => {
      const { raiz } = montarParametrosDoRecurso({
        parametros: {
          ...PARAMETROS_SEM_INSTANCIA_SUPERIOR,
          prazoSegundaInstanciaValor: '3',
          prazoSegundaInstanciaUnidade: 'diasUteis',
        },
        leitura: umaLeituraDoRecurso({ prazoDaSegundaInstanciaSemInstanciaSuperior: true }),
      });

      expect(por(raiz, `${P}-prazo-segunda-valor`)).toHaveProperty('value', '3');
      expect(por(raiz, `${P}-prazo-segunda-retirar`)).not.toBeNull();
    });

    it('retirar avisa quem usa, anuncia o que foi feito e leva o foco à pergunta da instância superior', async () => {
      const { raiz, fixture, retiradas } = montarParametrosDoRecurso({
        parametros: {
          ...PARAMETROS_SEM_INSTANCIA_SUPERIOR,
          prazoSegundaInstanciaValor: '3',
          prazoSegundaInstanciaUnidade: 'diasUteis',
        },
        leitura: umaLeituraDoRecurso({ prazoDaSegundaInstanciaSemInstanciaSuperior: true }),
      });

      por(raiz, `${P}-prazo-segunda-retirar`)?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(retiradas.vezes).toBe(1);
      expect(aviso(raiz)).toBe(MENSAGEM_DO_PRAZO_RETIRADO);
      expect(document.activeElement?.id).toBe(`${P}-superior-nao`);
    });
  });

  describe('o foco quando as unidades do prazo chegam', () => {
    it.each(['prazo-interposicao', 'prazo-segunda'])(
      'do %s, passa do parágrafo de situação ao seletor da unidade',
      async (prazo) => {
        const { raiz, fixture, catalogo } = montarParametrosDoRecurso(
          {
            parametros: {
              ...PARAMETROS_COM_INSTANCIA_SUPERIOR,
              prazoUnidade: '',
              prazoSegundaInstanciaUnidade: '',
            },
          },
          'pendentes',
        );
        por(raiz, `${P}-${prazo}-situacao`)?.focus();

        catalogo.unidadesDePrazo.set(UNIDADES_DO_PRAZO_NA_API);
        fixture.detectChanges();
        await fixture.whenStable();

        expect(document.activeElement).toBe(por(raiz, `${P}-${prazo}-unidade`));
      },
    );
  });

  describe('a região de aviso', () => {
    it('existe desde o primeiro desenho, como região de situação, vazia quando nada aconteceu', () => {
      const { raiz } = montarParametrosDoRecurso();

      expect(por(raiz, `${P}-aviso`)?.getAttribute('role')).toBe('status');
      expect(aviso(raiz)).toBe('');
    });

    it('anuncia que as opções ainda estão carregando', () => {
      const { raiz } = montarParametrosDoRecurso({}, 'pendentes');

      expect(aviso(raiz)).toBe('Carregando as opções do recurso…');
    });

    it('anuncia quando a API não devolveu opção alguma', () => {
      const { raiz } = montarParametrosDoRecurso({}, 'vazias');

      expect(aviso(raiz)).toBe('Nenhuma opção disponível.');
    });

    it('anuncia a falha da leitura das opções e manda usar a nova tentativa do topo do passo', () => {
      const { raiz } = montarParametrosDoRecurso({}, 'falham');

      expect(aviso(raiz)).toBe(
        'As opções do recurso não carregaram. Use "Tentar de novo" no aviso do topo do passo.',
      );
    });

    it('anuncia que "não guarda" foi retirada ao marcar instância superior', () => {
      const { raiz, fixture } = montarParametrosDoRecurso({
        parametros: {
          ...PARAMETROS_SEM_INSTANCIA_SUPERIOR,
          guardaDaVaga: GuardaDaVagaCodigo.naoGuarda,
        },
      });

      radio(raiz, `${P}-superior-sim`)?.click();
      fixture.detectChanges();

      expect(aviso(raiz)).toBe(MENSAGEM_DA_GUARDA_RETIRADA);
    });
  });
});
