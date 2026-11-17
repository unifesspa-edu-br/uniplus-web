import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { catalogoPorCodigo } from '../catalogos-por-codigo';
import { umCronogramaCompleto } from '../cronograma.testing';
import { documentoSemNada, exemploDoContrato, NOMES_DOS_EXEMPLOS } from '../exemplos.testing';
import {
  edicaoDoPasso,
  valoresDoFormulario,
  type CatalogosDoCronograma,
  type ValoresDoCronograma,
} from './cronograma.adaptador';

const CATALOGOS: CatalogosDoCronograma = {
  fases: catalogoPorCodigo([{ codigo: 'AVALIACAO', rotulo: 'Avaliação' }]),
  unidades: catalogoPorCodigo([{ codigo: 'CEPS', rotulo: 'Nome do catálogo vivo' }]),
  tiposDeEtapa: catalogoPorCodigo([{ codigo: 'PROVA_OBJETIVA', rotulo: 'Prova objetiva' }]),
};

function ler(documento: DocumentoDaConfiguracao): ValoresDoCronograma {
  return valoresDoFormulario(documento, CATALOGOS);
}

function idaEVolta(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  return edicaoDoPasso(ler(documento))(documento);
}

describe('adaptador do passo Cronograma', () => {
  it.each(NOMES_DOS_EXEMPLOS)('devolve o exemplo %s idêntico depois de ler e editar', (nome) => {
    const documento = exemploDoContrato(nome);

    expect(JSON.stringify(idaEVolta(documento))).toBe(JSON.stringify(documento));
    expect(idaEVolta(documento)).toBe(documento);
  });

  it('lê as fases com a janela no fuso institucional e a unidade que o processo gravou', () => {
    const { fases } = ler(exemploDoContrato('inscricao-pelo-sistema'));

    expect(fases[0]).toMatchObject({
      chave: 'inscricao',
      faseCanonicaCodigo: 'INSCRICAO',
      rotulo: 'INSCRICAO',
      inicio: '2027-01-10T00:00',
      fim: '2027-01-19T23:59:59',
      unidadeResponsavelCodigo: 'CEPS',
      unidadeResponsavelRotulo: 'CEPS — Centro de Processos Seletivos',
    });
    expect(fases[1].rotulo).toBe('Avaliação');
  });

  it('lê a etapa com o tipo, a nota, os itens e a escala no formato dos campos', () => {
    const [prova] = ler(exemploDoContrato('inscricao-pelo-sistema')).etapas;

    expect(prova).toMatchObject({
      chave: 'prova-objetiva',
      carater: 'ambas',
      tipoEtapaRotulo: 'Prova objetiva',
      peso: '1',
      notaMinima: '30',
      passoDoLancamento: '0,5',
      formaDeAvaliacao: 'HUMANA',
      regraDeConsolidacao: { codigo: 'CONSOLIDACAO-AVALIACAO-UNICA', versao: 'v1' },
      faseChave: 'avaliacao',
    });
    expect(prova.itensDeAvaliacao[0]).toEqual({
      chave: 'argumentacao',
      origem: 0,
      rotulo: 'Argumentação',
      pontuacaoMaxima: '60',
    });
    expect(prova.escalaDeAtendimento[1]).toEqual({
      chave: 'atende-parcialmente',
      origem: 1,
      rotulo: 'Atende parcialmente',
      percentual: '50',
    });
  });

  it('lê cronograma ausente como nada declarado e não o cria', () => {
    const documento = documentoSemNada();

    expect(ler(documento)).toEqual({ fases: [], etapas: [], convencaoDeContagem: null });
    expect(edicaoDoPasso(ler(documento))(documento)).toBe(documento);
  });

  it('o que o passo não edita volta com a mesma instância, ainda que o passo edite outros campos', () => {
    const documento = umCronogramaCompleto();
    const valores = ler(documento);

    const editado = edicaoDoPasso({
      ...valores,
      etapas: [{ ...valores.etapas[0], nome: 'Prova objetiva' }, valores.etapas[1]],
    })(documento);

    expect(editado.cronograma?.fases?.[1]).toBe(documento.cronograma?.fases?.[1]);
    expect(editado.etapas?.[1]).toBe(documento.etapas?.[1]);
  });

  it('o que nenhuma tela do passo edita fica fora do alcance da edição', () => {
    const documento = umCronogramaCompleto();
    const valores = ler(documento);

    const editado = edicaoDoPasso({
      ...valores,
      fases: valores.fases.map((fase) => ({ ...fase, fim: '2030-01-01T10:00' })),
    })(documento);

    expect(editado.importacao).toBe(documento.importacao);
    expect(editado.provaPresencial).toBe(documento.provaPresencial);
    expect(editado.divulgacao).toBe(documento.divulgacao);
    expect(editado.coleta).toBe(documento.coleta);
    expect(editado.cronograma?.fases?.[1].regraDeHomologacao).toBe(
      documento.cronograma?.fases?.[1].regraDeHomologacao,
    );
    expect(editado.cronograma?.fases?.[1].assinantes).toBe(
      documento.cronograma?.fases?.[1].assinantes,
    );
  });

  it('reordenar fases e etapas pelo formulário move no documento e renumera só a `ordem` das etapas', () => {
    const documento = umCronogramaCompleto();
    const { fases, etapas, convencaoDeContagem } = ler(documento);

    const editado = edicaoDoPasso({
      fases: [fases[2], fases[0], fases[1]],
      etapas: [etapas[1], etapas[0]],
      convencaoDeContagem,
    })(documento);

    expect(editado.cronograma?.fases?.map((fase) => fase.chave)).toEqual([
      'resultado',
      'inscricao',
      'avaliacao',
    ]);
    expect(editado.etapas?.map((etapa) => [etapa.chave, etapa.ordem])).toEqual([
      ['redacao', 1],
      ['prova', 2],
    ]);
  });

  it('a fase retirada do formulário sai, e a etapa que a cita fica apontando para ela', () => {
    const documento = umCronogramaCompleto();
    const valores = ler(documento);

    const editado = edicaoDoPasso({
      ...valores,
      fases: valores.fases.filter((fase) => fase.chave !== 'avaliacao'),
    })(documento);

    expect(editado.cronograma?.fases?.map((fase) => fase.chave)).toEqual([
      'inscricao',
      'resultado',
    ]);
    expect(editado.etapas?.map((etapa) => etapa.faseChave)).toEqual(['avaliacao', 'avaliacao']);
    expect(editado.cronograma?.fases?.[1].faseConcluinteChave).toBe('avaliacao');
  });

  it('a convenção de contagem é do bloco da identificação; trocar a escolha troca código e versão', () => {
    const documento = umCronogramaCompleto();
    const valores = ler(documento);

    const editado = edicaoDoPasso({
      ...valores,
      convencaoDeContagem: { codigo: 'CONTAGEM-DIAS-CORRIDOS', versao: 'v2' },
    })(documento);

    expect(editado.identificacao).toEqual({
      nome: 'Processo',
      algoritmoContagemPrazo: { codigo: 'CONTAGEM-DIAS-CORRIDOS', versao: 'v2' },
    });
  });

  it('limpar a convenção tira só a chave dela da identificação', () => {
    const documento = umCronogramaCompleto();

    const editado = edicaoDoPasso({ ...ler(documento), convencaoDeContagem: null })(documento);

    expect(editado.identificacao).toEqual({ nome: 'Processo' });
  });

  it('a `ordem` que o documento ainda traga numa fase não é lida nem regravada ao reordenar', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const { fases, ...demais } = ler(documento);

    const editado = edicaoDoPasso({ ...demais, fases: [...fases].reverse() })(documento);

    const ordens = editado.cronograma?.fases?.map((fase) => [fase.chave, fase.ordem]);
    expect(ordens).toEqual([
      ['resultado-final', 4],
      ['resultado-preliminar', 3],
      ['avaliacao', 2],
      ['inscricao', 1],
    ]);
  });

  it('fase sem `ordem` no documento também volta idêntica', () => {
    const comOrdem = umCronogramaCompleto();
    const semOrdem: DocumentoDaConfiguracao = {
      ...comOrdem,
      cronograma: {
        fases: (comOrdem.cronograma?.fases ?? []).map(({ chave, faseCanonicaCodigo }) => ({
          chave,
          faseCanonicaCodigo,
        })),
      },
    };

    expect(idaEVolta(semOrdem)).toBe(semOrdem);
  });
});

describe('fases com chave repetida', () => {
  it('preserva a origem da sobrevivente ao retirar a primeira', () => {
    const documento: DocumentoDaConfiguracao = {
      ...documentoSemNada(),
      cronograma: {
        fases: [
          { chave: 'a', ordem: 7 },
          { chave: 'a', ordem: 9 },
        ],
      },
    };
    const valores = ler(documento);
    const editado = edicaoDoPasso({ ...valores, fases: valores.fases.slice(1) })(documento);
    expect(editado.cronograma?.fases).toEqual([{ chave: 'a', ordem: 9 }]);
  });
});
