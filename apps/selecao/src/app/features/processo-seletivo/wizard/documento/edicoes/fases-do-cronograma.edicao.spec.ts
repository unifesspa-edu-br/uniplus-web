import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { campoDoInstante } from '../../shared/fuso-institucional';
import { umCronogramaCompleto } from '../cronograma.testing';
import { documentoSemNada } from '../exemplos.testing';
import {
  acrescentarFase,
  definirFases,
  naFase,
  type FaseDoFormulario,
} from './fases-do-cronograma.edicao';

function fasesDoFormulario(documento: DocumentoDaConfiguracao): FaseDoFormulario[] {
  return (documento.cronograma?.fases ?? []).map((fase, origem) => ({
    origem,
    chave: fase.chave,
    faseCanonicaCodigo: fase.faseCanonicaCodigo ?? '',
    inicio: campoDoInstante(fase.inicio ?? ''),
    fim: campoDoInstante(fase.fim ?? ''),
    unidadeResponsavelCodigo: fase.unidadeResponsavelCodigo ?? '',
  }));
}

function chavesDasFases(documento: DocumentoDaConfiguracao): string[] {
  return (documento.cronograma?.fases ?? []).map((fase) => fase.chave);
}

describe('acrescentar fase', () => {
  it('põe a fase no fim com chave tirada do nome, sem `ordem`', () => {
    const editado = acrescentarFase(umCronogramaCompleto(), 'HABILITACAO', 'Habilitação', {
      original: umCronogramaCompleto(),
      criadas: [],
    });

    expect(editado.cronograma?.fases?.at(-1)).toEqual({
      chave: 'habilitacao',
      faseCanonicaCodigo: 'HABILITACAO',
    });
  });

  it('cria o cronograma quando o documento ainda não tem', () => {
    const editado = acrescentarFase(documentoSemNada(), 'INSCRICAO', 'Inscrição', {
      original: documentoSemNada(),
      criadas: [],
    });

    expect(editado.cronograma?.fases).toEqual([
      { chave: 'inscricao', faseCanonicaCodigo: 'INSCRICAO' },
    ]);
  });

  it('não repete a chave de outra fase nem a de uma referência', () => {
    const documento = umCronogramaCompleto();

    const editado = acrescentarFase(documento, 'INSCRICAO', 'Inscrição', {
      original: documento,
      criadas: [],
    });

    expect(editado.cronograma?.fases?.at(-1)?.chave).toBe('inscricao-2');
  });

  it('a chave da fase removida segue tomada enquanto outra parte a cita', () => {
    const documento = umCronogramaCompleto();
    const semAAvaliacao = definirFases(
      documento,
      fasesDoFormulario(documento).filter((fase) => fase.chave !== 'avaliacao'),
    );

    const editado = acrescentarFase(semAAvaliacao, 'AVALIACAO', 'Avaliação', {
      original: documento,
      criadas: [],
    });

    expect(editado.cronograma?.fases?.at(-1)?.chave).toBe('avaliacao-2');
  });
});

describe('chave da fase sem referências', () => {
  it('continua tomada depois de remover a fase lida', () => {
    const original = {
      ...documentoSemNada(),
      cronograma: { fases: [{ chave: 'teste', faseCanonicaCodigo: 'INSCRICOES' }] },
    };
    const removido = definirFases(original, []);
    const resultado = acrescentarFase(removido, 'TESTE', 'Teste', { original, criadas: [] });
    expect(resultado.cronograma?.fases?.[0].chave).toBe('teste-2');
  });
});

describe('chave criada e removida', () => {
  it('continua tomada durante a edição', () => {
    const original = documentoSemNada();
    const editado = acrescentarFase(original, 'TESTE', 'Teste', { original, criadas: ['teste'] });
    expect(editado.cronograma?.fases?.[0].chave).toBe('teste-2');
  });
});

describe('definir fases', () => {
  it('reordenar é mover a fase no array, sem tocar em `ordem` nem em outra chave', () => {
    const documento = umCronogramaCompleto();
    const [primeira, segunda, terceira] = fasesDoFormulario(documento);

    const editado = definirFases(documento, [terceira, primeira, segunda]);

    expect(chavesDasFases(editado)).toEqual(['resultado', 'inscricao', 'avaliacao']);
    expect(editado.cronograma?.fases?.[1]).toEqual(documento.cronograma?.fases?.[0]);
  });

  it('retirar a fase não leva a referência que outra parte faz a ela', () => {
    const documento = umCronogramaCompleto();

    const editado = definirFases(
      documento,
      fasesDoFormulario(documento).filter((fase) => fase.chave !== 'avaliacao'),
    );

    expect(chavesDasFases(editado)).toEqual(['inscricao', 'resultado']);
    expect(editado.etapas).toBe(documento.etapas);
    expect(editado.cronograma?.fases?.[1].faseConcluinteChave).toBe('avaliacao');
  });

  it('o campo que a tela não edita volta com a mesma instância', () => {
    const documento = umCronogramaCompleto();
    const avaliacao = documento.cronograma?.fases?.[1];

    const editado = definirFases(documento, fasesDoFormulario(documento));

    expect(editado.cronograma?.fases?.[1].regraDeHomologacao).toBe(avaliacao?.regraDeHomologacao);
    expect(editado.cronograma?.fases?.[1].assinantes).toBe(avaliacao?.assinantes);
  });

  it('não acrescenta fase que o documento não tem: parte nova nasce por acrescentar', () => {
    const documento = umCronogramaCompleto();
    const nova: FaseDoFormulario = { ...fasesDoFormulario(documento)[0], chave: 'sem-parte' };

    const editado = definirFases(documento, [...fasesDoFormulario(documento), nova]);

    expect(chavesDasFases(editado)).toEqual(chavesDasFases(documento));
  });

  it('a janela digitada vai ao documento em UTC, e só a que mudou', () => {
    const documento = umCronogramaCompleto();
    const [inscricao, ...demais] = fasesDoFormulario(documento);
    const lida = documento.cronograma?.fases?.[0];

    const editado = definirFases(documento, [
      { ...inscricao, inicio: '2027-02-01T08:00' },
      ...demais,
    ]);

    expect(editado.cronograma?.fases?.[0].inicio).toBe('2027-02-01T11:00:00Z');
    expect(editado.cronograma?.fases?.[0].fim).toBe(lida?.fim);
  });

  it('esvaziar o campo tira o instante da fase', () => {
    const documento = umCronogramaCompleto();
    const [inscricao, ...demais] = fasesDoFormulario(documento);

    const editado = definirFases(documento, [{ ...inscricao, inicio: '' }, ...demais]);

    expect(editado.cronograma?.fases?.[0]).not.toHaveProperty('inicio');
    expect(editado.cronograma?.fases?.[0].fim).toBe('2027-01-20T02:59:59Z');
  });

  it('trocar a unidade responsável descarta o nome e a sigla da anterior; repetir a mantém', () => {
    const documento = umCronogramaCompleto();
    const [inscricao, ...demais] = fasesDoFormulario(documento);

    const repetida = definirFases(documento, [inscricao, ...demais]);
    const trocada = definirFases(documento, [
      { ...inscricao, unidadeResponsavelCodigo: 'PROEG' },
      ...demais,
    ]);

    expect(repetida.cronograma?.fases?.[0].unidadeResponsavelNome).toBe(
      'Centro de Processos Seletivos',
    );
    expect(trocada.cronograma?.fases?.[0]).toMatchObject({ unidadeResponsavelCodigo: 'PROEG' });
    expect(trocada.cronograma?.fases?.[0]).not.toHaveProperty('unidadeResponsavelNome');
    expect(trocada.cronograma?.fases?.[0]).not.toHaveProperty('unidadeResponsavelSigla');
  });

  it('documento sem cronograma e formulário sem fases não criam o cronograma', () => {
    const vazio = documentoSemNada();

    expect(definirFases(vazio, [])).toBe(vazio);
  });
});

describe('na fase', () => {
  it('edita só a fase da chave', () => {
    const documento = umCronogramaCompleto();

    const editado = naFase(documento, 'resultado', (fase) => ({
      ...fase,
      emiteParecerIndividual: true,
    }));

    expect(editado.cronograma?.fases?.map((fase) => fase.emiteParecerIndividual)).toEqual([
      undefined,
      undefined,
      true,
    ]);
  });

  it('não muda nada quando a chave não existe', () => {
    const documento = umCronogramaCompleto();

    expect(naFase(documento, 'inexistente', (fase) => fase)).toBe(documento);
  });
});
