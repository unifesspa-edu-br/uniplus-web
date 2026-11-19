import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada, exemploDoContrato, NOMES_DOS_EXEMPLOS } from '../exemplos.testing';
import { umaFaseCompleta } from '../fase.testing';
import {
  edicaoDaEtapa,
  edicaoDaFase,
  valoresDaEtapa,
  valoresDaFase,
  type ValoresDaEtapa,
  type ValoresDaFase,
} from './fase.adaptador';

function fase(documento: DocumentoDaConfiguracao, chave = 'inscricao'): ValoresDaFase {
  const valores = valoresDaFase(documento, chave);
  if (valores === undefined) throw new Error(`Sem a fase ${chave}.`);
  return valores;
}

function etapa(documento: DocumentoDaConfiguracao, chave = 'prova'): ValoresDaEtapa {
  const valores = valoresDaEtapa(documento, chave);
  if (valores === undefined) throw new Error(`Sem a etapa ${chave}.`);
  return valores;
}

describe('adaptador do passo Fase', () => {
  it.each(NOMES_DOS_EXEMPLOS)('devolve o exemplo %s idêntico em toda fase e etapa', (nome) => {
    const documento = exemploDoContrato(nome);
    const fases = documento.cronograma?.fases ?? [];
    const etapas = documento.etapas ?? [];

    const volta = [
      ...fases.map((f) => edicaoDaFase(f.chave, fase(documento, f.chave))),
      ...etapas.map((e) => edicaoDaEtapa(e.chave, etapa(documento, e.chave))),
    ].reduce((atual, edicao) => edicao(atual), documento);

    expect(volta).toBe(documento);
    expect(JSON.stringify(volta)).toBe(JSON.stringify(exemploDoContrato(nome)));
  });

  it('a fase completa e a etapa completa voltam como a mesma instância', () => {
    const documento = umaFaseCompleta();

    expect(edicaoDaFase('inscricao', fase(documento))(documento)).toBe(documento);
    expect(edicaoDaEtapa('prova', etapa(documento))(documento)).toBe(documento);
  });

  it('lê a fase e a etapa que o documento não tem como ausentes', () => {
    expect(valoresDaFase(documentoSemNada(), 'x')).toBeUndefined();
    expect(valoresDaEtapa(documentoSemNada(), 'x')).toBeUndefined();
  });

  it('lê produtos, bancas, recurso e decisões da fase', () => {
    const valores = fase(umaFaseCompleta());

    expect(valores).toMatchObject({
      produtos: [
        { atoCodigo: 'EDITAL', papel: 'DEFINITIVO' },
        { atoCodigo: 'EDITAL', papel: '' },
      ],
      faseConcluinteChave: 'resultado',
      emiteParecerIndividual: false,
      tiposDeDecisao: ['CLASSIFICACAO', 'HOMOLOGACAO_DAS_INSCRICOES'],
      bancas: [
        { chave: 'banca-de-analise', regraDeDeliberacao: { integrantes: '3', suplentes: '' } },
      ],
      recurso: { regraCodigo: 'RECURSO-PADRAO', prazoValor: '2', admiteInstanciaSuperior: true },
    });
  });

  it('fase sem recurso lê `recurso: null`; tirar o recurso tira a regra inteira, com os procedimentos', () => {
    const documento = umaFaseCompleta();

    const editado = edicaoDaFase('inscricao', { ...fase(documento), recurso: null })(documento);

    expect(editado.cronograma?.fases?.[0]).not.toHaveProperty('regraRecurso');
    expect(valoresDaFase(documento, 'avaliacao')?.recurso).toBeNull();
  });

  it('alterar o prazo do recurso da fase preserva os procedimentos de recurso', () => {
    const documento = umaFaseCompleta();
    const valores = fase(documento);

    const editado = edicaoDaFase('inscricao', {
      ...valores,
      recurso: valores.recurso && { ...valores.recurso, prazoValor: '3' },
    })(documento);

    const regra = editado.cronograma?.fases?.[0].regraRecurso;
    expect(regra?.prazoValor).toBe(3);
    expect(regra?.procedimentosDeRecurso).toBe(
      documento.cronograma?.fases?.[0].regraRecurso?.procedimentosDeRecurso,
    );
  });

  it('declarar o recurso de uma fase que não tinha cria a regra só com o que foi preenchido', () => {
    const documento = umaFaseCompleta();
    const base = fase(documento).recurso;
    if (base === null) throw new Error('A fase de inscrição tem recurso.');
    const recurso = { ...base, regraCodigo: '', regraVersao: '', prazoValor: '4' };

    const editado = edicaoDaFase('avaliacao', { ...fase(documento, 'avaliacao'), recurso })(
      documento,
    );

    expect(editado.cronograma?.fases?.[1].regraRecurso).toEqual({
      prazoUnidade: 'diasUteis',
      prazoValor: 4,
      admiteInstanciaSuperior: true,
    });
  });

  it('os recursos da etapa são identificados pela posição lida, e retirar o primeiro não troca os procedimentos', () => {
    const documento = umaFaseCompleta();
    const valores = etapa(documento);

    const editado = edicaoDaEtapa('prova', { ...valores, recursos: [valores.recursos[1]] })(
      documento,
    );

    expect(editado.etapas?.[0].recursos).toEqual([documento.etapas?.[0].recursos?.[1]]);
    expect(editado.etapas?.[0].recursos?.[0]).toBe(documento.etapas?.[0].recursos?.[1]);
  });

  it('o recurso novo da etapa vai ao fim com a âncora escolhida', () => {
    const documento = umaFaseCompleta();
    const valores = etapa(documento);

    const editado = edicaoDaEtapa('prova', {
      ...valores,
      recursos: [...valores.recursos, { ...valores.recursos[0], origem: null, prazoValor: '7' }],
    })(documento);

    expect(editado.etapas?.[0].recursos?.at(-1)).toEqual({
      ancora: 'atoPublicado',
      prazoValor: 7,
    });
  });

  it('o código de tipo de decisão que o vocabulário não conhece e o documento não tinha não entra', () => {
    const documento = umaFaseCompleta();
    const valores = etapa(documento);

    const editado = edicaoDaEtapa('prova', {
      ...valores,
      tiposDeDecisao: ['CLASSIFICACAO', 'TIPO_DO_FUTURO', 'HOMOLOGACAO_DAS_INSCRICOES'],
    })(documento);

    expect(editado.etapas?.[0].tiposDeDecisao).toEqual([
      'CLASSIFICACAO',
      'HOMOLOGACAO_DAS_INSCRICOES',
    ]);
  });

  it('o que o passo não toca fica com a mesma instância', () => {
    const documento = umaFaseCompleta();
    const valores = fase(documento);

    const editado = edicaoDaFase('inscricao', { ...valores, emiteParecerIndividual: true })(
      documento,
    );

    const [antes, depois] = [documento, editado].map((d) => d.cronograma?.fases ?? []);
    expect(depois[1]).toBe(antes[1]);
    expect(depois[0].regraRecurso).toBe(antes[0].regraRecurso);
    expect(depois[0].emiteParecerIndividual).toBe(true);
    expect(editado.etapas).toBe(documento.etapas);
  });
});

describe('ocorrências repetidas', () => {
  it('lê e edita apenas a segunda fase e etapa', () => {
    const documento = {
      ...documentoSemNada(),
      cronograma: {
        fases: [
          { chave: 'a', faseCanonicaCodigo: 'INSCRICOES' },
          { chave: 'a', faseCanonicaCodigo: 'INSCRICOES', emiteParecerIndividual: true },
        ],
      },
      etapas: [{ chave: 'b' }, { chave: 'b', emiteParecerIndividual: true }],
    };
    const fase = valoresDaFase(documento, 'a', 1);
    const etapa = valoresDaEtapa(documento, 'b', 1);
    expect(fase?.emiteParecerIndividual).toBe(true);
    expect(etapa?.emiteParecerIndividual).toBe(true);
    if (!fase || !etapa) throw new Error('Ocorrência ausente');
    const editado = edicaoDaEtapa(
      'b',
      { ...etapa, emiteParecerIndividual: false },
      1,
    )(edicaoDaFase('a', { ...fase, emiteParecerIndividual: false }, 1)(documento));
    expect(editado.cronograma?.fases?.map((item) => item.emiteParecerIndividual)).toEqual([
      undefined,
      false,
    ]);
    expect(editado.etapas?.map((item) => item.emiteParecerIndividual)).toEqual([undefined, false]);
  });
});
