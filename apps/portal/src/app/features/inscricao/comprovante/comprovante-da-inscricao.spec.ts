import { describe, expect, it } from 'vitest';
import type {
  ComprovanteInscricaoDto,
  FormularioRenderizavelDto,
} from '@uniplus/shared-data/selecao';

import {
  derivadosDoComprovante,
  documentosDoComprovante,
  envioDoComprovante,
  secoesDoComprovante,
} from './comprovante-da-inscricao';

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

  it('mostra o derivado que o formulário descreve, pelo rótulo e com o nome gravado do município', () => {
    const comprovante = {
      derivados: { MUNICIPIO_RESIDENCIA: { codigo: '2927408', rotulo: 'Salvador' } },
    } as unknown as ComprovanteInscricaoDto;

    expect(derivadosDoComprovante(formulario, comprovante)).toEqual([
      { rotulo: 'Município de residência', valor: 'Salvador' },
    ]);
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

describe('secoesDoComprovante: município', () => {
  const formulario = {
    etapas: [{ codigo: 'DADOS', ordem: 0, titulo: 'Dados do candidato' }],
    fatosColetados: [
      {
        fatoCodigo: 'NATURALIDADE_MUNICIPIO',
        ordem: 0,
        rotulo: 'Município de nascimento',
        etapaCodigo: 'DADOS',
        tipoRenderizacao: 'MUNICIPIO',
      },
    ],
    grupos: [
      {
        codigo: 'FAMILIA',
        ordem: 0,
        rotulo: 'Composição familiar',
        etapaCodigo: 'DADOS',
        incluiCandidato: false,
        subitens: [
          {
            fatoCodigo: 'MUNICIPIO_DO_INTEGRANTE',
            ordem: 0,
            rotulo: 'Município do integrante',
            tipoRenderizacao: 'MUNICIPIO',
          },
        ],
      },
    ],
    pressupostos: [],
  } as unknown as FormularioRenderizavelDto;
  const comprovanteCom = (naturalidade: unknown, integrante: unknown) =>
    ({
      respostas: { NATURALIDADE_MUNICIPIO: naturalidade },
      grupos: { FAMILIA: [{ id: 'a', respostas: { MUNICIPIO_DO_INTEGRANTE: integrante } }] },
      derivados: {},
    }) as unknown as ComprovanteInscricaoDto;

  it('mostra o município só pelo nome gravado, nas respostas e nos subitens de grupo', () => {
    const [secao] = secoesDoComprovante(
      formulario,
      comprovanteCom(
        { codigo: '2927408', rotulo: 'Salvador' },
        { codigo: '1501402', rotulo: 'Belém' },
      ),
    );

    expect(secao.respostas.map((r) => r.valor)).toEqual(['Salvador']);
    expect(secao.grupos[0].ocorrencias[0].respostas.map((r) => r.valor)).toEqual(['Belém']);
  });

  it('avisa que o nome não foi carregado quando o município vem só com o código', () => {
    const [secao] = secoesDoComprovante(formulario, comprovanteCom('2927408', '1501402'));

    expect(secao.respostas[0].valor).toBe('Nome do município não carregado (código IBGE 2927408)');
    expect(secao.grupos[0].ocorrencias[0].respostas[0].valor).toBe(
      'Nome do município não carregado (código IBGE 1501402)',
    );
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

  it('traduz a situação que o servidor devolve, e nunca mostra o código cru', () => {
    const doc = (situacao: string) => ({ ...documento(null), situacao });
    const comSituacoes = {
      grupos: {},
      documentos: [doc('DEPENDE_DE_FASE_POSTERIOR'), doc('QUALQUER_OUTRA')],
    } as unknown as ComprovanteInscricaoDto;

    expect(documentosDoComprovante(comSituacoes).map((d) => d.situacao)).toEqual([
      'Pode ser exigido, conforme uma fase posterior do processo',
      'A confirmar',
    ]);
  });

  it('diz a quem se refere a exigência repetida por integrante do grupo', () => {
    const documentos = documentosDoComprovante(comprovante, formulario);

    expect(documentos.map((d) => d.integrante)).toEqual(['Você (candidato)', 'Integrante 1', null]);
  });
});
