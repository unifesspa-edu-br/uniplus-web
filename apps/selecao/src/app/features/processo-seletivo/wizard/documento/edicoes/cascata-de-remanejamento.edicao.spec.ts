import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada, exemploDoContrato } from '../exemplos.testing';
import {
  declararCascataSemDestinos,
  definirCascata,
  ordensDoDocumento,
  type DestinoDoDocumento,
  type MatrizDaCascata,
} from './cascata-de-remanejamento.edicao';

const REGRA = { codigo: 'REMANEJ-X', versao: 'v1' };

function destino(origem: string, ordem: number, destinoCodigo: string): DestinoDoDocumento {
  return { modalidadeOrigemCodigo: origem, ordem, modalidadeDestinoCodigo: destinoCodigo };
}

function documentoComDestinos(destinos: readonly DestinoDoDocumento[]): DocumentoDaConfiguracao {
  return {
    ...documentoSemNada(),
    cascataRemanejamento: { regra: REGRA, fallbackCodigo: 'AC', destinos },
  };
}

function matrizDe(documento: DocumentoDaConfiguracao): MatrizDaCascata {
  return {
    fallbackCodigo: 'AC',
    ordens: ordensDoDocumento(documento.cascataRemanejamento?.destinos ?? []),
  };
}

function destinosDe(documento: DocumentoDaConfiguracao): readonly DestinoDoDocumento[] {
  return documento.cascataRemanejamento?.destinos ?? [];
}

const INTERCALADOS = [
  destino('LB_Q', 2, 'AC'),
  destino('LB_PPI', 2, 'AC'),
  destino('LB_Q', 1, 'LB_PPI'),
  destino('LB_PPI', 1, 'LB_Q'),
];

describe('edição da cascata de remanejamento', () => {
  it('matriz igual à lida do documento devolve os destinos como estavam, mesmo intercalados', () => {
    const documento = documentoComDestinos(INTERCALADOS);

    const editado = definirCascata(documento, REGRA, matrizDe(documento));

    expect(destinosDe(editado)).toStrictEqual(INTERCALADOS);
    destinosDe(editado).forEach((item, posicao) => expect(item).toBe(INTERCALADOS[posicao]));
  });

  it('não renumera a ordem que o documento traz com salto', () => {
    const comSalto = [destino('LB_PPI', 1, 'LB_Q'), destino('LB_PPI', 3, 'AC')];
    const documento = documentoComDestinos(comSalto);

    expect(destinosDe(definirCascata(documento, REGRA, matrizDe(documento)))).toStrictEqual(
      comSalto,
    );
  });

  it('editar uma origem reescreve e renumera só ela, no lugar da primeira entrada que tinha', () => {
    const documento = documentoComDestinos(INTERCALADOS);
    const matriz: MatrizDaCascata = {
      fallbackCodigo: 'AC',
      ordens: [
        { origem: 'LB_Q', destinos: ['AC', 'LB_PPI'] },
        { origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] },
      ],
    };

    const editado = definirCascata(documento, REGRA, matriz);

    expect(destinosDe(editado)).toStrictEqual([
      destino('LB_Q', 1, 'AC'),
      destino('LB_Q', 2, 'LB_PPI'),
      INTERCALADOS[1],
      INTERCALADOS[3],
    ]);
    expect(destinosDe(editado)[2]).toBe(INTERCALADOS[1]);
  });

  it('origem que sai da matriz sai do documento e a origem nova entra no fim', () => {
    const documento = documentoComDestinos(INTERCALADOS);
    const matriz: MatrizDaCascata = {
      fallbackCodigo: 'AC',
      ordens: [
        { origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] },
        { origem: 'LB_V', destinos: ['AC'] },
      ],
    };

    expect(destinosDe(definirCascata(documento, REGRA, matriz))).toStrictEqual([
      INTERCALADOS[1],
      INTERCALADOS[3],
      destino('LB_V', 1, 'AC'),
    ]);
  });

  it('esvaziar a matriz de uma cascata que tinha destinos deixa a lista vazia', () => {
    const documento = documentoComDestinos(INTERCALADOS);

    const editado = definirCascata(documento, REGRA, { fallbackCodigo: 'AC', ordens: [] });

    expect(destinosDe(editado)).toStrictEqual([]);
    expect(editado.cascataRemanejamento).toHaveProperty('destinos');
  });

  it('matriz vazia não cria a lista ausente, e só a declaração a registra vazia', () => {
    const semDestinos: DocumentoDaConfiguracao = {
      ...documentoSemNada(),
      cascataRemanejamento: { regra: REGRA },
    };

    const esvaziado = definirCascata(semDestinos, REGRA, { fallbackCodigo: '', ordens: [] });
    const declarado = declararCascataSemDestinos(semDestinos);

    expect(esvaziado.cascataRemanejamento).not.toHaveProperty('destinos');
    expect(declarado.cascataRemanejamento).toStrictEqual({ regra: REGRA, destinos: [] });
    expect(destinosDe(definirCascata(declarado, REGRA, matrizDe(declarado)))).toStrictEqual([]);
  });

  it('declara a cascata renumerando a ordem dos destinos a partir de 1 em cada origem', () => {
    const matriz: MatrizDaCascata = {
      fallbackCodigo: 'AC',
      ordens: [
        { origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] },
        { origem: 'LB_Q', destinos: ['AC'] },
      ],
    };

    const editado = definirCascata(documentoSemNada(), REGRA, matriz);

    expect(destinosDe(editado)).toEqual([
      destino('LB_PPI', 1, 'LB_Q'),
      destino('LB_PPI', 2, 'AC'),
      destino('LB_Q', 1, 'AC'),
    ]);
  });

  it('reordenar os destinos de uma origem renumera a ordem dela no documento', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const matriz: MatrizDaCascata = {
      fallbackCodigo: 'AC',
      ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
    };

    const editado = definirCascata(documento, REGRA, matriz);

    expect(destinosDe(editado).map((d) => [d.modalidadeDestinoCodigo, d.ordem])).toEqual([
      ['LB_Q', 1],
      ['AC', 2],
    ]);
  });
});
