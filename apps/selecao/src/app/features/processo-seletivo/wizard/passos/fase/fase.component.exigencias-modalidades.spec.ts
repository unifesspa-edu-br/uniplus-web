import { TestBed } from '@angular/core/testing';
import { rotuloDoValor } from '@uniplus/shared-inscricao/formulario';
import { describe, expect, it } from 'vitest';

import { CatalogoDeDocumentos } from '../cronograma/catalogos/catalogo-de-documentos.service';
import { CatalogoDeFatos } from '../cronograma/catalogos/catalogo-de-fatos.service';
import { MODALIDADE } from '../../shared/gatilho-de-exigencia.testing';
import { VALORES_MODALIDADE, VALOR_UNICO } from '../../shared/valores-do-catalogo.testing';
import { RAMO_LEI_DE_COTAS } from '../vagas/composicao-de-vagas';
import { fase, ID_CPF, TIPOS_DOCUMENTO } from './fase.testing';
import { ID_RG, usarFase, type ContextoDaFase } from './fase-passo.testing';

const COM_NOME = 'ZZ_TESTE';
const ROTULO_COM_NOME = 'ZZ_TESTE — Modalidade de teste Alfa';
const SEM_NOME = 'ZZ_SEM_NOME';

describe('FasePassoComponent: modalidades como "código — nome"', () => {
  let store: ContextoDaFase['store'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let exigencias: ContextoDaFase['exigencias'];
  let gatilho: ContextoDaFase['gatilho'];
  let linhas: ContextoDaFase['linhas'];
  let celula: ContextoDaFase['celula'];

  usarFase((tela) => {
    ({ store, detectar, nativo, comCronograma, exigencias, gatilho, linhas, celula } = tela);
  });

  function ofertando(...modalidades: readonly { codigo: string; nome: string }[]): void {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ofertaCursoId: 'oferta-1',
          voBase: '100',
          pr: '0,5',
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711',
          regraDistribuicaoVersao: 'v1',
          ramoDaDistribuicao: RAMO_LEI_DE_COTAS,
          regraAjusteCodigo: 'AJUSTE-PADRAO',
          regraAjusteVersao: 'v1',
          referenciaReservaDemograficaId: 'ref-1',
          ajusteDoQuadro: null,
          modalidades: modalidades.map((m) => ({ id: `id-${m.codigo}`, ...m })),
          quadro: [],
        },
      ],
    });
  }

  function ofertandoAsDuas(): void {
    ofertando(
      { codigo: COM_NOME, nome: 'Modalidade de teste Alfa' },
      { codigo: SEM_NOME, nome: '' },
    );
    comCronograma(fase({}));
  }

  function exigindoCpfSoDe(...codigos: string[]): void {
    exigencias().alternarExigencia(ID_CPF, true);
    gatilho().definirModalidades(ID_CPF, codigos);
    detectar();
  }

  it('mostra o código e o nome na frase de a quem o documento se aplica', () => {
    ofertandoAsDuas();
    exigindoCpfSoDe(COM_NOME);

    expect(celula(linhas()[0], 'A quem se aplica')).toBe(`Modalidades ${ROTULO_COM_NOME}`);
  });

  it('mostra só o código quando a modalidade não tem nome', () => {
    ofertandoAsDuas();
    exigindoCpfSoDe(SEM_NOME);

    expect(celula(linhas()[0], 'A quem se aplica')).toBe(`Modalidades ${SEM_NOME}`);
  });

  it('descreve a condição de modalidade de outra forma com o rótulo, guardando o código', () => {
    ofertandoAsDuas();
    exigencias().alternarExigencia(ID_CPF, true);
    gatilho().escolherExigidoDe(ID_CPF, 'quem');
    gatilho().escreverCondicoes(ID_CPF, [
      { clausula: 1, fato: 'MODALIDADE', operador: 'IGUAL', valor: `"${COM_NOME}"` },
    ]);
    detectar();

    expect(celula(linhas()[0], 'A quem se aplica')).toBe(`Quem: Modalidade ${ROTULO_COM_NOME}`);
    expect(exigencias().exigenciaDoDocumento(ID_CPF).condicoes[0].valor).toBe(`"${COM_NOME}"`);
  });

  it('rotula as opções do filtro de público e mantém o código no valor', () => {
    ofertandoAsDuas();
    exigindoCpfSoDe(COM_NOME);

    const opcoes = Array.from(
      nativo.querySelectorAll<HTMLOptionElement>('#fase-AVALIACAO-doc-filtro option'),
    ).map((opcao) => [opcao.value, opcao.textContent?.trim()]);

    expect(opcoes).toContainEqual([`modalidade:${COM_NOME}`, `Candidato de ${ROTULO_COM_NOME}`]);
    expect(opcoes).toContainEqual([`modalidade:${SEM_NOME}`, `Candidato de ${SEM_NOME}`]);
  });

  it('oferece "quem deve entregar" com o rótulo e o código como valor', () => {
    ofertandoAsDuas();

    const opcoes = gatilho().modalidadesEscolhiveis()[0].options;

    expect(opcoes).toEqual([
      { value: COM_NOME, label: ROTULO_COM_NOME },
      { value: SEM_NOME, label: SEM_NOME },
    ]);
  });

  it('grava a restrição pelo código, nunca pelo rótulo', () => {
    ofertandoAsDuas();
    exigindoCpfSoDe(COM_NOME);

    expect(exigencias().exigenciaDoDocumento(ID_CPF).condicoes).toEqual([
      expect.objectContaining({ fato: 'MODALIDADE', valor: JSON.stringify([COM_NOME]) }),
    ]);
  });

  it('o primeiro código que o quadro cita define o rótulo, mesmo repetido em outra oferta', () => {
    ofertandoAsDuas();
    const [oferta] = store.draft().vagas.ofertas;
    store.patchObjectSection('vagas', {
      ofertas: [
        oferta,
        { ...oferta, modalidades: [{ id: 'id-outra', codigo: COM_NOME, nome: 'Outro nome' }] },
      ],
    });

    expect(exigencias().rotulosDasModalidades().get(COM_NOME)).toBe(ROTULO_COM_NOME);
  });

  /** O editor de condições mostra o valor de modalidade de qualquer fato cujos valores são modalidades. */
  it('o editor de condições rotula o valor do fato de modalidade e guarda o código', () => {
    TestBed.inject(CatalogoDeFatos).fatos.set([
      {
        ...MODALIDADE,
        codigo: 'MODALIDADE_CONVOCACAO',
        nome: 'Modalidade da convocação',
        cardinalidade: VALOR_UNICO,
        fonteValores: VALORES_MODALIDADE,
      },
    ]);
    ofertandoAsDuas();

    const fato = gatilho()
      .fatosDoGatilho()
      .find((f) => f.codigo === 'MODALIDADE_CONVOCACAO');

    expect(fato?.valores).toEqual([COM_NOME, SEM_NOME]);
    expect(fato && rotuloDoValor(fato, COM_NOME)).toBe(ROTULO_COM_NOME);
    expect(fato && rotuloDoValor(fato, SEM_NOME)).toBe(SEM_NOME);
  });

  it('com dois documentos, o filtro continua por código', () => {
    ofertandoAsDuas();
    TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set([
      ...TIPOS_DOCUMENTO,
      { ...TIPOS_DOCUMENTO[0], id: ID_RG, codigo: 'RG', nome: 'RG' },
    ]);
    exigencias().alternarExigencia(ID_RG, true);
    exigindoCpfSoDe(COM_NOME);

    const filtro = nativo.querySelector<HTMLSelectElement>('#fase-AVALIACAO-doc-filtro');
    if (filtro === null) throw new Error('o filtro de público não está na tela');
    filtro.value = `modalidade:${SEM_NOME}`;
    filtro.dispatchEvent(new Event('change'));
    detectar();

    expect(linhas().map((linha) => linha.querySelector('th')?.textContent?.trim())).toEqual(['RG']);
  });
});
