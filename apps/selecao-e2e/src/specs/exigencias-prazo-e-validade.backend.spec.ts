import { expect, test } from '@playwright/test';
import {
  aprovarCatalogoInicial,
  chamarApi,
  OPERADOR_DO_ROTEIRO,
  prepararAcessosDaSimulacao,
} from '@uniplus/shared-e2e';
import type {
  AplicabilidadeCodigo,
  FinalidadeFormularioCodigo,
  FormaDeComprovacaoCodigo,
  ItemDocumentoExigidoInput,
  RegraDeComprovacaoInformada,
  PrazoDeEmissaoInput,
  ValidadeDoDocumentoInput,
  RequisitosDoDocumentoDto,
  EscolhaDoPrazoDeEmissaoCodigo,
  UnidadeDoPrazoDeEmissaoCodigo,
  TipoDaDataDeReferenciaCodigo,
  EfeitoNaAnaliseDoDocumentoCodigo,
  EscolhaDaValidadeCodigo,
} from '@uniplus/shared-data/selecao';
import { rascunhoParaConfiguracao } from '../fixtures/cenario-da-projecao';

type ReferenciaNoTransporte = {
  tipo: `${TipoDaDataDeReferenciaCodigo}`;
  data: string | null;
  faseId: string | null;
};
type PrazoNoTransporte = Omit<
  PrazoDeEmissaoInput,
  'escolha' | 'unidade' | 'referencia' | 'efeitoForaDoPrazo'
> & {
  escolha: `${EscolhaDoPrazoDeEmissaoCodigo}`;
  unidade: `${UnidadeDoPrazoDeEmissaoCodigo}` | null;
  referencia: ReferenciaNoTransporte | null;
  efeitoForaDoPrazo: `${EfeitoNaAnaliseDoDocumentoCodigo}` | null;
};
type ValidadeNoTransporte = Omit<
  ValidadeDoDocumentoInput,
  'escolha' | 'referencia' | 'efeitoDoVencimento'
> & {
  escolha: `${EscolhaDaValidadeCodigo}`;
  referencia: ReferenciaNoTransporte | null;
  efeitoDoVencimento: `${EfeitoNaAnaliseDoDocumentoCodigo}` | null;
};
type RegraNoTransporte = Omit<RegraDeComprovacaoInformada, 'forma' | 'documento'> & {
  forma: `${FormaDeComprovacaoCodigo}`;
  documento: Omit<ItemDocumentoExigidoInput, 'requisitos'> & {
    requisitos: Omit<
      NonNullable<ItemDocumentoExigidoInput['requisitos']>,
      'prazoDeEmissao' | 'validade'
    > & {
      prazoDeEmissao: PrazoNoTransporte;
      validade: ValidadeNoTransporte | null;
    };
  };
};

const BASES_LEGAIS = [
  {
    referencia: 'Edital sintético de teste',
    abrangencia: 'INTERNA_EDITAL',
    situacao: 'RESOLVIDO',
    observacao: null,
  },
];
const SEM_PRAZO: PrazoNoTransporte = {
  escolha: 'SEM_PRAZO',
  valor: null,
  unidade: null,
  referencia: null,
  efeitoForaDoPrazo: null,
};
let processoId: string;
let faseId: string;
let tipoId: string;

function prazoComReferencia(referencia: ReferenciaNoTransporte): PrazoNoTransporte {
  return {
    escolha: 'COM_PRAZO',
    valor: 30,
    unidade: 'DIAS',
    referencia,
    efeitoForaDoPrazo: 'RECUSAR_DOCUMENTO',
  };
}

function requisitos(
  prazoDeEmissao: PrazoNoTransporte,
  validade: ValidadeNoTransporte | null,
): RegraNoTransporte['documento']['requisitos'] {
  return {
    prazoDeEmissao,
    validade,
    formatosPermitidos: 'QUALQUER',
    tamanhoMaximoBytes: null,
    modelo: null,
  };
}

function documento(prazo: PrazoNoTransporte, validade: ValidadeNoTransporte | null) {
  return {
    tipoDocumento: { id: tipoId },
    momento: {
      faseId,
      etapaId: null,
      finalidade: 'HABILITACAO' as FinalidadeFormularioCodigo.HABILITACAO,
    },
    aplicabilidade: { tipo: 'GERAL' as AplicabilidadeCodigo.GERAL, condicoes: [] },
    indeferimento: { obrigatorio: true, consequencia: 'ELIMINA', basesLegais: BASES_LEGAIS },
    requisitos: requisitos(prazo, validade),
  };
}

async function gravar(prazo: PrazoNoTransporte, validade: ValidadeNoTransporte | null = null) {
  const regra: RegraNoTransporte = {
    forma: 'DOCUMENTO',
    cardinalidade: null,
    indeferimento: null,
    itens: null,
    documento: documento(prazo, validade),
  };
  return chamarApi(
    OPERADOR_DO_ROTEIRO,
    'PUT',
    `/api/selecao/processos-seletivos/${processoId}/documentos-exigidos`,
    { corpo: [regra] },
  );
}

async function lerRequisitos(): Promise<RequisitosDoDocumentoDto> {
  const resposta = await chamarApi<{
    documentosExigidos: {
      tipoDocumento: { id: string };
      requisitos: RequisitosDoDocumentoDto;
    }[];
  }>(OPERADOR_DO_ROTEIRO, 'GET', `/api/selecao/processos-seletivos/${processoId}`);
  expect(resposta.status).toBe(200);
  const documento = resposta.corpo.documentosExigidos.find(
    (item) => item.tipoDocumento.id === tipoId,
  );
  if (documento === undefined) throw new Error('Documento exigido não encontrado.');
  return documento.requisitos;
}

async function preparar(): Promise<void> {
  await prepararAcessosDaSimulacao();
  await aprovarCatalogoInicial();
  ({ processoId, faseHabilitacaoId: faseId } = await rascunhoParaConfiguracao());
  const catalogo = await chamarApi<{ id: string; codigo: string }[]>(
    OPERADOR_DO_ROTEIRO,
    'GET',
    '/api/configuracao/tipos-documento?limit=100',
  );
  expect(catalogo.status).toBe(200);
  const tipo = catalogo.corpo.find((item) => item.codigo === 'HISTORICO_ENSINO_MEDIO');
  if (tipo === undefined) throw new Error('Tipo de documento do catálogo não encontrado.');
  tipoId = tipo.id;
}

test.beforeAll(async () => {
  test.setTimeout(900_000);
  await preparar();
});

const VALIDADE: ValidadeNoTransporte = {
  escolha: 'EXIGE_DOCUMENTO_VALIDO',
  referencia: { tipo: 'DATA_DA_APRESENTACAO', data: null, faseId: null },
  efeitoDoVencimento: 'ACEITAR_COM_AVISO',
};
const VALIDADE_ESPERADA = {
  escolha: { codigo: 'EXIGE_DOCUMENTO_VALIDO' },
  referencia: { tipo: { codigo: 'DATA_DA_APRESENTACAO' }, data: null, faseId: null },
  efeitoDoVencimento: { codigo: 'ACEITAR_COM_AVISO' },
};
const PRAZO_ESPERADO = {
  escolha: { codigo: 'COM_PRAZO' },
  valor: 30,
  unidade: { codigo: 'DIAS' },
  efeitoForaDoPrazo: { codigo: 'RECUSAR_DOCUMENTO' },
};

test('grava prazo referido à fase e validade na apresentação', async () => {
  const prazo = prazoComReferencia({ tipo: 'INICIO_DA_FASE', data: null, faseId });
  expect((await gravar(prazo, VALIDADE)).status).toBe(204);
  const requisitos = await lerRequisitos();
  expect(requisitos.prazoDeEmissao).toMatchObject({
    ...PRAZO_ESPERADO,
    referencia: { tipo: { codigo: 'INICIO_DA_FASE' }, data: null, faseId },
  });
  expect(requisitos.validade).toMatchObject(VALIDADE_ESPERADA);
});

test('grava prazo referido a uma data específica', async () => {
  const prazo = prazoComReferencia({ tipo: 'DATA_ESPECIFICA', data: '2027-01-15', faseId: null });
  expect((await gravar(prazo)).status).toBe(204);
  expect((await lerRequisitos()).prazoDeEmissao).toMatchObject({
    ...PRAZO_ESPERADO,
    referencia: { tipo: { codigo: 'DATA_ESPECIFICA' }, data: '2027-01-15', faseId: null },
  });
});

test('grava a escolha sem prazo', async () => {
  expect((await gravar(SEM_PRAZO)).status).toBe(204);
  expect((await lerRequisitos()).prazoDeEmissao).toMatchObject({
    escolha: { codigo: 'SEM_PRAZO' },
    valor: null,
    unidade: null,
    referencia: null,
    efeitoForaDoPrazo: null,
  });
});

test('recusa a escolha em camelCase', async () => {
  const prazo = prazoComReferencia({ tipo: 'INICIO_DA_FASE', data: null, faseId });
  const corpo = [
    {
      forma: 'DOCUMENTO',
      cardinalidade: null,
      indeferimento: null,
      itens: null,
      documento: {
        ...documento(prazo, null),
        requisitos: {
          ...requisitos(prazo, null),
          prazoDeEmissao: { ...prazo, escolha: 'comPrazo' },
        },
      },
    },
  ];
  const resposta = await chamarApi<{ errors: { field: string; code: string }[] }>(
    OPERADOR_DO_ROTEIRO,
    'PUT',
    `/api/selecao/processos-seletivos/${processoId}/documentos-exigidos`,
    { corpo },
  );
  expect(resposta.status).toBe(422);
  expect(resposta.corpo.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        field: 'regrasDeComprovacao[0].documento.requisitos.prazoDeEmissao.escolha',
        code: 'uniplus.selecao.prazo_de_emissao.escolha_invalida',
      }),
    ]),
  );
});
