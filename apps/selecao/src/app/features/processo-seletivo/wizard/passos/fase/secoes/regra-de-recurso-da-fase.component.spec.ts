import type { HttpTestingController } from '@angular/common/http/testing';
import {
  EfeitoSuspensivoCodigo,
  GuardaDaVagaCodigo,
  UnidadePrazoCodigo,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import type { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { umaLeituraDoRecurso } from '../../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { fase, montarFase } from '../fase.testing';
import { faseComRegra, PREFIXO, REGRA } from './regra-de-recurso-da-fase.testing';

describe('RegraDeRecursoDaFaseComponent', () => {
  let controller: HttpTestingController;
  let nativo: HTMLElement;
  let store: ProcessoSeletivoStore;
  let detectar: () => void;
  let comCronograma: (...fases: readonly FaseDoCronograma[]) => void;

  beforeEach(async () => {
    ({ controller, nativo, comCronograma, store, detectar } = await montarFase());
    comCronograma(
      fase({
        produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
        regraRecurso: REGRA,
      }),
    );
  });

  afterEach(() => controller.verify());

  const campo = <T extends HTMLElement = HTMLElement>(sufixo: string): T =>
    nativo.querySelector<T>(`#${PREFIXO}-${sufixo}`) as T;
  const campoDaFase = (sufixo: string) =>
    nativo.querySelector<HTMLElement>(`#fase-AVALIACAO-${sufixo}`) as HTMLElement;
  const regraNoRascunho = () => store.draft().cronograma.fases[0]?.regraRecurso;
  const aviso = () => campo('aviso').textContent?.trim();
  const opcao = (grupo: 'efeito' | 'guarda', codigo: string) =>
    campo<HTMLInputElement>(`${grupo}-opcao-${codigo}`);

  const comRegra = (regra: Parameters<typeof faseComRegra>[0]) => {
    comCronograma(faseComRegra(regra));
    detectar();
  };

  it('desenha o prazo de interposição e o da 2ª instância, cada um ligado ao rótulo e à ajuda', () => {
    for (const par of ['prazo-interposicao', 'prazo-segunda']) {
      for (const parte of ['valor', 'unidade']) {
        const controle = campo(`${par}-${parte}`);
        expect(controle, `${par}-${parte}`).not.toBeNull();
        expect(nativo.querySelector(`label[for="${PREFIXO}-${par}-${parte}"]`)).not.toBeNull();
      }
    }
    expect(campo('prazo-interposicao-valor').getAttribute('aria-describedby')).toBe(
      `${PREFIXO}-prazo-interposicao-ajuda`,
    );
  });

  it('põe cada prazo num grupo nomeado pela legenda, na linha inteira da grade da regra', () => {
    const grupos = Array.from(nativo.querySelectorAll('sel-prazo-do-recurso'));

    expect(grupos.map((grupo) => grupo.querySelector('legend')?.textContent?.trim())).toEqual([
      'Prazo de interposição (obrigatório)',
      'Prazo para recorrer em 2ª instância (obrigatório)',
    ]);
    for (const grupo of grupos) {
      expect(grupo.classList).toContain('form-grid__full');
      expect(grupo.parentElement?.classList).toContain('form-grid');
    }
  });

  it('pede o prazo de interposição e o da 2ª instância como obrigatórios', () => {
    for (const sufixo of ['valor', 'unidade']) {
      expect(campo(`prazo-interposicao-${sufixo}`).getAttribute('aria-required')).toBe('true');
      expect(campo(`prazo-segunda-${sufixo}`).getAttribute('aria-required')).toBe('true');
    }
  });

  it('mostra o que a regra já traz: prazos, efeito suspensivo e guarda da vaga', () => {
    expect(campo<HTMLInputElement>('prazo-interposicao-valor').value).toBe('2');
    expect(campo<HTMLSelectElement>('prazo-interposicao-unidade').value).toBe(
      UnidadePrazoCodigo.diasUteis,
    );
    expect(campo<HTMLInputElement>('prazo-segunda-valor').value).toBe('3');
    expect(opcao('efeito', EfeitoSuspensivoCodigo.semEfeitoSuspensivo).checked).toBe(true);
    expect(opcao('guarda', GuardaDaVagaCodigo.ateOResultadoDefinitivo).checked).toBe(true);
  });

  it('oferece as unidades que a API devolve, com a opção em branco "Escolha a unidade"', () => {
    const seletor = campo<HTMLSelectElement>('prazo-interposicao-unidade');

    expect(Array.from(seletor.options).map((o) => o.value)).toEqual([
      '',
      UnidadePrazoCodigo.diasUteis,
      UnidadePrazoCodigo.horas,
    ]);
    expect(seletor.options[0]?.textContent?.trim()).toBe('Escolha a unidade');
  });

  it('mantém à vista e marcada a unidade gravada que a API não oferece, com o nome lido', () => {
    comRegra({
      prazoUnidade: UnidadePrazoCodigo.dias,
      leitura: umaLeituraDoRecurso({ rotulos: { prazoUnidade: 'Dias corridos' } }),
    });

    const seletor = campo<HTMLSelectElement>('prazo-interposicao-unidade');
    expect(seletor.value).toBe(UnidadePrazoCodigo.dias);
    expect(seletor.selectedOptions[0]?.textContent?.trim()).toBe(
      'Dias corridos — não é mais oferecida',
    );
  });

  describe('escolha da regra de contagem', () => {
    const escolher = (codigo: string) => {
      const seletor = campoDaFase('regra') as HTMLSelectElement;
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

  describe('prazo de interposição', () => {
    it('leva ao rascunho da fase o valor digitado', () => {
      const entrada = campo<HTMLInputElement>('prazo-interposicao-valor');

      entrada.value = '3';
      entrada.dispatchEvent(new Event('input'));
      detectar();

      expect(regraNoRascunho()?.prazoValor).toBe('3');
    });

    it('leva ao rascunho da fase a unidade escolhida', () => {
      const seletor = campo<HTMLSelectElement>('prazo-interposicao-unidade');

      seletor.value = UnidadePrazoCodigo.horas;
      seletor.dispatchEvent(new Event('change'));
      detectar();

      expect(regraNoRascunho()?.prazoUnidade).toBe(UnidadePrazoCodigo.horas);
    });

    it.each([
      ['zero', '0', UnidadePrazoCodigo.horas],
      ['fracionário em dias úteis', '1,5', UnidadePrazoCodigo.diasUteis],
    ])('com o prazo %s, mostra como veio e não marca erro: quem confere é a API', (_, v, u) => {
      comRegra({ prazoValor: v, prazoUnidade: u });

      expect(campo<HTMLInputElement>('prazo-interposicao-valor').value).toBe(v);
      expect(campo('prazo-interposicao-valor').hasAttribute('aria-invalid')).toBe(false);
      expect(campo('prazo-interposicao-unidade').hasAttribute('aria-invalid')).toBe(false);
    });

    it('preserva o valor lido ao mudar outro campo', () => {
      comRegra({ prazoValor: '0' });

      opcao('guarda', GuardaDaVagaCodigo.ateOResultadoDefinitivo).click();
      detectar();

      expect(regraNoRascunho()?.prazoValor).toBe('0');
    });
  });

  describe('efeito suspensivo e guarda da vaga', () => {
    it('grava o efeito escolhido', () => {
      comRegra({ efeitoSuspensivo: '' });

      opcao('efeito', EfeitoSuspensivoCodigo.semEfeitoSuspensivo).click();
      detectar();

      expect(regraNoRascunho()?.efeitoSuspensivo).toBe(EfeitoSuspensivoCodigo.semEfeitoSuspensivo);
    });

    it('com instância superior, não oferece "não guarda"', () => {
      expect(opcao('guarda', GuardaDaVagaCodigo.naoGuarda)).toBeNull();
    });

    it('sem instância superior, oferece "não guarda" e grava a escolha', () => {
      comRegra({ admiteInstanciaSuperior: false });

      opcao('guarda', GuardaDaVagaCodigo.naoGuarda).click();
      detectar();

      expect(regraNoRascunho()?.guardaDaVaga).toBe(GuardaDaVagaCodigo.naoGuarda);
    });

    it('marcar Sim com "não guarda" escolhida deixa a guarda vazia e anuncia a retirada', () => {
      comRegra({
        admiteInstanciaSuperior: false,
        guardaDaVaga: GuardaDaVagaCodigo.naoGuarda,
        prazoSegundaInstanciaValor: '',
        prazoSegundaInstanciaUnidade: '',
      });

      campo<HTMLInputElement>('superior-sim').click();
      detectar();

      expect(regraNoRascunho()?.guardaDaVaga).toBe('');
      expect(aviso()).toContain('A escolha "não guarda" foi retirada.');
    });
  });

  describe('instância superior e o prazo da 2ª instância', () => {
    it('marcar Não retira o prazo da 2ª instância e anuncia a retirada', () => {
      campo<HTMLInputElement>('superior-nao').click();
      detectar();

      expect(regraNoRascunho()).toMatchObject({
        admiteInstanciaSuperior: false,
        prazoSegundaInstanciaValor: '',
        prazoSegundaInstanciaUnidade: '',
      });
      expect(campo('prazo-segunda-valor')).toBeNull();
      expect(aviso()).toContain('O prazo da 2ª instância foi retirado');
    });

    it('marcar Sim de novo não devolve o prazo retirado', () => {
      campo<HTMLInputElement>('superior-nao').click();
      detectar();
      campo<HTMLInputElement>('superior-sim').click();
      detectar();

      expect(campo<HTMLInputElement>('prazo-segunda-valor').value).toBe('');
    });

    it('mostra, com o botão de retirar, o prazo da 2ª instância lido sem instância superior', () => {
      comRegra({
        admiteInstanciaSuperior: false,
        leitura: umaLeituraDoRecurso({ prazoDaSegundaInstanciaSemInstanciaSuperior: true }),
      });

      expect(campo<HTMLInputElement>('prazo-segunda-valor').value).toBe('3');
      campo<HTMLButtonElement>('prazo-segunda-retirar').click();
      detectar();

      expect(regraNoRascunho()?.prazoSegundaInstanciaValor).toBe('');
      expect(campo('prazo-segunda-valor')).toBeNull();
    });

    it('preserva o prazo da 2ª instância lido sem instância superior ao mudar outro campo', () => {
      comRegra({
        admiteInstanciaSuperior: false,
        leitura: umaLeituraDoRecurso({ prazoDaSegundaInstanciaSemInstanciaSuperior: true }),
      });

      campo<HTMLInputElement>('prazo-interposicao-valor').dispatchEvent(new Event('input'));
      detectar();

      expect(regraNoRascunho()?.prazoSegundaInstanciaValor).toBe('3');
    });
  });

  it('tem uma região de aviso, que só se enche quando há o que anunciar', () => {
    expect(campo('aviso').getAttribute('role')).toBe('status');
    expect(aviso()).toBe('');
  });

  describe('procedimentos declarados do recurso', () => {
    const PROCEDIMENTO = {
      tipoDeDecisao: 'RESULTADO_PRELIMINAR',
      alvo: null,
      regraCodigo: 'PROCEDIMENTO-RECURSO-COLEGIADO',
      regraVersao: 'v1',
      sugestao: 'PROCEDIMENTO-RECURSO-MONOCRATICO',
    };

    const lista = () => nativo.querySelector('.form-grid > sel-procedimentos-do-recurso');

    it('lista o procedimento dentro da grade do recurso, ocupando a linha inteira', () => {
      comRegra({ procedimentos: [PROCEDIMENTO] });

      expect(lista()?.classList.contains('form-grid__full')).toBe(true);
      expect(lista()?.textContent).toContain('Decisão que a API não descreve');
      expect(lista()?.textContent).not.toContain('RESULTADO_PRELIMINAR');
      expect(lista()?.textContent).toContain('Sugestão: PROCEDIMENTO-RECURSO-MONOCRATICO');
    });

    it('fica oculto quando o recurso não declara procedimento', () => {
      expect((lista() as HTMLElement).hidden).toBe(true);
    });
  });
});
