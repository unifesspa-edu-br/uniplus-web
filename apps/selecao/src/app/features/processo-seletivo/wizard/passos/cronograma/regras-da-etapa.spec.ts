import { describe, expect, it } from 'vitest';
import { CaraterEtapa } from '@uniplus/shared-data/selecao';
import {
  declaraNotaDoEnem,
  componeNota,
  etapaComOQueDeclara,
  nomeDoTipoDaEtapa,
} from './regras-da-etapa';
import { tipoQueAdmiteTudo, tipoDoEnem, etapa } from './cronograma-do-certame.testing';

describe('etapa que compõe a nota', () => {
  /**
   * Havendo etapas, ao menos uma precisa pontuar COM peso — senão o divisor da
   * média seria zero. Uma prova de títulos sozinha, eliminatória e sem peso, é
   * recusada, e a mensagem do domínio fala de nota final, não de etapa.
   */
  it('exige caráter que pontua e peso declarado', () => {
    expect(componeNota(etapa({ carater: CaraterEtapa.classificatoria, peso: '2' }))).toBe(true);
    expect(componeNota(etapa({ carater: CaraterEtapa.ambas, peso: '1' }))).toBe(true);
    expect(componeNota(etapa({ carater: CaraterEtapa.eliminatoria, peso: '2' }))).toBe(false);
    expect(componeNota(etapa({ carater: CaraterEtapa.classificatoria, peso: '' }))).toBe(false);
    expect(componeNota(etapa({ carater: CaraterEtapa.classificatoria, peso: '   ' }))).toBe(false);
  });

  /**
   * Peso zero não soma ao divisor, e o domínio o recusa à parte por exigir peso
   * maior que zero. Aceitá-lo aqui deixaria um conjunto todo zerado passar na
   * conferência da tela e ser recusado no servidor por outro motivo.
   */
  it('não considera peso zero como composição de nota', () => {
    expect(componeNota(etapa({ carater: CaraterEtapa.classificatoria, peso: '0' }))).toBe(false);
    expect(componeNota(etapa({ carater: CaraterEtapa.ambas, peso: '0,0' }))).toBe(false);
  });
});

describe('o que a etapa declara', () => {
  const humana = etapa({
    nome: 'Redação',
    carater: CaraterEtapa.classificatoria,
    tipoEtapaOrigemId: 'tipo-1',
    notaMaxima: '10',
    passoDoLancamento: '0,5',
    formaDeAvaliacao: 'HUMANA',
    regraConsolidacaoCodigo: 'CONSOLIDACAO-AVALIACAO-UNICA',
    regraConsolidacaoVersao: 'v1',
  });

  it('mantém regra e passo na forma humana', () => {
    expect(etapaComOQueDeclara(humana, undefined)).toMatchObject({
      passoDoLancamento: '0,5',
      regraConsolidacaoCodigo: 'CONSOLIDACAO-AVALIACAO-UNICA',
    });
  });

  it('descarta regra e passo quando a forma é objetiva', () => {
    expect(
      etapaComOQueDeclara({ ...humana, formaDeAvaliacao: 'OBJETIVA' }, undefined),
    ).toMatchObject({
      notaMaxima: '10',
      formaDeAvaliacao: 'OBJETIVA',
      passoDoLancamento: '',
      regraConsolidacaoCodigo: '',
      regraConsolidacaoVersao: '',
    });
  });

  it('descarta a avaliação inteira quando a etapa não tem nota', () => {
    expect(etapaComOQueDeclara({ ...humana, carater: '' }, undefined)).toMatchObject({
      notaMaxima: '',
      formaDeAvaliacao: '',
      passoDoLancamento: '',
      regraConsolidacaoCodigo: '',
    });
  });
});

describe('etapa de nota do ENEM', () => {
  it('reconhece a etapa pelo atributo do tipo no cadastro', () => {
    expect(declaraNotaDoEnem(etapa({}), tipoDoEnem())).toBe(true);
    expect(declaraNotaDoEnem(etapa({}), tipoQueAdmiteTudo())).toBe(false);
  });

  it('na etapa gravada vale o que o processo congelou, enquanto o tipo é o mesmo', () => {
    const gravada = etapa({
      tipoCongelado: { origemId: 'tipo-1', nome: 'Prova objetiva', notaDeOrigemNoEnem: true },
    });
    expect(declaraNotaDoEnem(gravada, tipoQueAdmiteTudo())).toBe(true);
  });

  it('trocar o tipo desfaz o congelado, e vale o cadastro do tipo novo', () => {
    const trocada = etapa({
      tipoEtapaOrigemId: 'tipo-2',
      tipoCongelado: { origemId: 'tipo-1', nome: 'Prova objetiva', notaDeOrigemNoEnem: true },
    });
    expect(declaraNotaDoEnem(trocada, tipoQueAdmiteTudo())).toBe(false);
  });
});

describe('nome do tipo da etapa', () => {
  const congelado = { origemId: 'tipo-1', nome: 'Prova', notaDeOrigemNoEnem: false };

  it('vem da cópia que o processo congelou, também depois de o tipo sair do cadastro', () => {
    const gravada = etapa({ tipoCongelado: congelado });
    expect(nomeDoTipoDaEtapa(gravada, undefined)).toBe('Prova (removido do cadastro)');
  });

  it('na etapa gravada com o tipo no cadastro vale o nome congelado, sem situação', () => {
    const gravada = etapa({ tipoCongelado: congelado });
    expect(nomeDoTipoDaEtapa(gravada, tipoQueAdmiteTudo())).toBe('Prova');
  });

  it('trocar o tipo desfaz o congelado, e vale o nome do cadastro do tipo novo', () => {
    const trocada = etapa({ tipoEtapaOrigemId: 'tipo-2', tipoCongelado: congelado });
    expect(nomeDoTipoDaEtapa(trocada, tipoQueAdmiteTudo())).toBe(tipoQueAdmiteTudo().nome);
  });
});
