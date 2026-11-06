import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { CaraterEtapa, UnidadePrazo } from '@uniplus/shared-data/selecao';

import type { EtapaPontuada, RecursoDaEtapa } from '../../processo-seletivo.models';
import { FORMA_HUMANA, FORMA_OBJETIVA } from '../../shared/forma-de-avaliacao';
import { etapa } from './cronograma-do-certame.testing';
import { grupoDaEtapa } from './cronograma-form';
import { etapaLida, rotuloDoPapel, type CatalogosDaLeitura } from './leitura-da-etapa';

const ATO = 'EDITAL_ABERTURA';
const BANCA = '01960000-0000-7000-0000-0000000000b1';

const catalogos = {
  rotuloDoAto: signal(new Map([[ATO, 'Edital de abertura']])),
  tipoEtapaPorId: signal(
    new Map([
      ['tipo-1', { nome: 'Prova objetiva', admitePontuacao: true, admiteEliminacao: true }],
    ]),
  ),
  bancas: signal([{ id: BANCA, nome: 'Banca de redação' }]),
} as unknown as CatalogosDaLeitura;

function lida(parcial: Partial<EtapaPontuada>) {
  return etapaLida(grupoDaEtapa(etapa(parcial)), catalogos);
}

const recurso: RecursoDaEtapa = {
  ancora: 'atoPublicado',
  regraCodigo: 'PRAZO',
  regraVersao: '1',
  prazoValor: '2',
  prazoUnidade: UnidadePrazo.diasUteis,
  atoAncoraCodigo: ATO,
  suspensividadePrimeiraInstanciaValor: '',
  suspensividadePrimeiraInstanciaUnidade: '',
  admiteInstanciaSuperior: false,
  suspensividadeSegundaInstanciaValor: '',
  suspensividadeSegundaInstanciaUnidade: '',
};

describe('papel da publicação', () => {
  it('mostra o token que a tela não conhece como veio, em vez de inventar rótulo', () => {
    expect(rotuloDoPapel('resultado_novo')).toBe('resultado_novo');
    expect(rotuloDoPapel(null)).toBe('não é resultado');
  });
});

describe('etapa lida na consulta', () => {
  it('mostra peso e nota mínima só onde o caráter os admite', () => {
    const classificatoria = lida({
      carater: CaraterEtapa.classificatoria,
      peso: '2',
      notaMinima: '5',
    });
    expect([classificatoria.peso, classificatoria.notaMinima]).toEqual(['2', null]);

    const eliminatoria = lida({ carater: CaraterEtapa.eliminatoria, peso: '2', notaMinima: '5' });
    expect([eliminatoria.peso, eliminatoria.notaMinima]).toEqual([null, '5']);
  });

  it('descreve a janela própria com travessão para a ponta que falta', () => {
    expect(lida({}).janela).toBe('');
    expect(lida({ inicio: '2026-03-01T08:00' }).janela).toBe('01/03/2026 08:00 até —');
  });

  it('não declara nota nem forma na etapa sem caráter', () => {
    const sem = lida({ carater: '' });
    expect([sem.notaMaxima, sem.formaDeAvaliacao, sem.itensDeAvaliacao]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('lê a etapa de avaliação objetiva sem consolidação nem passo', () => {
    const objetiva = lida({ notaMaxima: '10', formaDeAvaliacao: FORMA_OBJETIVA });

    expect(objetiva.notaMaxima).toBe(10);
    expect(objetiva.formaDeAvaliacao).toBe('Objetiva — gabarito ou leitora');
    expect(objetiva.regraDeConsolidacao).toBeNull();
    expect(objetiva.passoDoLancamento).toBeNull();
  });

  it('lê a avaliação humana com regra de consolidação, passo e soma dos itens', () => {
    const humana = lida({
      notaMaxima: '10',
      formaDeAvaliacao: FORMA_HUMANA,
      regraConsolidacaoCodigo: 'MEDIA',
      regraConsolidacaoVersao: '1',
      passoDoLancamento: '0,5',
      itensDeAvaliacao: [{ id: 'i1', rotulo: 'Coerência', pontuacaoMaxima: '4' }],
    });

    expect(humana.regraDeConsolidacao).toBe('MEDIA (1)');
    expect(humana.passoDoLancamento).toBe(0.5);
    expect(humana.itensDeAvaliacao).toEqual({
      linhas: ['Coerência — 4'],
      soma: 'Soma dos itens: 4 de 10',
    });
    expect(lida({ formaDeAvaliacao: FORMA_HUMANA }).regraDeConsolidacao).toBe('');
  });

  it('com escala de atendimento a banca escolhe o nível, então a etapa não tem passo', () => {
    const comEscala = lida({
      notaMaxima: '10',
      formaDeAvaliacao: FORMA_HUMANA,
      itensDeAvaliacao: [{ id: 'i1', rotulo: 'Coerência', pontuacaoMaxima: '4' }],
      escalaDeAtendimento: [{ rotulo: 'Pleno', percentual: '100' }],
    });

    expect(comEscala.escalaDeAtendimento).toEqual(['Pleno — 100%']);
    expect(comEscala.passoDoLancamento).toBeNull();
  });

  it('nomeia banca e ato pelo catálogo e mostra o id ou o código que ele não conhece', () => {
    const lidaComRefs = lida({
      emiteParecerIndividual: true,
      bancas: [BANCA, 'banca-sem-cadastro'],
      produtos: [
        { atoCodigo: ATO, papel: 'resultado_preliminar' },
        { atoCodigo: 'ATO_FORA_DO_CATALOGO', papel: null },
        { atoCodigo: '', papel: null },
      ],
    });

    expect(lidaComRefs.parecerIndividual).toBe(true);
    expect(lidaComRefs.bancas).toEqual(['Banca de redação', 'banca-sem-cadastro']);
    expect(lidaComRefs.publicacoes).toEqual([
      'Edital de abertura — resultado_preliminar',
      'ATO_FORA_DO_CATALOGO — não é resultado',
    ]);
  });

  it('lê o recurso que corre da publicação do ato, com a suspensividade das duas instâncias', () => {
    const [texto] = lida({
      recursos: [
        {
          ...recurso,
          suspensividadePrimeiraInstanciaValor: '1',
          suspensividadePrimeiraInstanciaUnidade: UnidadePrazo.horas,
          admiteInstanciaSuperior: true,
          suspensividadeSegundaInstanciaValor: '1',
          suspensividadeSegundaInstanciaUnidade: UnidadePrazo.diasUteis,
        },
      ],
    }).recursos;

    expect(texto).toBe(
      'prazo corre da publicação de Edital de abertura; prazo de 2 dias úteis; ' +
        'suspensividade da 1ª instância de 1 hora; admite instância superior; ' +
        'suspensividade da 2ª instância de 1 dia útil',
    );
  });

  it('concorda em número a unidade em horas', () => {
    const [texto] = lida({
      recursos: [{ ...recurso, prazoValor: '2', prazoUnidade: UnidadePrazo.horas }],
    }).recursos;

    expect(texto).toContain('prazo de 2 horas');
  });

  it('lê o recurso sem prazo que corre da ciência do candidato', () => {
    const [texto] = lida({
      recursos: [{ ...recurso, ancora: 'cienciaIndividual', prazoValor: '' }],
    }).recursos;

    expect(texto).toBe(
      'prazo corre da ciência do candidato; prazo não informado; não admite instância superior',
    );
  });
});
