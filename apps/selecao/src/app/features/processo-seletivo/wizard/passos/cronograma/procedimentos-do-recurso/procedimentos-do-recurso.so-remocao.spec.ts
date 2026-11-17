import { describe, expect, it } from 'vitest';

import {
  escolher,
  HOMOLOGACAO,
  MONOCRATICO,
  montarEdicao,
  NOTA,
  seletorDa,
} from './procedimentos-do-recurso.edicao.testing';
import { procedimentoDoDocumento as procedimento } from './procedimentos.testing';

const ITEM_1 = { itemDeAvaliacaoChave: 'item-1' };
const ITEM_PERDIDO = { itemDeAvaliacaoChave: 'item-3' };
const ITENS = [{ chave: 'item-1', rotulo: 'Coerência', pontuacaoMaxima: 5 }];
const daNota = (parcial = {}) => procedimento({ tipoDeDecisao: NOTA, ...parcial });

const removerDaLinha = (seletor: HTMLSelectElement) =>
  seletor.closest('.escolha')?.querySelector('button') as HTMLButtonElement;
const descricaoDe = (seletor: HTMLSelectElement) =>
  (seletor.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? '');

describe('ProcedimentosDoRecursoComponent em edição: a linha que só se remove', () => {
  const comItemPerdido = {
    tiposDeclarados: [NOTA],
    itensDaEtapa: ITENS,
    procedimentos: [daNota({ alvo: ITEM_1 }), daNota({ alvo: ITEM_PERDIDO })],
  };
  const comTipoNaoDeclarado = {
    tiposDeclarados: [HOMOLOGACAO],
    procedimentos: [daNota()],
  };

  it('não troca a regra do procedimento que o lugar deixou de oferecer, e ainda o remove', async () => {
    const { raiz, eventos } = await montarEdicao(comItemPerdido);
    const seletor = seletorDa(raiz, NOTA, 1);

    escolher(seletor, MONOCRATICO);
    removerDaLinha(seletor).click();

    expect(seletor.disabled).toBe(true);
    expect(removerDaLinha(seletor).disabled).toBe(false);
    expect(eventos.trocarRegra).not.toHaveBeenCalled();
    expect(eventos.remover).toHaveBeenCalledExactlyOnceWith({
      tipoDeDecisao: NOTA,
      alvo: ITEM_PERDIDO,
    });
  });

  it('não troca a regra do procedimento de um tipo que o lugar deixou de declarar, e ainda o remove', async () => {
    const { raiz, eventos } = await montarEdicao(comTipoNaoDeclarado);
    const seletor = seletorDa(raiz, NOTA, 0);

    escolher(seletor, MONOCRATICO);
    removerDaLinha(seletor).click();

    expect(seletor.disabled).toBe(true);
    expect(removerDaLinha(seletor).disabled).toBe(false);
    expect(eventos.trocarRegra).not.toHaveBeenCalled();
    expect(eventos.remover).toHaveBeenCalledExactlyOnceWith({ tipoDeDecisao: NOTA, alvo: null });
  });

  it('mantém o seletor das linhas oferecidas habilitado ao lado da que só se remove', async () => {
    const { raiz, eventos } = await montarEdicao(comItemPerdido);

    escolher(seletorDa(raiz, NOTA, 0), MONOCRATICO);

    expect(seletorDa(raiz, NOTA, 0).disabled).toBe(false);
    expect(eventos.trocarRegra).toHaveBeenCalledOnce();
  });

  it('liga o seletor desabilitado à explicação de que o item deixou de existir', async () => {
    const { raiz } = await montarEdicao(comItemPerdido);

    expect(descricaoDe(seletorDa(raiz, NOTA, 1)).join(' ')).toContain(
      'O item contestado não existe mais nesta etapa. Remova o procedimento.',
    );
  });

  it('liga o seletor parado ao aviso do tipo que o lugar deixou de declarar', async () => {
    const { raiz } = await montarEdicao(comTipoNaoDeclarado);

    expect(descricaoDe(seletorDa(raiz, NOTA, 0)).join(' ')).toContain(
      'não está mais na lista de decisões',
    );
  });

  it('desabilita também a remoção quando a edição está bloqueada', async () => {
    const { raiz } = await montarEdicao({ ...comTipoNaoDeclarado, modo: 'bloqueado' });

    expect(removerDaLinha(seletorDa(raiz, NOTA, 0)).disabled).toBe(true);
  });

  it('permite remover sem janela, sem oferecer novas escolhas', async () => {
    const { raiz, eventos } = await montarEdicao({
      temJanela: false,
      tiposDeclarados: [NOTA, HOMOLOGACAO],
      procedimentos: [daNota()],
    });
    const seletor = seletorDa(raiz, NOTA, 0);
    expect(raiz.querySelectorAll('select')).toHaveLength(1);
    expect(raiz.querySelectorAll('input[type=radio]')).toHaveLength(0);
    expect(seletor.disabled).toBe(true);
    removerDaLinha(seletor).click();
    expect(eventos.remover).toHaveBeenCalledExactlyOnceWith({ tipoDeDecisao: NOTA, alvo: null });
    expect(eventos.declarar).not.toHaveBeenCalled();
    expect(eventos.trocarRegra).not.toHaveBeenCalled();
  });

  it('orienta e remove individualmente uma repetição importada', async () => {
    const declarado = daNota({ alvo: ITEM_1 });
    const { raiz, eventos } = await montarEdicao({
      tiposDeclarados: [NOTA],
      itensDaEtapa: ITENS,
      procedimentos: [declarado, declarado],
    });
    const repetido = seletorDa(raiz, NOTA, 1);
    expect(descricaoDe(repetido).join(' ')).toContain(
      'está repetido para a mesma decisão e mesmo item contestado',
    );
    expect(descricaoDe(repetido).join(' ')).not.toContain('não corresponde');
    removerDaLinha(repetido).click();
    expect(eventos.remover).toHaveBeenCalledExactlyOnceWith({
      tipoDeDecisao: NOTA,
      alvo: ITEM_1,
      ocorrencia: 1,
    });
  });
});

describe.each(['edicao', 'consulta', 'bloqueado'] as const)('explicações em %s', (modo) => {
  it.each([false, true])(
    'explica o conflito com a decisão inteira primeiro: %s',
    async (inteiroPrimeiro) => {
      const inteiro = daNota();
      const porItem = daNota({ alvo: ITEM_1 });
      const { raiz } = await montarEdicao({
        modo,
        tiposDeclarados: [NOTA],
        itensDaEtapa: ITENS,
        procedimentos: inteiroPrimeiro ? [inteiro, porItem] : [porItem, inteiro],
      });
      expect(raiz.textContent?.replace(/\s+/g, ' ')).toContain(
        'Há um procedimento para a decisão inteira e procedimentos por item contestado. Mantenha o procedimento da decisão inteira ou os procedimentos por item e remova os demais.',
      );
      expect(raiz.textContent).not.toContain('não existe mais');
    },
  );

  it('explica que o item deixou de existir', async () => {
    const { raiz } = await montarEdicao({
      modo,
      tiposDeclarados: [NOTA],
      itensDaEtapa: ITENS,
      procedimentos: [daNota({ alvo: ITEM_PERDIDO })],
    });
    expect(raiz.textContent?.replace(/\s+/g, ' ')).toContain(
      'O item contestado não existe mais nesta etapa. Remova o procedimento.',
    );
    expect(raiz.textContent).not.toContain('Há um procedimento para a decisão inteira');
  });
});
