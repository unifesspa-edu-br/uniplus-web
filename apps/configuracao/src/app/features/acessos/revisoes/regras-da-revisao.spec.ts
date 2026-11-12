import { describe, expect, it } from 'vitest';
import type { RevisaoResumoDto } from '@uniplus/shared-data/autorizacao';
import { decideOItem, porBeneficiario, revisoesNaSituacao, type QuemLe } from './regras-da-revisao';
import {
  CONDUZIR,
  CONSULTAR,
  REVER,
  SUB_DE_QUEM_LE,
  item,
  itemDecidido,
  pessoa,
  revisao,
} from './revisao.testing';

function quemLe(...concedidas: string[]): QuemLe {
  return { sub: SUB_DE_QUEM_LE, tem: (codigo) => concedidas.includes(codigo) };
}

const DO_REPRESENTANTE = item({ decide: 'gestor-de-acessos' });

describe('quem decide o item da revisão', () => {
  it('o Representante do controlador decide o item comum', () => {
    expect(decideOItem(revisao(), item(), quemLe(CONDUZIR))).toBe(true);
  });

  it('o Representante do controlador não decide o item de quem é Representante', () => {
    expect(decideOItem(revisao(), DO_REPRESENTANTE, quemLe(CONDUZIR))).toBe(false);
  });

  it('a gestão de acessos decide o item de quem é Representante, e não o comum', () => {
    expect(decideOItem(revisao(), DO_REPRESENTANTE, quemLe(REVER))).toBe(true);
    expect(decideOItem(revisao(), item(), quemLe(REVER))).toBe(false);
  });

  it('quem só consulta não decide nenhum item', () => {
    expect(decideOItem(revisao(), item(), quemLe(CONSULTAR))).toBe(false);
    expect(decideOItem(revisao(), DO_REPRESENTANTE, quemLe(CONSULTAR))).toBe(false);
  });

  it('ninguém decide o próprio item, mesmo com as duas permissões', () => {
    const proprio = item({ beneficiario: pessoa(SUB_DE_QUEM_LE, 'Betina Neves') });
    expect(decideOItem(revisao(), proprio, quemLe(CONDUZIR, REVER))).toBe(false);
  });

  it('sem identidade de quem lê, nenhum item se decide', () => {
    expect(decideOItem(revisao(), item(), { sub: null, tem: () => true })).toBe(false);
  });

  it('item decidido ou de concessão encerrada não se decide de novo', () => {
    expect(decideOItem(revisao(), itemDecidido(), quemLe(CONDUZIR))).toBe(false);
    expect(
      decideOItem(revisao(), item({ situacao: 'concessao_encerrada' }), quemLe(CONDUZIR)),
    ).toBe(false);
  });

  it('revisão encerrada é somente leitura', () => {
    expect(decideOItem(revisao({ situacao: 'concluida' }), item(), quemLe(CONDUZIR, REVER))).toBe(
      false,
    );
  });

  it('quem decide desconhecido não abre ação', () => {
    expect(
      decideOItem(
        revisao(),
        item({ decide: 'encarregado-de-dados' }),
        quemLe(CONDUZIR, REVER, CONSULTAR),
      ),
    ).toBe(false);
  });
});

describe('itens por beneficiário', () => {
  it('agrupa pelo emissor e sub, em ordem alfabética, mantendo a ordem dos itens', () => {
    const grupos = porBeneficiario(revisao().itens);

    expect(grupos.map((g) => g.nome)).toEqual(['Betina Neves', 'Diogo Souza', 'Fernanda Drumond']);
    expect(grupos[2]?.itens.map((i) => i.id)).toEqual(['i1', 'i2']);
  });

  it('o mesmo sub em outro emissor é outra pessoa, e o sem nome aparece como não identificado', () => {
    const outra = item({
      id: 'i9',
      beneficiario: { emissor: 'outro', sub: 'sub-fernanda', nome: null },
    });
    const grupos = porBeneficiario([item(), outra]);

    expect(grupos).toHaveLength(2);
    expect(grupos.map((g) => g.nome)).toContain('Pessoa não identificada');
  });

  it('revisão sem itens não tem grupos', () => {
    expect(porBeneficiario([])).toEqual([]);
  });
});

describe('filtro da lista de revisões', () => {
  const lista = [
    { id: 'r1', situacao: 'em_andamento' },
    { id: 'r2', situacao: 'concluida' },
  ] as unknown as readonly RevisaoResumoDto[];

  it.each([
    ['todas', ['r1', 'r2']],
    ['em_andamento', ['r1']],
    ['concluida', ['r2']],
  ] as const)('%s', (filtro, ids) => {
    expect(revisoesNaSituacao(lista, filtro).map((r) => r.id)).toEqual(ids);
  });
});
