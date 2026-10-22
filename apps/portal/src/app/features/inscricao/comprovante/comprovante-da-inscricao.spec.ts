import { describe, expect, it } from 'vitest';
import type {
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
} from '@uniplus/shared-data/selecao';

import {
  derivadosDoComprovante,
  documentosDoComprovante,
  envioDoComprovante,
  municipiosDoComprovante,
  secoesDoComprovante,
} from './comprovante-da-inscricao';

const municipio = (fatoCodigo: string) => ({
  fatoCodigo,
  ordem: 0,
  rotulo: fatoCodigo,
  tipoRenderizacao: 'MUNICIPIO',
});

describe('municipiosDoComprovante', () => {
  it('reúne os códigos distintos dos campos de município, nos itens, nos grupos e nos derivados', () => {
    const formulario = {
      fatosColetados: [
        municipio('NATURALIDADE_MUNICIPIO'),
        { ...municipio('UF'), tipoRenderizacao: 'SELECAO_UNICA' },
      ],
      grupos: [{ codigo: 'DEPENDENTES', subitens: [municipio('MUNICIPIO_DO_DEPENDENTE')] }],
      // O derivado do sistema vem com o rótulo e o tipo que a versão congelou do catálogo.
      pressupostos: [
        {
          fatoCodigo: 'MUNICIPIO_RESIDENCIA',
          rotulo: 'Município de residência',
          tipoRenderizacao: 'MUNICIPIO',
          formato: null,
          valoresSelecionaveis: null,
          calculadoDe: ['ENDERECO_RESIDENCIAL'],
        },
      ],
    } as unknown as FormularioRenderizavelDto;
    const comprovante = {
      respostas: { NATURALIDADE_MUNICIPIO: '5002704', UF: 'MS' },
      grupos: {
        DEPENDENTES: [
          { id: 'm1', respostas: { MUNICIPIO_DO_DEPENDENTE: '3550308' } },
          { id: 'm2', respostas: { MUNICIPIO_DO_DEPENDENTE: '5002704' } },
        ],
      },
      derivados: { MUNICIPIO_RESIDENCIA: '1504208' },
    } as unknown as ComprovanteInscricaoDto;

    expect(municipiosDoComprovante(formulario, comprovante)).toEqual([
      '5002704',
      '3550308',
      '1504208',
    ]);
  });
});

describe('derivadosDoComprovante', () => {
  const formulario = {
    pressupostos: [
      {
        fatoCodigo: 'MUNICIPIO_RESIDENCIA',
        rotulo: 'Município de residência',
        tipoRenderizacao: 'MUNICIPIO',
        formato: null,
        valoresSelecionaveis: null,
        calculadoDe: ['ENDERECO_RESIDENCIAL'],
      },
    ],
  } as unknown as FormularioRenderizavelDto;

  it('mostra o derivado que o formulário descreve, pelo rótulo e com o nome do município', () => {
    const comprovante = {
      derivados: { MUNICIPIO_RESIDENCIA: '5002704' },
    } as unknown as ComprovanteInscricaoDto;

    expect(
      derivadosDoComprovante(formulario, comprovante, new Map([['5002704', 'Campo Grande — MS']])),
    ).toEqual([{ rotulo: 'Município de residência', valor: 'Campo Grande — MS' }]);
  });

  it('não mostra o derivado que nenhuma regra do processo cita, nem pelo código do fato', () => {
    const comprovante = {
      derivados: { MUNICIPIO_RESIDENCIA: '5002704', UF_RESIDENCIA: 'MS' },
    } as unknown as ComprovanteInscricaoDto;

    expect(derivadosDoComprovante(formulario, comprovante).map((d) => d.rotulo)).toEqual([
      'Município de residência',
    ]);
  });
});

describe('secoesDoComprovante', () => {
  const formulario = {
    etapas: [{ codigo: 'DADOS', ordem: 0, titulo: 'Dados do candidato' }],
    fatosColetados: [
      { fatoCodigo: 'NOME', ordem: 0, rotulo: 'Nome completo', etapaCodigo: 'DADOS' },
      { fatoCodigo: 'CPF', ordem: 1, rotulo: 'CPF', etapaCodigo: 'DADOS' },
      { fatoCodigo: 'SEXO', ordem: 2, rotulo: 'Sexo', etapaCodigo: 'DADOS' },
    ],
    grupos: [
      {
        codigo: 'FAMILIA',
        ordem: 0,
        rotulo: 'Composição familiar',
        etapaCodigo: 'DADOS',
        incluiCandidato: true,
        subitens: [{ fatoCodigo: 'RENDA', ordem: 0, rotulo: 'Renda', tipoRenderizacao: 'NUMERO' }],
      },
    ],
    pressupostos: [],
  } as unknown as FormularioRenderizavelDto;
  const comprovante = {
    respostas: { NOME: 'Fernanda Laura Nicole Drumond', CPF: '***.598.363-**', SEXO: 'F' },
    grupos: {
      FAMILIA: [
        { id: 'a', respostas: { PARENTESCO: 'FILHO', RENDA: 100 } },
        { id: 'b', respostas: { PARENTESCO: 'PROPRIO_CANDIDATO', RENDA: 200 } },
      ],
    },
    derivados: {},
  } as unknown as ComprovanteInscricaoDto;

  it('não repete nas respostas o nome e o CPF, que o cartão do candidato já mostra', () => {
    const [secao] = secoesDoComprovante(formulario, comprovante);

    expect(secao.respostas.map((r) => r.rotulo)).toEqual(['Sexo']);
  });

  it('dá a cada ocorrência de grupo o título do formulário', () => {
    const [secao] = secoesDoComprovante(formulario, comprovante);

    expect(secao.grupos[0].ocorrencias.map((o) => o.titulo)).toEqual([
      'Integrante 1',
      'Você (candidato)',
    ]);
  });
});

describe('envioDoComprovante', () => {
  const emitidos = [
    { numero: 1, instante: '2026-12-11T13:30:00Z' },
    { numero: 2, instante: '2026-12-12T09:00:00Z' },
  ];

  it('o último envio é o que vale; o anterior foi substituído pelo mais recente', () => {
    expect(envioDoComprovante(emitidos, 2)).toEqual({
      ordem: 2,
      total: 2,
      ehOQueVale: true,
      maisRecente: 2,
    });
    expect(envioDoComprovante(emitidos, 1)).toEqual({
      ordem: 1,
      total: 2,
      ehOQueVale: false,
      maisRecente: 2,
    });
  });
});

describe('documentosDoComprovante', () => {
  const formulario = {
    grupos: [{ codigo: 'FAMILIA', incluiCandidato: true }],
  } as unknown as FormularioRenderizavelDto;
  const documento = (ocorrenciaId: string | null) => ({
    exigenciaId: 'e1',
    tipoDocumentoCodigo: 'RENDA',
    nome: 'Comprovante de renda',
    obrigatorio: true,
    situacao: 'PENDENTE',
    ocorrenciaId,
    consequencia: null,
    arquivos: [],
  });
  const comprovante = {
    grupos: {
      FAMILIA: [
        { id: 'a', respostas: { PARENTESCO: 'PROPRIO_CANDIDATO' } },
        { id: 'b', respostas: { PARENTESCO: 'FILHO' } },
      ],
    },
    documentos: [documento('a'), documento('b'), documento(null)],
  } as unknown as ComprovanteInscricaoDto;

  it('diz a quem se refere a exigência repetida por integrante do grupo', () => {
    const documentos = documentosDoComprovante(comprovante, formulario);

    expect(documentos.map((d) => d.integrante)).toEqual(['Você (candidato)', 'Integrante 1', null]);
  });
});
