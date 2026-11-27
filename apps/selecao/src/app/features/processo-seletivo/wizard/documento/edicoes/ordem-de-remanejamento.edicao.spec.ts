import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada, exemploDoContrato } from '../exemplos.testing';
import {
  declararOrdemDeRemanejamentoSemDestinos,
  definirOrdemDeRemanejamento,
  ordensDoDocumento,
  type DestinoDoDocumento,
  type MatrizDaOrdemDeRemanejamento,
} from './ordem-de-remanejamento.edicao';

const REGRA = { codigo: 'REMANEJ-X', versao: 'v1' };

function destino(origem: string, destinoCodigo: string): DestinoDoDocumento {
  return { modalidadeOrigemCodigo: origem, modalidadeDestinoCodigo: destinoCodigo };
}

function documentoComDestinos(destinos: readonly DestinoDoDocumento[]): DocumentoDaConfiguracao {
  return {
    ...documentoSemNada(),
    ordemDeRemanejamento: { regra: REGRA, destinoFinalCodigo: 'AC', destinos },
  };
}

function matrizDe(documento: DocumentoDaConfiguracao): MatrizDaOrdemDeRemanejamento {
  return {
    fallbackCodigo: 'AC',
    ordens: ordensDoDocumento(documento.ordemDeRemanejamento?.destinos ?? []),
  };
}

function destinosDe(documento: DocumentoDaConfiguracao): readonly DestinoDoDocumento[] {
  return documento.ordemDeRemanejamento?.destinos ?? [];
}

const INTERCALADOS = [
  destino('LB_Q', 'AC'),
  destino('LB_PPI', 'AC'),
  destino('LB_Q', 'LB_PPI'),
  destino('LB_PPI', 'LB_Q'),
];

describe('edição da ordem de remanejamento', () => {
  it('matriz igual à lida do documento devolve os destinos como estavam, mesmo intercalados', () => {
    const documento = documentoComDestinos(INTERCALADOS);

    const editado = definirOrdemDeRemanejamento(documento, REGRA, matrizDe(documento));

    expect(destinosDe(editado)).toStrictEqual(INTERCALADOS);
    destinosDe(editado).forEach((item, posicao) => expect(item).toBe(INTERCALADOS[posicao]));
  });

  it('editar uma origem reescreve só ela, no lugar da primeira entrada que tinha', () => {
    const documento = documentoComDestinos(INTERCALADOS);
    const matriz: MatrizDaOrdemDeRemanejamento = {
      fallbackCodigo: 'AC',
      ordens: [
        { origem: 'LB_Q', destinos: ['LB_PPI', 'AC'] },
        { origem: 'LB_PPI', destinos: ['AC', 'LB_Q'] },
      ],
    };

    const editado = definirOrdemDeRemanejamento(documento, REGRA, matriz);

    expect(destinosDe(editado)).toStrictEqual([
      destino('LB_Q', 'LB_PPI'),
      destino('LB_Q', 'AC'),
      INTERCALADOS[1],
      INTERCALADOS[3],
    ]);
    expect(destinosDe(editado)[2]).toBe(INTERCALADOS[1]);
  });

  it('origem que sai da matriz sai do documento e a origem nova entra no fim', () => {
    const documento = documentoComDestinos(INTERCALADOS);
    const matriz: MatrizDaOrdemDeRemanejamento = {
      fallbackCodigo: 'AC',
      ordens: [
        { origem: 'LB_PPI', destinos: ['AC', 'LB_Q'] },
        { origem: 'LB_V', destinos: ['AC'] },
      ],
    };

    expect(destinosDe(definirOrdemDeRemanejamento(documento, REGRA, matriz))).toStrictEqual([
      INTERCALADOS[1],
      INTERCALADOS[3],
      destino('LB_V', 'AC'),
    ]);
  });

  it('esvaziar a matriz de uma ordem de remanejamento que tinha destinos deixa a lista vazia', () => {
    const documento = documentoComDestinos(INTERCALADOS);

    const editado = definirOrdemDeRemanejamento(documento, REGRA, {
      fallbackCodigo: 'AC',
      ordens: [],
    });

    expect(destinosDe(editado)).toStrictEqual([]);
    expect(editado.ordemDeRemanejamento).toHaveProperty('destinos');
  });

  it('matriz vazia não cria a lista ausente, e só a declaração a registra vazia', () => {
    const semDestinos: DocumentoDaConfiguracao = {
      ...documentoSemNada(),
      ordemDeRemanejamento: { regra: REGRA },
    };

    const esvaziado = definirOrdemDeRemanejamento(semDestinos, REGRA, {
      fallbackCodigo: '',
      ordens: [],
    });
    const declarado = declararOrdemDeRemanejamentoSemDestinos(semDestinos);

    expect(esvaziado.ordemDeRemanejamento).not.toHaveProperty('destinos');
    expect(declarado.ordemDeRemanejamento).toStrictEqual({ regra: REGRA, destinos: [] });
    expect(
      destinosDe(definirOrdemDeRemanejamento(declarado, REGRA, matrizDe(declarado))),
    ).toStrictEqual([]);
  });

  it('declara a ordem de remanejamento com os destinos de cada origem na ordem da matriz', () => {
    const matriz: MatrizDaOrdemDeRemanejamento = {
      fallbackCodigo: 'AC',
      ordens: [
        { origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] },
        { origem: 'LB_Q', destinos: ['AC'] },
      ],
    };

    const editado = definirOrdemDeRemanejamento(documentoSemNada(), REGRA, matriz);

    expect(destinosDe(editado)).toEqual([
      destino('LB_PPI', 'LB_Q'),
      destino('LB_PPI', 'AC'),
      destino('LB_Q', 'AC'),
    ]);
  });

  it('reordenar os destinos de uma origem reordena os dela no documento', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const matriz: MatrizDaOrdemDeRemanejamento = {
      fallbackCodigo: 'AC',
      ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
    };

    const editado = definirOrdemDeRemanejamento(documento, REGRA, matriz);

    expect(destinosDe(editado).map((d) => d.modalidadeDestinoCodigo)).toEqual(['LB_Q', 'AC']);
  });
});
