import type { HttpTestingController } from '@angular/common/http/testing';
import type { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import {
  StatusProcesso,
  UnidadePrazo,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import type { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { PrazoDoRecursoComponent } from '../../../shared/configuracao-do-recurso/prazo-do-recurso.component';
import { fase, montarFase } from '../fase.testing';
import { faseComRegra, REGRA } from './regra-de-recurso-da-fase.testing';

describe('RegraDeRecursoDaFaseComponent', () => {
  let controller: HttpTestingController;
  let nativo: HTMLElement;
  let store: ProcessoSeletivoStore;
  let detectar: () => void;
  let raiz: DebugElement;
  let comCronograma: (...fases: readonly FaseDoCronograma[]) => void;

  beforeEach(async () => {
    ({ controller, nativo, comCronograma, store, detectar, raiz } = await montarFase());
    comCronograma(
      fase({
        produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
        regraRecurso: REGRA as FaseDoCronograma['regraRecurso'],
      }),
    );
  });

  afterEach(() => controller.verify());

  const campo = (sufixo: string) =>
    nativo.querySelector<HTMLElement>(`#fase-AVALIACAO-${sufixo}`) as HTMLElement;

  it('desenha os três prazos, cada um ligado ao rótulo e à ajuda dele', () => {
    for (const [par, ajuda] of [
      ['prazo', 'prazo-ajuda'],
      ['susp1', 'susp-ajuda'],
      ['susp2', 'susp-ajuda'],
    ]) {
      for (const parte of ['valor', 'unidade']) {
        const controle = campo(`${par}-${parte}`);
        expect(controle, `${par}-${parte}`).not.toBeNull();
        expect(nativo.querySelector(`label[for="fase-AVALIACAO-${par}-${parte}"]`)).not.toBeNull();
        expect(controle.getAttribute('aria-describedby')).toBe(`fase-AVALIACAO-${ajuda}`);
      }
    }
  });

  it('põe cada prazo num grupo nomeado pela legenda, na linha inteira da grade da regra', () => {
    const grupos = Array.from(nativo.querySelectorAll('sel-prazo-do-recurso'));

    expect(grupos.map((grupo) => grupo.querySelector('legend')?.textContent?.trim())).toEqual([
      'Prazo de interposição (obrigatório)',
      'Suspensividade da 1ª instância',
      'Suspensividade da 2ª instância',
    ]);
    for (const grupo of grupos) {
      expect(grupo.classList).toContain('form-grid__full');
      expect(grupo.parentElement?.classList).toContain('form-grid');
    }
  });

  it('pede o prazo de interposição como obrigatório e as suspensividades como opcionais', () => {
    expect(campo('prazo-valor').getAttribute('aria-required')).toBe('true');
    expect(campo('prazo-unidade').getAttribute('aria-required')).toBe('true');
    expect(campo('susp1-valor').hasAttribute('aria-required')).toBe(false);
    expect(campo('susp2-unidade').hasAttribute('aria-required')).toBe(false);
  });

  it('o prazo de interposição começa com a opção em branco "Escolha a unidade"', () => {
    expect(campo('prazo-unidade').querySelector('option')?.textContent?.trim()).toBe(
      'Escolha a unidade',
    );
  });

  it('a suspensividade começa com a opção em branco "Sem suspensividade"', () => {
    expect(campo('susp1-unidade').querySelector('option')?.textContent?.trim()).toBe(
      'Sem suspensividade',
    );
  });

  it('mostra o valor e a unidade que a regra já traz', () => {
    expect((campo('prazo-valor') as HTMLInputElement).value).toBe('2');
    expect((campo('prazo-unidade') as HTMLSelectElement).value).toBe(UnidadePrazo.diasUteis);
    expect((campo('susp1-unidade') as HTMLSelectElement).value).toBe(UnidadePrazo.horas);
  });

  it('liga a regra e as duas suspensividades às respectivas mensagens de erro', () => {
    comCronograma(
      fase({
        produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
        regraRecurso: {
          ...REGRA,
          regraCodigo: '',
          suspensividadePrimeiraInstanciaUnidade: '',
          suspensividadeSegundaInstanciaValor: '1',
        } as FaseDoCronograma['regraRecurso'],
      }),
    );

    for (const [sufixo, erro] of [
      ['regra', 'regra-erro'],
      ['susp1-valor', 'susp1-erro'],
      ['susp1-unidade', 'susp1-erro'],
      ['susp2-valor', 'susp2-erro'],
      ['susp2-unidade', 'susp2-erro'],
    ]) {
      expect(campo(sufixo).getAttribute('aria-describedby')?.split(' ')).toContain(
        `fase-AVALIACAO-${erro}`,
      );
      expect(campo(erro).getAttribute('role')).toBe('alert');
    }
  });

  describe('escolha da regra de contagem', () => {
    const regraNoRascunho = () => store.draft().cronograma.fases[0]?.regraRecurso;

    const escolher = (codigo: string) => {
      const seletor = campo('regra') as HTMLSelectElement;
      seletor.value = codigo;
      seletor.dispatchEvent(new Event('change'));
      detectar();
    };

    it('grava a versão da regra escolhida junto com o código, e não a que a fase tinha antes', () => {
      comCronograma(faseComRegra({ regraCodigo: 'REGRA-ANTIGA', regraVersao: 'v0' }));

      escolher(REGRA.regraCodigo);

      expect(regraNoRascunho()?.regraCodigo).toBe(REGRA.regraCodigo);
      expect(regraNoRascunho()?.regraVersao).toBe('v1');
    });

    it('ao voltar para "Selecione a regra", limpa o código e a versão gravados', () => {
      escolher('');

      expect(regraNoRascunho()?.regraCodigo).toBe('');
      expect(regraNoRascunho()?.regraVersao).toBe('');
    });
  });

  it('grava em branco a unidade de suspensividade que a tela não oferece', () => {
    const suspensividade = raiz.queryAll(By.directive(PrazoDoRecursoComponent))[1];

    (suspensividade.componentInstance as PrazoDoRecursoComponent).unidadeAlterada.emit('semanas');
    detectar();

    const regra = store.draft().cronograma.fases[0]?.regraRecurso;
    expect(regra?.suspensividadePrimeiraInstanciaUnidade).toBe('');
  });

  const unidadesDe = (sufixo: string): string[] =>
    Array.from(campo(sufixo).querySelectorAll('option')).map((opcao) => opcao.value);

  it('o prazo de interposição oferece dias úteis e horas, sem dias corridos', () => {
    expect(unidadesDe('prazo-unidade')).toEqual(['', UnidadePrazo.diasUteis, UnidadePrazo.horas]);
  });

  it.each(['susp1-unidade', 'susp2-unidade'])(
    'a suspensividade %s oferece dias úteis, dias corridos e horas, sem o valor-zero do enum',
    (sufixo) => {
      expect(unidadesDe(sufixo)).toEqual([
        '',
        UnidadePrazo.diasUteis,
        UnidadePrazo.dias,
        UnidadePrazo.horas,
      ]);
    },
  );

  it('em consulta, lê a suspensividade em dias corridos com a unidade no plural', () => {
    comCronograma(
      fase({
        produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
        regraRecurso: {
          ...REGRA,
          suspensividadePrimeiraInstanciaValor: '3',
          suspensividadePrimeiraInstanciaUnidade: 'dias',
          suspensividadeSegundaInstanciaValor: '1',
          suspensividadeSegundaInstanciaUnidade: 'dias',
        } as FaseDoCronograma['regraRecurso'],
      }),
    );
    store.remoteSnapshot.set({
      status: StatusProcesso.publicado,
    } as unknown as ProcessoSeletivoDto);
    detectar();

    const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
    expect(leitura).toContain('3 dias corridos');
    expect(leitura).toContain('1 dia corrido');
  });

  describe('prazo de interposição', () => {
    const comPrazo = (prazoValor: string, prazoUnidade: string) =>
      comCronograma(
        fase({
          produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
          regraRecurso: { ...REGRA, prazoValor, prazoUnidade } as FaseDoCronograma['regraRecurso'],
        }),
      );

    const regraNoRascunho = () => store.draft().cronograma.fases[0]?.regraRecurso;
    const marcado = (sufixo: string) => campo(sufixo).getAttribute('aria-invalid');
    const problema = () => nativo.querySelector('#fase-AVALIACAO-prazo-erro');

    it('leva ao rascunho da fase o valor digitado, sem conferir nada no componente', () => {
      const entrada = campo('prazo-valor') as HTMLInputElement;

      entrada.value = '3';
      entrada.dispatchEvent(new Event('input'));
      detectar();

      expect(regraNoRascunho()?.prazoValor).toBe('3');
    });

    it('leva ao rascunho da fase a unidade escolhida', () => {
      const seletor = campo('prazo-unidade') as HTMLSelectElement;

      seletor.value = UnidadePrazo.horas;
      seletor.dispatchEvent(new Event('change'));
      detectar();

      expect(regraNoRascunho()?.prazoUnidade).toBe(UnidadePrazo.horas);
    });

    it('mantém à vista e marcada a unidade gravada que a interposição não oferece mais', () => {
      comPrazo('2', UnidadePrazo.dias);

      const seletor = campo('prazo-unidade') as HTMLSelectElement;
      expect(seletor.value).toBe(UnidadePrazo.dias);
      expect(seletor.selectedOptions[0]?.textContent).toContain('não é mais oferecida');
      expect(unidadesDe('prazo-unidade')).toEqual([
        '',
        UnidadePrazo.diasUteis,
        UnidadePrazo.horas,
        UnidadePrazo.dias,
      ]);
    });

    it.each([
      ['em branco', '', UnidadePrazo.horas],
      ['zero', '0', UnidadePrazo.horas],
      ['fracionário em dias úteis', '1,5', UnidadePrazo.diasUteis],
    ])('com o prazo %s, marca e descreve valor e unidade pelo problema do prazo', (_, v, u) => {
      comPrazo(v, u);

      expect(problema()?.getAttribute('role')).toBe('alert');
      for (const sufixo of ['prazo-valor', 'prazo-unidade']) {
        expect(marcado(sufixo)).toBe('true');
        expect(campo(sufixo).getAttribute('aria-describedby')).toContain(
          'fase-AVALIACAO-prazo-erro',
        );
      }
    });

    it('aceita o prazo fracionário em horas, sem problema', () => {
      comPrazo('1,5', UnidadePrazo.horas);

      expect(problema()).toBeNull();
      expect(marcado('prazo-valor')).toBeNull();
    });

    it('com o prazo inteiro em dias úteis, não há problema nem marca', () => {
      comPrazo('5', UnidadePrazo.diasUteis);

      expect(problema()).toBeNull();
      expect(marcado('prazo-unidade')).toBeNull();
    });
  });

  describe('procedimentos declarados do recurso', () => {
    const PROCEDIMENTO = {
      tipoDeDecisao: 'RESULTADO_PRELIMINAR',
      alvo: null,
      regraCodigo: 'PROCEDIMENTO-RECURSO-COLEGIADO',
      regraVersao: 'v1',
      sugestao: 'PROCEDIMENTO-RECURSO-MONOCRATICO',
    };

    function comProcedimento(): void {
      comCronograma(
        fase({
          produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
          regraRecurso: {
            ...REGRA,
            procedimentos: [PROCEDIMENTO],
          } as FaseDoCronograma['regraRecurso'],
        }),
      );
    }

    const lista = () => nativo.querySelector('.form-grid > sel-procedimentos-do-recurso');

    it('lista o procedimento dentro da grade do recurso, ocupando a linha inteira', () => {
      comProcedimento();

      expect(lista()?.classList.contains('form-grid__full')).toBe(true);
      expect(lista()?.textContent).toContain('RESULTADO_PRELIMINAR');
      expect(lista()?.textContent).toContain('Sugestão: PROCEDIMENTO-RECURSO-MONOCRATICO');
    });

    it('também lista o procedimento em consulta', () => {
      comProcedimento();
      store.remoteSnapshot.set({
        status: StatusProcesso.publicado,
      } as unknown as ProcessoSeletivoDto);
      detectar();

      expect(lista()?.textContent).toContain('Sugestão: PROCEDIMENTO-RECURSO-MONOCRATICO');
    });

    it('fica oculto quando o recurso não declara procedimento', () => {
      expect((lista() as HTMLElement).hidden).toBe(true);
    });
  });
});
