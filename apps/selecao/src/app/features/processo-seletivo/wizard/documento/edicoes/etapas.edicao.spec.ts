import {
  CaraterDaEtapa,
  FormaDeAvaliacaoDaEtapa,
  TipoDeDecisaoDoDocumento,
} from '@uniplus/shared-data/selecao';
import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { umCronogramaCompleto } from '../cronograma.testing';
import { documentoSemNada } from '../exemplos.testing';
import { textoDoNumero } from '../texto-do-campo';
import { acrescentarEtapa, definirEtapas, type EtapaDoFormulario } from './etapas.edicao';

function etapasDoFormulario(documento: DocumentoDaConfiguracao): EtapaDoFormulario[] {
  return (documento.etapas ?? []).map((etapa, origem) => ({
    origem,
    chave: etapa.chave,
    nome: etapa.nome ?? '',
    carater: etapa.carater ?? '',
    tipoEtapaCodigo: etapa.tipoEtapaCodigo ?? '',
    peso: textoDoNumero(etapa.peso),
    notaMinima: textoDoNumero(etapa.notaMinima),
    notaMaxima: textoDoNumero(etapa.notaMaxima),
    passoDoLancamento: textoDoNumero(etapa.passoDoLancamento),
    formaDeAvaliacao: etapa.formaDeAvaliacao ?? '',
    regraDeConsolidacao: null,
    faseChave: etapa.faseChave ?? '',
    inicio: '',
    fim: '',
    itensDeAvaliacao: [],
    escalaDeAtendimento: [],
  }));
}

function ordensDasEtapas(documento: DocumentoDaConfiguracao): (number | undefined)[] {
  return (documento.etapas ?? []).map((etapa) => etapa.ordem);
}

describe('definir etapas', () => {
  it('reordenar move a etapa no array e renumera a `ordem` de 1 em diante', () => {
    const documento = umCronogramaCompleto();
    const [prova, redacao] = etapasDoFormulario(documento);

    const editado = definirEtapas(documento, [redacao, prova]);

    expect(editado.etapas?.map((etapa) => etapa.chave)).toEqual(['redacao', 'prova']);
    expect(ordensDasEtapas(editado)).toEqual([1, 2]);
  });

  it('editar sem mover não renumera a `ordem`, mesmo a atípica', () => {
    const documento: DocumentoDaConfiguracao = {
      ...umCronogramaCompleto(),
      etapas: [
        { chave: 'a', ordem: 7 },
        { chave: 'b', ordem: 3 },
      ],
    };

    const editado = definirEtapas(documento, etapasDoFormulario(documento));

    expect(ordensDasEtapas(editado)).toEqual([7, 3]);
  });

  it('retirar uma etapa não renumera as que ficam', () => {
    const documento: DocumentoDaConfiguracao = {
      ...umCronogramaCompleto(),
      etapas: [
        { chave: 'a', ordem: 1 },
        { chave: 'b', ordem: 2 },
        { chave: 'c', ordem: 3 },
      ],
    };
    const [a, , c] = etapasDoFormulario(documento);

    const editado = definirEtapas(documento, [a, c]);

    expect(ordensDasEtapas(editado)).toEqual([1, 3]);
  });

  it('retirar a etapa não leva a referência que outra parte faz a ela', () => {
    const documento: DocumentoDaConfiguracao = {
      ...umCronogramaCompleto(),
      documentosExigidos: { exigencias: [{ chave: 'rg', etapaChave: 'prova' }] },
    };
    const [, redacao] = etapasDoFormulario(documento);

    const editado = definirEtapas(documento, [redacao]);

    expect(editado.etapas?.map((etapa) => etapa.chave)).toEqual(['redacao']);
    expect(editado.documentosExigidos).toBe(documento.documentosExigidos);
  });

  it('a chave da etapa retirada segue tomada enquanto alguma referência a cita', () => {
    const documento: DocumentoDaConfiguracao = {
      ...umCronogramaCompleto(),
      motivos: [
        { etapaChave: 'prova', tipoCodigo: TipoDeDecisaoDoDocumento.CLASSIFICACAO, codigo: 'M' },
      ],
    };
    const [, redacao] = etapasDoFormulario(documento);

    const editado = acrescentarEtapa(definirEtapas(documento, [redacao]), 'Prova', {
      original: documento,
      criadas: [],
    });

    expect(editado.etapas?.at(-1)?.chave).toBe('prova-2');
  });

  it('o número fora do alcance não vai ao documento, nem como nulo: o campo sai', () => {
    const documento = umCronogramaCompleto();
    const [prova, redacao] = etapasDoFormulario(documento);

    const editado = definirEtapas(documento, [{ ...prova, peso: '9'.repeat(400) }, redacao]);

    expect(editado.etapas?.[0]).not.toHaveProperty('peso');
  });

  it('o peso lido volta como estava, e o digitado é interpretado', () => {
    const documento = umCronogramaCompleto();
    const [prova, redacao] = etapasDoFormulario(documento);

    const editado = definirEtapas(documento, [{ ...prova, peso: '2,5' }, redacao]);

    expect(editado.etapas?.map((etapa) => etapa.peso)).toEqual([2.5, 2]);
  });

  it('caráter e forma de avaliação vazios tiram o campo; escolhidos, entram', () => {
    const documento = umCronogramaCompleto();
    const [prova, redacao] = etapasDoFormulario(documento);

    const escolhidos = definirEtapas(documento, [
      {
        ...prova,
        carater: CaraterDaEtapa.eliminatoria,
        formaDeAvaliacao: FormaDeAvaliacaoDaEtapa.HUMANA,
      },
      redacao,
    ]);
    const vazios = definirEtapas(
      escolhidos,
      etapasDoFormulario(escolhidos).map((e) => ({ ...e, carater: '', formaDeAvaliacao: '' })),
    );

    expect(escolhidos.etapas?.[0]).toMatchObject({
      carater: 'eliminatoria',
      formaDeAvaliacao: 'HUMANA',
    });
    expect(vazios.etapas?.[0]).not.toHaveProperty('carater');
    expect(vazios.etapas?.[0]).not.toHaveProperty('formaDeAvaliacao');
  });

  it('a regra de consolidação escolhida entra com código e versão', () => {
    const documento = umCronogramaCompleto();
    const [prova, redacao] = etapasDoFormulario(documento);

    const editado = definirEtapas(documento, [
      { ...prova, regraDeConsolidacao: { codigo: 'CONSOLIDACAO', versao: 'v1' } },
      redacao,
    ]);

    expect(editado.etapas?.[0].regraConsolidacao).toEqual({ codigo: 'CONSOLIDACAO', versao: 'v1' });
  });

  it('documento sem etapas e formulário sem etapas não criam a lista', () => {
    const documento = documentoSemNada();

    expect(definirEtapas(documento, [])).toBe(documento);
  });
});

describe('acrescentar etapa', () => {
  it('põe a etapa no fim, depois da maior `ordem`, com chave tirada do nome', () => {
    const editado = acrescentarEtapa(umCronogramaCompleto(), 'Entrevista oral', {
      original: umCronogramaCompleto(),
      criadas: [],
    });

    expect(editado.etapas?.at(-1)).toEqual({ chave: 'entrevista-oral', ordem: 3 });
  });

  it('começa a `ordem` em 1 quando o documento ainda não tem etapa', () => {
    const editado = acrescentarEtapa(documentoSemNada(), 'Prova', {
      original: documentoSemNada(),
      criadas: [],
    });

    expect(editado.etapas).toEqual([{ chave: 'prova', ordem: 1 }]);
  });

  it('não repete a chave de outra etapa', () => {
    const editado = acrescentarEtapa(umCronogramaCompleto(), 'Prova', {
      original: umCronogramaCompleto(),
      criadas: [],
    });

    expect(editado.etapas?.at(-1)?.chave).toBe('prova-2');
  });
});
