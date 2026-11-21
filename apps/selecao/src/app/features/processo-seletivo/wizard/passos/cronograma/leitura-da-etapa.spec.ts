import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { CaraterEtapa, UnidadePrazoCodigo } from '@uniplus/shared-data/selecao';

import type { EtapaPontuada, RecursoDaEtapa } from '../../processo-seletivo.models';
import {
  PARAMETROS_SEM_INSTANCIA_SUPERIOR,
  umaLeituraDoRecurso,
} from '../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { PARAMETROS_EM_BRANCO } from '../../shared/configuracao-do-recurso/parametros-do-recurso';
import { COLEGIADA } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { FORMA_HUMANA, FORMA_OBJETIVA } from '../../shared/forma-de-avaliacao';
import { etapa } from './cronograma-do-certame.testing';
import { grupoDaEtapa } from './cronograma-form';
import { rotuloDaApi } from '../../shared/decisoes-da-fase-ou-etapa/tipos-de-decisao-da-api.testing';
import { etapaLida, rotuloDoPapel, type CatalogosDaLeitura } from './leitura-da-etapa';

const ATO = 'EDITAL_ABERTURA';
const BANCA = '01960000-0000-7000-0000-0000000000b1';

const catalogos = {
  rotuloDoAto: signal(new Map([[ATO, 'Edital de abertura']])),
  tipoEtapaPorId: signal(
    new Map([
      [
        'tipo-1',
        {
          nome: 'Prova objetiva',
          avaliacao: { admitePontuacao: true, admiteEliminacao: true, notaDeOrigemNoEnem: false },
        },
      ],
    ]),
  ),
  bancas: signal([{ id: BANCA, nome: 'Banca de redação' }]),
  rotuloDoTipoDeDecisao: signal(rotuloDaApi),
} as unknown as CatalogosDaLeitura;

function lida(parcial: Partial<EtapaPontuada>) {
  return etapaLida(grupoDaEtapa(etapa(parcial)), catalogos);
}

const recurso: RecursoDaEtapa = {
  ancora: 'atoPublicado',
  regraCodigo: 'PRAZO',
  regraVersao: '1',
  ...PARAMETROS_SEM_INSTANCIA_SUPERIOR,
  atoAncoraCodigo: ATO,
  leitura: umaLeituraDoRecurso({
    rotulos: {
      prazoUnidade: 'Dias úteis',
      prazoSegundaInstanciaUnidade: 'Dias úteis',
      efeitoSuspensivo: 'Sem efeito suspensivo',
      guardaDaVaga: 'Guarda a vaga até o resultado definitivo',
    },
  }),
  procedimentos: [],
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
      bancas: [
        { tipoBancaId: BANCA, regraDeDeliberacao: null },
        { tipoBancaId: 'banca-sem-cadastro', regraDeDeliberacao: null },
      ],
      produtos: [
        { atoCodigo: ATO, papel: 'resultado_preliminar' },
        { atoCodigo: 'ATO_FORA_DO_CATALOGO', papel: null },
        { atoCodigo: '', papel: null },
      ],
    });

    expect(lidaComRefs.parecerIndividual).toBe(true);
    expect(lidaComRefs.bancas).toEqual([
      'Banca de redação — Sem regra de deliberação declarada',
      'banca-sem-cadastro — Sem regra de deliberação declarada',
    ]);
    expect(lidaComRefs.publicacoes).toEqual([
      'Edital de abertura — resultado_preliminar',
      'ATO_FORA_DO_CATALOGO — não é resultado',
    ]);
  });

  it('lê os tipos de decisão da etapa pelo nome e mantém o código que o vocabulário não conhece', () => {
    expect(lida({ tiposDeDecisao: ['CLASSIFICACAO', 'TIPO_DO_FUTURO'] }).tiposDeDecisao).toEqual([
      'Classificação',
      'TIPO_DO_FUTURO',
    ]);
    expect(lida({ tiposDeDecisao: [] }).tiposDeDecisao).toEqual([]);
  });

  it('lê o recurso que corre da publicação do ato, com os parâmetros pelo nome que a API deu', () => {
    const [texto] = lida({
      recursos: [
        {
          ...recurso,
          admiteInstanciaSuperior: true,
          prazoSegundaInstanciaValor: '3',
          prazoSegundaInstanciaUnidade: UnidadePrazoCodigo.diasUteis,
        },
      ],
    }).recursos;

    expect(texto).toBe(
      'prazo corre da publicação de Edital de abertura; prazo de interposição: 2 — Dias úteis; ' +
        'efeito suspensivo: Sem efeito suspensivo; ' +
        'guarda da vaga: Guarda a vaga até o resultado definitivo; admite instância superior; ' +
        'prazo da 2ª instância: 3 — Dias úteis',
    );
  });

  it('mostra o código quando a leitura não trouxe o nome da unidade', () => {
    const [texto] = lida({
      recursos: [
        { ...recurso, leitura: umaLeituraDoRecurso(), prazoUnidade: UnidadePrazoCodigo.horas },
      ],
    }).recursos;

    expect(texto).toContain('prazo de interposição: 2 — horas');
  });

  it('lê o prazo da 2ª instância que veio sem instância superior', () => {
    const [texto] = lida({
      recursos: [
        {
          ...recurso,
          prazoSegundaInstanciaValor: '3',
          prazoSegundaInstanciaUnidade: UnidadePrazoCodigo.diasUteis,
        },
      ],
    }).recursos;

    expect(texto).toContain('não admite instância superior; prazo da 2ª instância: 3 — Dias úteis');
  });

  it('não lê efeito nem guarda que o recurso não declara', () => {
    const [texto] = lida({
      recursos: [
        { ...recurso, efeitoSuspensivo: '', guardaDaVaga: '', leitura: umaLeituraDoRecurso() },
      ],
    }).recursos;

    expect(texto).not.toContain('efeito suspensivo');
    expect(texto).not.toContain('guarda da vaga');
  });

  it('lê o recurso sem prazo que corre da ciência do candidato', () => {
    const [texto] = lida({
      recursos: [
        {
          ...recurso,
          ...PARAMETROS_EM_BRANCO,
          admiteInstanciaSuperior: false,
          leitura: umaLeituraDoRecurso(),
          ancora: 'cienciaIndividual',
        },
      ],
    }).recursos;

    expect(texto).toBe(
      'prazo corre da ciência do candidato; prazo não informado; não admite instância superior',
    );
  });

  it('lê a regra de deliberação da banca ao lado do nome dela', () => {
    const { bancas } = lida({ bancas: [{ tipoBancaId: BANCA, regraDeDeliberacao: COLEGIADA }] });

    expect(bancas).toEqual([
      'Banca de redação — 5 titulares, 2 suplentes; quórum 3; maioria simples; ' +
        'encerra: a presidência encerra ao atingir o quórum; desempate: voto da presidência',
    ]);
  });
});
