import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  comDocumentosExigidos,
  documentoComExigencias,
  documentoDaRegra,
  idaEVolta,
  lidas,
  secaoDe,
} from './exigencias.testing';
import { exigenciasDoDocumento } from './leitura-das-exigencias-do-documento';

function exigenciaDeRendaNoDocumento() {
  const completo = documentoComExigencias();
  return secaoDe(completo).exigencias?.[1];
}

function semAlteracao(documento: DocumentoDaConfiguracao): void {
  const volta = idaEVolta(documento);
  expect(JSON.stringify(volta)).toBe(JSON.stringify(documento));
  expect(volta).toBe(documento);
}

describe('ida e volta das exigências de documento', () => {
  it('devolve o documento completo idêntico, como o mesmo objeto', () => {
    semAlteracao(documentoComExigencias());
  });

  it('devolve idêntico o grupo "ou" com consequência, norma e prazo próprios', () => {
    const documento = documentoComExigencias();
    const volta = idaEVolta(documento);

    expect(secaoDe(volta).regrasDeComprovacao?.[1]).toBe(
      secaoDe(documento).regrasDeComprovacao?.[1],
    );
    expect(lidas(documento).regrasDeComprovacao[1].consequencia).toBe('RETIRA_A_MODALIDADE');
  });

  it('devolve idêntica a quantidade mínima com distinção por competência', () => {
    semAlteracao(
      comDocumentosExigidos({
        exigencias: [
          {
            chave: 'exigencia_contracheque',
            tipoDocumentoCodigo: 'CONTRACHEQUE',
            faseChave: 'fase_inscricao',
            obrigatorio: true,
            abrePrazoParaReenvio: false,
          },
        ],
        regrasDeComprovacao: [
          {
            forma: 'DOCUMENTO',
            exigenciaChave: 'exigencia_contracheque',
            quantidadeMinima: 3,
            criterioDeDistincao: 'COMPETENCIA_MENSAL',
            criterioDeDistincaoRotulo: 'Competência mensal',
            dataReferencia: '2027-01-31',
          },
        ],
      }),
    );
  });

  it('devolve idêntica a repetição por grupo do formulário e a distinção por ocorrência', () => {
    const documento = comDocumentosExigidos({
      exigencias: [
        {
          chave: 'exigencia_comprovante_vinculo',
          tipoDocumentoCodigo: 'COMPROVANTE_VINCULO',
          faseChave: 'fase_inscricao',
          obrigatorio: true,
          abrePrazoParaReenvio: false,
        },
      ],
      regrasDeComprovacao: [
        {
          forma: 'DOCUMENTO',
          exigenciaChave: 'exigencia_comprovante_vinculo',
          grupoDoFormularioParaRepeticao: 'EMPREGOS',
          criterioDeDistincao: 'OCORRENCIA',
          ocorrenciasEsperadas: ['EMPREGO_1', 'EMPREGO_2'],
        },
      ],
    });

    semAlteracao(documento);
    expect(lidas(documento).regrasDeComprovacao[0].grupoDoFormularioParaRepeticao).toBe('EMPREGOS');
    expect(lidas(documento).regrasDeComprovacao[0].ocorrenciasEsperadas).toEqual([
      'EMPREGO_1',
      'EMPREGO_2',
    ]);
  });

  it('devolve idêntico o documento com duas regras que citam a mesma exigência', () => {
    const documento = comDocumentosExigidos({
      exigencias: [
        {
          chave: 'exigencia_rg',
          tipoDocumentoCodigo: 'RG',
          faseChave: 'fase_inscricao',
          obrigatorio: true,
          abrePrazoParaReenvio: false,
        },
      ],
      regrasDeComprovacao: [
        { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_rg' },
        {
          forma: 'TODOS_OS_ITENS',
          itens: [{ forma: 'DOCUMENTO', exigenciaChave: 'exigencia_rg' }],
        },
      ],
    });

    semAlteracao(documento);
    expect(secaoDe(idaEVolta(documento)).exigencias).toHaveLength(1);
  });

  it('devolve idêntico o documento com chave de exigência repetida', () => {
    const exigencia = {
      tipoDocumentoCodigo: 'RG',
      faseChave: 'fase_inscricao',
      obrigatorio: true,
      abrePrazoParaReenvio: false,
    };
    semAlteracao(
      comDocumentosExigidos({
        exigencias: [
          { ...exigencia, chave: 'exigencia_rg' },
          { ...exigencia, chave: 'exigencia_rg', faseChave: 'fase_habilitacao' },
        ],
        regrasDeComprovacao: [{ forma: 'DOCUMENTO', exigenciaChave: 'exigencia_rg' }],
      }),
    );
  });

  it('não mostra na tela a exigência que nenhuma regra cita, e a devolve como estava', () => {
    const documento = documentoComExigencias();
    const documentos = lidas(documento).regrasDeComprovacao.flatMap((regra) => [
      regra.documento?.chave,
      ...(regra.itens ?? []).map((item) => item.documento?.chave),
    ]);

    expect(documentos).not.toContain('exigencia_certidao_nascimento');
    expect(secaoDe(idaEVolta(documento)).exigencias?.[3]).toBe(secaoDe(documento).exigencias?.[3]);
  });

  it('preserva a regra que cita exigência sem correspondente, na mesma posição', () => {
    const documento = comDocumentosExigidos({
      exigencias: [
        {
          chave: 'exigencia_rg',
          tipoDocumentoCodigo: 'RG',
          faseChave: 'fase_inscricao',
          obrigatorio: true,
          abrePrazoParaReenvio: false,
        },
      ],
      regrasDeComprovacao: [
        { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_inexistente' },
        { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_rg' },
        { forma: 'DOCUMENTO' },
      ],
    });

    expect(lidas(documento).regrasDeComprovacao).toHaveLength(1);
    semAlteracao(documento);
  });

  it('devolve idênticas as condições com número, booleano, texto e lista', () => {
    const documento = documentoComExigencias();
    const condicoes = lidas(documento).regrasDeComprovacao[1].itens?.[0].documento?.condicoes;

    expect(condicoes?.map((condicao) => condicao.valor)).toEqual([
      '["LB_PPI"]',
      '1.5',
      '["LB_PPI"]',
      'true',
      '"PA"',
    ]);
    expect(condicoes?.map((condicao) => condicao.clausula)).toEqual([1, 1, 2, 2, 2]);
    semAlteracao(documento);
  });

  it('devolve idênticas a lista de condições vazia e a ausente', () => {
    const base = {
      tipoDocumentoCodigo: 'RG',
      faseChave: 'fase_inscricao',
      obrigatorio: true,
      abrePrazoParaReenvio: false,
    };
    semAlteracao(
      comDocumentosExigidos({
        exigencias: [
          { ...base, chave: 'exigencia_a', condicoes: [] },
          { ...base, chave: 'exigencia_b' },
        ],
        regrasDeComprovacao: [
          { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_a' },
          { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_b' },
        ],
      }),
    );
  });

  it('devolve idênticos os campos só de leitura e o identificador da parte', () => {
    const documento = documentoComExigencias();
    const volta = secaoDe(idaEVolta(documento)).exigencias?.[0];

    expect(volta).toBe(secaoDe(documento).exigencias?.[0]);
    expect(volta?.id).toBe('0196b3c2-8a10-7c3e-b5d2-6f1e4a9c2d71');
    expect(volta?.tipoDocumentoNome).toBe('Documento de identidade');
    expect(volta?.aplicabilidadeRotulo).toBe('Geral');
  });

  it('lê a exigência citada com a fase pelo tipo, a etapa pela chave e a posição da regra', () => {
    const [identidade, grupo] = lidas(documentoComExigencias()).regrasDeComprovacao;
    const [renda] = grupo.itens ?? [];
    const exigenciaDeRenda = documentoDaRegra(renda);

    expect([identidade.origem, grupo.origem, renda.origem]).toEqual([0, 1, 2]);
    expect(documentoDaRegra(identidade).faseCodigo).toBe('INSCRICAO');
    expect(exigenciaDeRenda.faseCodigo).toBe('HABILITACAO');
    expect(exigenciaDeRenda.etapaChave).toBe('etapa_analise');
    expect(exigenciaDeRenda.chave).toBe(exigenciaDeRendaNoDocumento()?.chave);
  });

  it('lê "vale em todas as fases" quando a mesma exigência está em cada fase', () => {
    const exigencia = { tipoDocumentoCodigo: 'RG', obrigatorio: true, abrePrazoParaReenvio: false };
    const documento = comDocumentosExigidos({
      exigencias: [
        { ...exigencia, chave: 'exigencia_rg', faseChave: 'fase_inscricao' },
        { ...exigencia, chave: 'exigencia_rg_2', faseChave: 'fase_habilitacao' },
      ],
      regrasDeComprovacao: [
        { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_rg' },
        { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_rg_2' },
      ],
    });

    expect(lidas(documento).emTodasAsFases).toEqual(['RG']);
    semAlteracao(documento);
  });
});

describe('impedimentos da leitura das exigências', () => {
  const exigencia = { tipoDocumentoCodigo: 'RG', obrigatorio: true, abrePrazoParaReenvio: false };

  it('aponta, pela posição no documento, a fase que o cronograma não tem', () => {
    const documento = comDocumentosExigidos({
      exigencias: [
        { ...exigencia, chave: 'exigencia_a', faseChave: 'fase_inscricao' },
        { ...exigencia, chave: 'exigencia_b', faseChave: 'fase_sumida' },
      ],
      regrasDeComprovacao: [
        { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_b' },
        { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_a' },
      ],
    });

    const leitura = exigenciasDoDocumento(documento);

    expect(leitura.ok).toBe(false);
    expect(!leitura.ok && leitura.impedimentos.map((i) => i.caminho)).toEqual([
      '/documentosExigidos/exigencias/1/faseChave',
    ]);
  });

  it('aponta as exigências cujo tipo de fase se repete, em ordem de posição', () => {
    const documento = comDocumentosExigidos(
      {
        exigencias: [
          { ...exigencia, chave: 'exigencia_a', faseChave: 'fase_b' },
          { ...exigencia, chave: 'exigencia_b', faseChave: 'fase_a' },
        ],
        regrasDeComprovacao: [
          { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_b' },
          { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_a' },
        ],
      },
      [
        { chave: 'fase_a', tipoFaseCodigo: 'INSCRICAO' },
        { chave: 'fase_b', tipoFaseCodigo: 'INSCRICAO' },
      ],
    );

    const leitura = exigenciasDoDocumento(documento);

    expect(!leitura.ok && leitura.impedimentos.map((i) => i.caminho)).toEqual([
      '/documentosExigidos/exigencias/0/faseChave',
      '/documentosExigidos/exigencias/1/faseChave',
    ]);
  });

  it('aponta a exigência citada que não informa a fase, em vez de escondê-la', () => {
    const documento = comDocumentosExigidos({
      exigencias: [{ ...exigencia, chave: 'exigencia_a' }],
      regrasDeComprovacao: [{ forma: 'DOCUMENTO', exigenciaChave: 'exigencia_a' }],
    });

    const leitura = exigenciasDoDocumento(documento);

    expect(!leitura.ok && leitura.impedimentos.map((i) => i.caminho)).toEqual([
      '/documentosExigidos/exigencias/0/faseChave',
    ]);
  });

  it('não impede por exigência que nenhuma regra cita', () => {
    const documento = comDocumentosExigidos({
      exigencias: [{ ...exigencia, chave: 'exigencia_a', faseChave: 'fase_sumida' }],
      regrasDeComprovacao: [],
    });

    expect(exigenciasDoDocumento(documento).ok).toBe(true);
  });

  it('lê o documento sem seção de exigências como vazio', () => {
    expect(lidas(comDocumentosExigidos({}))).toEqual({
      regrasDeComprovacao: [],
      emTodasAsFases: [],
    });
  });
});
