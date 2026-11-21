import { describe, expect, it } from 'vitest';
import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { definirCondicoesDeAtendimento } from './atendimento.edicao';
import { comBasesLegais, comFormatosPermitidos } from './condicoes-da-exigencia.edicao';
import {
  acrescentarItemDeAvaliacao,
  acrescentarNivelDeAtendimento,
} from './avaliacao-da-etapa.edicao';
import { instanteEmUtc } from '../instante-em-utc';

const DOCUMENTO_COM_CHAVES_REPETIDAS: DocumentoDaConfiguracao = {
  formato: 'uniplus.selecao.configuracao',
  versaoFormato: 1,
  etapas: [{ chave: 'x' }, { chave: 'x' }],
  cronograma: {
    fases: [
      { chave: 'x', faseCanonicaCodigo: 'INSCRICOES', noMesmoMomentoDaAnterior: false },
      { chave: 'x', faseCanonicaCodigo: 'INSCRICOES', noMesmoMomentoDaAnterior: false },
    ],
  },
};
const RESERVAS = { original: DOCUMENTO_COM_CHAVES_REPETIDAS, criadas: [] };

describe('regressões de origem e calendário', () => {
  it('mantém a ocorrência editada para código já presente', () => {
    const documento: DocumentoDaConfiguracao = {
      formato: 'uniplus.selecao.configuracao',
      versaoFormato: 1,
      atendimento: { condicoes: [{ condicaoCodigo: 'A' }, { condicaoCodigo: 'B' }] },
    };
    expect(
      definirCondicoesDeAtendimento(documento, [
        { codigo: 'A', origem: 0 },
        { codigo: 'A', origem: 1 },
      ]).atendimento?.condicoes,
    ).toEqual([{ condicaoCodigo: 'A' }, { condicaoCodigo: 'A' }]);
  });
  it('preserva a origem da base removida', () => {
    const bases = [{ referencia: ' A ' }, { referencia: ' B ' }];
    expect(
      comBasesLegais({ basesLegais: bases }, [
        { origem: 1, referencia: 'B', abrangencia: '', status: '', observacao: '' },
      ]).basesLegais,
    ).toEqual([bases[1]]);
  });
  it('preserva a origem dos formatos movidos', () => {
    const formatosPermitidos = {
      lista: [{ tamanhoMaximoBytesMax: 5 }, { tamanhoMaximoBytesMax: 10 }],
    };
    expect(
      comFormatosPermitidos(
        { chave: 'x', formatosPermitidos },
        { qualquer: null, lista: [{ origem: 1, formato: '', tamanhoMaximoBytesMax: '10' }] },
      ).formatosPermitidos?.lista?.[0],
    ).toBe(formatosPermitidos.lista[1]);
  });
  it('acrescenta item e nível na etapa escolhida', () => {
    const lugar = { chave: 'x', ocorrencia: 1 };
    const item = acrescentarItemDeAvaliacao(
      DOCUMENTO_COM_CHAVES_REPETIDAS,
      lugar,
      'Item',
      RESERVAS,
    );
    const nivel = acrescentarNivelDeAtendimento(item, lugar, 'Nível', RESERVAS);
    expect(nivel.etapas?.[0]).toEqual({ chave: 'x' });
    expect(nivel.etapas?.[1].itensDeAvaliacao).toHaveLength(1);
    expect(nivel.etapas?.[1].escalaDeAtendimento).toHaveLength(1);
  });
  it.each([
    '2026-02-31T10:00',
    '2025-02-29T10:00',
    '2026-04-31T10:00',
    '2026-01-01T24:00',
    '2026-01-01T10:60',
    '2026-01-01T10:00:60',
  ])('recusa data inexistente %s', (valor) => {
    expect(instanteEmUtc(valor)).toBeUndefined();
  });
  it('aceita dia bissexto e segundos válidos', () => {
    expect(instanteEmUtc('2024-02-29T10:30:45')).toBe('2024-02-29T13:30:45Z');
  });
});
