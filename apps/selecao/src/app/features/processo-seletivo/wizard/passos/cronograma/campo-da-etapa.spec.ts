import { CaraterEtapa } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { umaLeituraDoRecurso } from '../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { umaEtapaDoCronograma, umRecursoDaEtapa } from '../../shared/etapa-do-cronograma.testing';
import { localDaRecusa } from '../../shared/recusas/local-da-recusa';
import { campoDaRecusaDaEtapa, campoNaTelaDaEtapa, NO_TOPO_DA_ETAPA } from './campo-da-etapa';

const campoDe = (field: string) => {
  const local = localDaRecusa(field);
  return local === null ? null : campoDaRecusaDaEtapa(local);
};

describe('campoDaRecusaDaEtapa', () => {
  it.each([
    ['etapas[0].notaMinima', 'notaMinima'],
    ['etapas[0].notaMaxima', 'notaMaxima'],
    ['etapas[0].passoDoLancamento', 'passoDoLancamento'],
    ['etapas[0].formaDeAvaliacao', 'formaDeAvaliacao'],
    ['etapas[0].regraConsolidacao', 'regraConsolidacao'],
    ['etapas[0].regraConsolidacaoVersao', 'regraConsolidacao'],
    ['etapas[0].itensDeAvaliacao', 'itensDeAvaliacao'],
    ['etapas[0].escalaDeAtendimento', 'escalaDeAtendimento'],
  ])('leva %s ao campo %s', (field, campo) => {
    expect(campoDe(field)).toBe(campo);
  });

  it.each([
    ['etapas[0].itensDeAvaliacao[2].rotulo', 'itensDeAvaliacao.2.rotulo'],
    ['etapas[0].itensDeAvaliacao[0].pontuacaoMaxima', 'itensDeAvaliacao.0.pontuacaoMaxima'],
    ['etapas[0].escalaDeAtendimento[1].fracao', 'escalaDeAtendimento.1.fracao'],
    ['etapas[0].escalaDeAtendimento[1].rotulo', 'escalaDeAtendimento.1.rotulo'],
  ])('leva o item %s à chave %s', (field, campo) => {
    expect(campoDe(field)).toBe(campo);
  });

  it.each([
    'etapas[0].itensDeAvaliacao[2].id',
    'etapas[0].itensDeAvaliacao[2]',
    'etapas[0].escalaDeAtendimento[3]',
  ])('deixa na lista o caminho %s, que não tem controle próprio', (field) => {
    expect(['itensDeAvaliacao', 'escalaDeAtendimento']).toContain(campoDe(field));
  });

  it.each([
    'etapas[0].bancas[1]',
    'etapas[0].bancas[0].regraDeDeliberacao.quorum',
    'etapas[0].bancas[0].tipoBancaId',
  ])('reúne sob as bancas o caminho %s', (field) => {
    expect(campoDe(field)).toBe('bancas');
  });

  it.each([
    ['etapas[1].recursos[0].prazoValor', 'recursos.0.prazoValor'],
    ['etapas[1].recursos[2].prazoUnidade', 'recursos.2.prazoUnidade'],
    ['etapas[1].recursos[0].ancora', 'recursos.0.origemDoPrazo'],
    ['etapas[1].recursos[0].atoAncoraCodigo', 'recursos.0.ancora'],
    ['etapas[1].recursos[0].admiteInstanciaSuperior', 'recursos.0.admiteInstanciaSuperior'],
    ['etapas[1].recursos[3].efeitoSuspensivo', 'recursos.3.efeitoSuspensivo'],
    ['etapas[1].recursos[3].guardaDaVaga', 'recursos.3.guardaDaVaga'],
    ['etapas[1].recursos[3].prazoSegundaInstanciaValor', 'recursos.3.prazoSegundaInstanciaValor'],
    [
      'etapas[1].recursos[3].prazoSegundaInstanciaUnidade',
      'recursos.3.prazoSegundaInstanciaUnidade',
    ],
  ])('leva %s ao controle %s, sem juntar valor e unidade', (field, campo) => {
    expect(campoDe(field)).toBe(campo);
  });

  it.each([
    'etapas[0].recursos[0]',
    'etapas[0].recursos[0].regraCodigo',
    'etapas[0].recursos[0].procedimentos[0].regra.codigo',
  ])('deixa no recurso o caminho %s, que não tem controle próprio', (field) => {
    expect(campoDe(field)).toBe('recursos.0.recurso');
  });

  it.each([
    'etapas[0]',
    'etapas[0].nome',
    'etapas[0].produtos[0]',
    'etapas[0].tiposDeDecisao[1]',
    'etapas[0].recursos',
  ])('deixa no topo da etapa o caminho %s, que a etapa conhece sem controle de recusa', (field) => {
    expect(campoDe(field)).toBe(NO_TOPO_DA_ETAPA);
  });

  it.each([
    'etapas[0].id',
    'etapas[0].campoQueNaoExiste',
    'etapas[0].bancas[x]',
    'etapas[0].recursos[1].campoQueNaoExiste',
    'etapas[0].recursos[1].id',
  ])('não dá lugar ao caminho %s: a etapa não o conhece e a recusa vai ao resumo', (field) => {
    expect(campoDe(field)).toBeNull();
  });

  it.each([
    ['bancas.banca-1', 'bancas.banca-1'],
    ['bancas.banca-1.tipoBancaId', 'bancas.banca-1'],
    ['bancas.banca-1.regraDeDeliberacao.quorum', 'bancas.banca-1.quorum'],
    ['bancas.banca-1.regraDeDeliberacao.encerramento', 'bancas.banca-1.encerramento'],
    ['bancas.banca-1.regraDeDeliberacao', 'bancas.banca-1.regra'],
    ['bancas.banca-1.regraDeDeliberacao.campoQueNaoExiste', 'bancas.banca-1.regra'],
    ['bancas', 'bancas'],
  ])('leva ao controle da banca da tela o caminho %s', (caminho, campo) => {
    expect(campoDaRecusaDaEtapa({ dono: 'etapa', indice: 0, recurso: null, caminho })).toBe(campo);
  });

  it('reconhece o campo sem distinguir a caixa', () => {
    expect(campoDe('Etapas[0].Bancas[3].RegraDeDeliberacao.SemUnanimidade')).toBe('bancas');
    expect(campoDe('Etapas[0].NotaMaxima')).toBe('notaMaxima');
  });

  it('não trata a recusa da fase como da etapa', () => {
    expect(campoDe('fases[0].notaMaxima')).toBeNull();
  });
});

describe('campoNaTelaDaEtapa', () => {
  const avaliacaoHumana = umaEtapaDoCronograma({
    formaDeAvaliacao: 'HUMANA',
    itensDeAvaliacao: [{ id: null, rotulo: 'Texto', pontuacaoMaxima: '10' }],
  });

  it('mostra o topo da etapa sempre', () => {
    expect(campoNaTelaDaEtapa('', umaEtapaDoCronograma({ carater: '' }), undefined)).toBe(true);
  });

  it('mostra a nota mínima só onde o caráter elimina', () => {
    expect(
      campoNaTelaDaEtapa(
        'notaMinima',
        umaEtapaDoCronograma({ carater: CaraterEtapa.ambas }),
        undefined,
      ),
    ).toBe(true);
    expect(
      campoNaTelaDaEtapa(
        'notaMinima',
        umaEtapaDoCronograma({ carater: CaraterEtapa.classificatoria }),
        undefined,
      ),
    ).toBe(false);
  });

  it('esconde a nota máxima da etapa sem caráter e da que traz a nota do ENEM', () => {
    const doEnem = umaEtapaDoCronograma({ tipoEtapaOrigemId: 'enem' });
    const tipoEnem = {
      nome: 'ENEM',
      avaliacao: { admitePontuacao: true, admiteEliminacao: false, notaDeOrigemNoEnem: true },
    };

    expect(campoNaTelaDaEtapa('notaMaxima', umaEtapaDoCronograma({ carater: '' }), undefined)).toBe(
      false,
    );
    expect(campoNaTelaDaEtapa('notaMaxima', doEnem, tipoEnem)).toBe(false);
  });

  it('mostra a seção de bancas também na etapa do ENEM', () => {
    const doEnem = umaEtapaDoCronograma({ tipoEtapaOrigemId: 'enem' });
    const tipoEnem = {
      nome: 'ENEM',
      avaliacao: { admitePontuacao: true, admiteEliminacao: false, notaDeOrigemNoEnem: true },
    };

    expect(campoNaTelaDaEtapa('bancas', doEnem, tipoEnem)).toBe(true);
  });

  it('trata o campo de uma banca como a seção de bancas: aparece também na etapa do ENEM', () => {
    const doEnem = umaEtapaDoCronograma({ tipoEtapaOrigemId: 'enem' });
    const tipoEnem = {
      nome: 'ENEM',
      avaliacao: { admitePontuacao: true, admiteEliminacao: false, notaDeOrigemNoEnem: true },
    };

    expect(campoNaTelaDaEtapa('bancas.banca-1.quorum', doEnem, tipoEnem)).toBe(true);
    expect(campoNaTelaDaEtapa('bancas.banca-1.quorum', umaEtapaDoCronograma(), undefined)).toBe(
      true,
    );
  });

  it('mostra a regra de consolidação e o passo só na avaliação humana', () => {
    expect(campoNaTelaDaEtapa('regraConsolidacao', avaliacaoHumana, undefined)).toBe(true);
    expect(campoNaTelaDaEtapa('passoDoLancamento', avaliacaoHumana, undefined)).toBe(true);
    expect(campoNaTelaDaEtapa('regraConsolidacao', umaEtapaDoCronograma(), undefined)).toBe(false);
  });

  it('esconde o passo quando a escala de atendimento vale', () => {
    const comEscala = {
      ...avaliacaoHumana,
      escalaDeAtendimento: [{ rotulo: 'Pleno', percentual: '100' }],
    };

    expect(campoNaTelaDaEtapa('passoDoLancamento', comEscala, undefined)).toBe(false);
    expect(campoNaTelaDaEtapa('escalaDeAtendimento', comEscala, undefined)).toBe(true);
  });

  it('mostra o item e o nível só enquanto a posição existe', () => {
    expect(campoNaTelaDaEtapa('itensDeAvaliacao.0.rotulo', avaliacaoHumana, undefined)).toBe(true);
    expect(campoNaTelaDaEtapa('itensDeAvaliacao.1.rotulo', avaliacaoHumana, undefined)).toBe(false);
    expect(campoNaTelaDaEtapa('escalaDeAtendimento.0.fracao', avaliacaoHumana, undefined)).toBe(
      false,
    );
  });

  it('mostra o controle do recurso só enquanto o recurso existe', () => {
    const comRecurso = umaEtapaDoCronograma({ recursos: [umRecursoDaEtapa()] });

    expect(campoNaTelaDaEtapa('recursos.0.prazoValor', comRecurso, undefined)).toBe(true);
    expect(campoNaTelaDaEtapa('recursos.1.prazoValor', comRecurso, undefined)).toBe(false);
  });

  it('mostra o prazo da 2ª instância só com instância superior', () => {
    const sem = umaEtapaDoCronograma({
      recursos: [umRecursoDaEtapa({ admiteInstanciaSuperior: false })],
    });
    const com = umaEtapaDoCronograma({
      recursos: [umRecursoDaEtapa({ admiteInstanciaSuperior: true })],
    });

    for (const controle of ['Valor', 'Unidade']) {
      const campo = `recursos.0.prazoSegundaInstancia${controle}`;
      expect(campoNaTelaDaEtapa(campo, sem, undefined)).toBe(false);
      expect(campoNaTelaDaEtapa(campo, com, undefined)).toBe(true);
    }
  });

  it('mostra o prazo da 2ª instância lido sem instância superior, para a pessoa poder retirá-lo', () => {
    const lido = umaEtapaDoCronograma({
      recursos: [
        umRecursoDaEtapa({
          admiteInstanciaSuperior: false,
          leitura: umaLeituraDoRecurso({ prazoDaSegundaInstanciaSemInstanciaSuperior: true }),
        }),
      ],
    });

    expect(campoNaTelaDaEtapa('recursos.0.prazoSegundaInstanciaValor', lido, undefined)).toBe(true);
  });
});
