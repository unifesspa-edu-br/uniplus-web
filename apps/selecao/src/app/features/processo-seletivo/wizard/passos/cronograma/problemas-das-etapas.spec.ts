import { describe, expect, it } from 'vitest';
import { CaraterEtapa } from '@uniplus/shared-data/selecao';
import { type EtapaPontuada, type RecursoDaEtapa } from '../../processo-seletivo.models';
import {
  fracaoDoPercentual,
  percentualDaFracao,
  somaDosItens,
  somaForaDaNotaMaxima,
  textoDaSoma,
} from '../../shared/itens-de-avaliacao';
import { problemasDoCronograma } from './cronograma-do-certame';
import { etapaComOQueDeclara } from './regras-da-etapa';
import {
  SEM_CATALOGO,
  nomeDaBanca,
  tipoDoEnem,
  problemasDe,
  faseCanonica,
  fase,
  etapa,
  PRELIMINAR,
  RESULTADO,
  catalogoDeFases,
  etapaValida,
  faseDeAvaliacao,
} from './cronograma-do-certame.testing';

describe('problemas das etapas', () => {
  it('fase que agrupa etapas sem nenhuma etapa é recusada antes de gravar', () => {
    const problemas = problemasDe([faseDeAvaliacao], [], catalogoDeFases, []);

    expect(problemas).toContainEqual(expect.stringContaining('precisa de ao menos uma'));
  });

  it('etapa que não diz a que fase pertence é recusada', () => {
    const semAvaliacao = fase({
      faseCanonicaId: RESULTADO.id,
      codigo: 'RESULTADO_PRELIMINAR',
      produtos: [PRELIMINAR],
    });

    const problemas = problemasDe([semAvaliacao], [etapaValida], catalogoDeFases, []);

    expect(problemas).toContainEqual(expect.stringContaining('não dizem a que fase pertencem'));
  });

  it('etapas que não compõem a nota final são recusadas com a explicação da média', () => {
    const soEliminatoria = etapa({
      nome: 'Títulos',
      carater: CaraterEtapa.eliminatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '',
    });

    const problemas = problemasDe([faseDeAvaliacao], [soEliminatoria], catalogoDeFases, []);

    expect(problemas).toContainEqual(expect.stringContaining('compor a nota final'));
  });

  it('caráter que o tipo de etapa não admite é recusado antes de gravar', () => {
    const classificatoria = etapa({
      nome: 'Análise documental',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
    });

    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [classificatoria],
      catalogoDeFases,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      () => ({
        nome: 'Análise Documental',
        admitePontuacao: false,
        admiteEliminacao: true,
        notaDeOrigemNoEnem: false,
      }),
      [],
    );

    expect(problemas).toContainEqual(expect.stringContaining('não compõe a nota final'));
    expect(problemas).toContainEqual(expect.stringContaining('Análise documental'));
  });

  /** Tipo fora do catálogo carregado não autoriza inventar restrição nenhuma. */
  it('tipo que a tela não conhece não gera recusa de caráter', () => {
    const classificatoria = etapa({
      nome: 'Prova',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
    });

    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [classificatoria],
      catalogoDeFases,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      () => undefined,
      [],
    );

    expect(problemas).not.toContainEqual(expect.stringContaining('não compõe a nota final'));
  });

  it('mesma posição em duas fases é recusada', () => {
    const outra = fase({
      faseCanonicaId: RESULTADO.id,
      codigo: 'RESULTADO_PRELIMINAR',
      ordem: 1,
      produtos: [PRELIMINAR],
    });

    const problemas = problemasDe([faseDeAvaliacao, outra], [etapaValida], catalogoDeFases, []);

    expect(problemas).toContainEqual(expect.stringContaining('mesma posição na linha do tempo'));
  });

  it('número malformado é recusado em vez de limpar o campo em silêncio', () => {
    const notaTorta = etapa({
      nome: 'Prova',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
      notaMinima: '7,5,',
    });

    const problemas = problemasDe([faseDeAvaliacao], [notaTorta], catalogoDeFases, []);

    expect(problemas).toContainEqual(expect.stringContaining('nota mínima'));
  });

  it('recusa nota máxima que não é número ou que não passa de zero', () => {
    const base = { nome: 'Prova', peso: '1', tipoEtapaOrigemId: 'tipo-1' };

    expect(
      problemasDe([faseDeAvaliacao], [etapa({ ...base, notaMaxima: '10,' })], catalogoDeFases, []),
    ).toContainEqual(expect.stringContaining('nota máxima'));
    expect(
      problemasDe([faseDeAvaliacao], [etapa({ ...base, notaMaxima: '0' })], catalogoDeFases, []),
    ).toContainEqual(expect.stringContaining('nota máxima'));
    expect(
      problemasDe([faseDeAvaliacao], [etapa({ ...base, notaMaxima: '' })], catalogoDeFases, []),
    ).not.toContainEqual(expect.stringContaining('nota máxima'));
  });

  it('recusa localmente a nota mínima acima da nota máxima', () => {
    const base = { nome: 'Prova', peso: '1', tipoEtapaOrigemId: 'tipo-1', notaMaxima: '10' };
    const confere = (notaMinima: string) =>
      problemasDe([faseDeAvaliacao], [etapa({ ...base, notaMinima })], catalogoDeFases, []);

    expect(confere('12')).toContainEqual(expect.stringContaining('não pode passar'));
    expect(confere('10')).not.toContainEqual(expect.stringContaining('não pode passar'));
  });

  it('recusa o passo do lançamento que não é número ou não passa de zero', () => {
    const base = {
      nome: 'Prova',
      peso: '1',
      tipoEtapaOrigemId: 'tipo-1',
      formaDeAvaliacao: 'HUMANA',
    };
    const confere = (passoDoLancamento: string) =>
      problemasDe([faseDeAvaliacao], [etapa({ ...base, passoDoLancamento })], catalogoDeFases, []);

    expect(confere('0,')).toContainEqual(expect.stringContaining('passo do lançamento'));
    expect(confere('0')).toContainEqual(expect.stringContaining('passo do lançamento'));
    expect(confere('')).not.toContainEqual(expect.stringContaining('passo do lançamento'));
    expect(confere('0,25')).not.toContainEqual(expect.stringContaining('passo do lançamento'));
  });

  it('não confere a nota máxima herdada por etapa do ENEM nem a mostra como pendência', () => {
    const doEnem = etapa({
      nome: 'Nota do ENEM',
      peso: '1',
      notaMaxima: '0',
      notaMinima: '5',
      tipoCongelado: { origemId: 'tipo-1', nome: 'Prova objetiva', notaDeOrigemNoEnem: true },
    });

    const problemas = problemasDe([faseDeAvaliacao], [doEnem], catalogoDeFases, []);

    expect(problemas).not.toContainEqual(expect.stringContaining('nota máxima'));
    expect(problemas).not.toContainEqual(expect.stringContaining('não pode passar'));
  });

  it('campo numérico vazio continua sendo não declarado, e não erro', () => {
    const semNota = etapa({
      nome: 'Prova',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
      notaMinima: '',
    });

    expect(problemasDe([faseDeAvaliacao], [semNota], catalogoDeFases, [])).toEqual([]);
  });

  it('peso zero declarado é recusado mesmo com outra etapa compondo a nota', () => {
    const compoe = etapa({
      nome: 'Prova',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
      ordem: 1,
    });
    const zerada = etapa({
      nome: 'Redação',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '0',
      ordem: 2,
    });

    const problemas = problemasDe([faseDeAvaliacao], [compoe, zerada], catalogoDeFases, []);

    expect(problemas).toContainEqual(expect.stringContaining('maior que zero'));
  });

  it('etapa sem peso declarado continua válida ao lado de outra que compõe', () => {
    const compoe = etapa({
      nome: 'Prova',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
      ordem: 1,
    });
    const soEliminatoria = etapa({
      nome: 'Títulos',
      carater: CaraterEtapa.eliminatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '',
      ordem: 2,
    });

    expect(problemasDe([faseDeAvaliacao], [compoe, soEliminatoria], catalogoDeFases, [])).toEqual(
      [],
    );
  });

  describe('itens de avaliação e escala de atendimento', () => {
    const item = (rotulo: string, pontuacaoMaxima: string) => ({
      id: null,
      rotulo,
      pontuacaoMaxima,
    });
    const escala = [
      { rotulo: 'Atendeu', percentual: '100' },
      { rotulo: 'Não atendeu', percentual: '0' },
    ];
    const humanaComItens = etapa({
      nome: 'Projeto',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      notaMaxima: '10',
      formaDeAvaliacao: 'HUMANA',
      itensDeAvaliacao: [item('Clareza', '4'), item('Método', '6')],
      escalaDeAtendimento: escala,
    });

    it('com escala o passo sai e a escala segue', () => {
      expect(
        etapaComOQueDeclara({ ...humanaComItens, passoDoLancamento: '0,5' }, undefined),
      ).toMatchObject({ passoDoLancamento: '', escalaDeAtendimento: escala });
    });

    it('descarta a escala fora da forma humana ou sem itens, e mantém os itens', () => {
      expect(
        etapaComOQueDeclara({ ...humanaComItens, formaDeAvaliacao: 'OBJETIVA' }, undefined),
      ).toMatchObject({
        escalaDeAtendimento: [],
        itensDeAvaliacao: humanaComItens.itensDeAvaliacao,
      });
      expect(
        etapaComOQueDeclara({ ...humanaComItens, itensDeAvaliacao: [] }, undefined),
      ).toMatchObject({ escalaDeAtendimento: [] });
    });

    it('descarta itens e escala da etapa sem nota', () => {
      expect(etapaComOQueDeclara({ ...humanaComItens, carater: '' }, undefined)).toMatchObject({
        itensDeAvaliacao: [],
        escalaDeAtendimento: [],
      });
    });

    it('recusa a pontuação do item e o percentual do nível que não são número', () => {
      const confere = (parcial: Partial<EtapaPontuada>) =>
        problemasDe(
          [faseDeAvaliacao],
          [etapa({ ...humanaComItens, ...parcial })],
          catalogoDeFases,
          [],
        );

      expect(confere({ itensDeAvaliacao: [item('A', '4,')] })).toContainEqual(
        expect.stringContaining('pontuação máxima de cada item'),
      );
      expect(confere({ itensDeAvaliacao: [item('A', '')] })).toContainEqual(
        expect.stringContaining('pontuação máxima de cada item'),
      );
      expect(
        confere({ escalaDeAtendimento: [{ rotulo: 'A', percentual: 'meio' }] }),
      ).toContainEqual(expect.stringContaining('percentual de cada nível'));
      expect(confere({})).not.toContainEqual(expect.stringContaining('de cada'));
    });

    it('a soma dos itens usa as quatro casas do servidor e não acusa erro de ponto flutuante', () => {
      expect(somaDosItens([item('A', '0,1'), item('B', '0.2')])).toBe(0.3);
      expect(somaForaDaNotaMaxima([item('A', '0,1'), item('B', '0.2')], '0,3')).toBe(false);
      expect(somaForaDaNotaMaxima([item('A', '4')], '10')).toBe(true);
      expect(somaForaDaNotaMaxima([], '10')).toBe(false);
      expect(textoDaSoma([item('A', '4'), item('B', '4')], '10')).toBe('Soma dos itens: 8 de 10');
      expect(textoDaSoma([item('A', '10,0004')], '10')).toBe('Soma dos itens: 10,0004 de 10');
    });

    it('o percentual vira fração e volta sem sujeira', () => {
      expect(fracaoDoPercentual('50')).toBe(0.5);
      expect(fracaoDoPercentual('33,33')).toBe(0.3333);
      expect(fracaoDoPercentual('meio')).toBeNull();
      expect(percentualDaFracao(0.3333)).toBe('33.33');
      expect(percentualDaFracao(1)).toBe('100');
    });
  });
});

describe('etapa de nota do ENEM', () => {
  const faseDaEtapaDoEnem = fase({ faseCanonicaId: 'fase-1', codigo: 'AVALIACAO' });

  function problemasDaEnem(parcial: Partial<EtapaPontuada>): readonly string[] {
    return problemasDoCronograma(
      [faseDaEtapaDoEnem],
      [etapa({ nome: 'Nota do ENEM', ...parcial })],
      new Map([['fase-1', faseCanonica({ id: 'fase-1', codigo: 'AVALIACAO' })]]),
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoDoEnem,
      [],
    ).filter((problema) => problema.includes('nota do ENEM'));
  }

  it('classificatória com peso não tem pendência', () => {
    expect(problemasDaEnem({ carater: CaraterEtapa.classificatoria, peso: '2' })).toEqual([]);
  });

  it('puramente eliminatória é recusada: a etapa sempre compõe a média', () => {
    expect(problemasDaEnem({ carater: CaraterEtapa.eliminatoria, peso: '' })).toHaveLength(1);
  });

  it('com banca, publicação, janela própria ou recurso contado de publicação é recusada', () => {
    const recurso = (ancora: RecursoDaEtapa['ancora']): RecursoDaEtapa => ({
      ancora,
      regraCodigo: 'R',
      regraVersao: 'v1',
      prazoValor: '2',
      prazoUnidade: 'diasUteis',
      atoAncoraCodigo: '',
      suspensividadePrimeiraInstanciaValor: '',
      suspensividadePrimeiraInstanciaUnidade: '',
      admiteInstanciaSuperior: true,
      suspensividadeSegundaInstanciaValor: '',
      suspensividadeSegundaInstanciaUnidade: '',
    });
    expect(problemasDaEnem({ bancas: ['banca-1'] })).toHaveLength(1);
    expect(problemasDaEnem({ inicio: '2027-01-10T08:00' })).toHaveLength(1);
    expect(problemasDaEnem({ fim: '2027-01-10T18:00' })).toHaveLength(1);
    expect(problemasDaEnem({ produtos: [{ atoCodigo: 'ATO', papel: null }] })).toHaveLength(1);
    expect(problemasDaEnem({ recursos: [recurso('atoPublicado')] })).toHaveLength(1);
    expect(problemasDaEnem({ recursos: [recurso('cienciaIndividual')] })).toEqual([]);
  });
});
