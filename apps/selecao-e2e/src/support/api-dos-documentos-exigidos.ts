import { expect } from '@playwright/test';
import type {
  DefinirFormularioRequest,
  DocumentoExigidoDto,
  RegraDeComprovacaoInformada,
} from '@uniplus/shared-data/selecao';
import { chamarApi, OPERADOR_DO_ROTEIRO, type JsonDaApi } from '@uniplus/shared-e2e';

/**
 * Chamadas à API real dos documentos exigidos e dos formulários de um processo em rascunho, na
 * forma que o contrato declara, para as specs que provam a ordem em que o assistente grava os dois.
 */

export const FORMULARIO_DE_INSCRICAO = 'INSCRICAO';

const RAIZ = '/api/selecao/processos-seletivos';

export interface RecusaDaApi {
  readonly errors: readonly { readonly field: string; readonly code: string }[];
}

export type RegraEnviada = JsonDaApi<RegraDeComprovacaoInformada>;

type DocumentoEnviado = NonNullable<RegraEnviada['documento']>;

const INDEFERIMENTO: DocumentoEnviado['indeferimento'] = {
  obrigatorio: true,
  consequenciaDoDescumprimento: 'ELIMINA_DO_PROCESSO',
  basesLegais: [
    {
      referencia: 'Edital sintético de teste',
      abrangencia: 'INTERNA_EDITAL',
      situacao: 'RESOLVIDO',
      observacao: null,
    },
  ],
  abrePrazoParaReenvio: false,
};

const REQUISITOS: DocumentoEnviado['requisitos'] = {
  formatosPermitidos: 'QUALQUER',
  tamanhoMaximoBytes: null,
  prazoDeEmissao: {
    escolha: 'SEM_PRAZO',
    valor: null,
    unidade: null,
    referencia: null,
    efeitoForaDoPrazo: null,
  },
  validade: null,
  modelo: null,
};

const COMUM_AOS_DOCUMENTOS = {
  aplicabilidade: { tipo: 'GERAL', condicoes: [] },
  indeferimento: INDEFERIMENTO,
  requisitos: REQUISITOS,
} satisfies Partial<DocumentoEnviado>;

/** O documento exigido de um tipo, na fase e no formulário citado (texto vazio = sem formulário). */
export function regraDoDocumento(
  tipoId: string,
  faseId: string,
  formularioCodigo: string,
): RegraEnviada {
  const momento = { faseId, etapaId: null, formularioCodigo };
  return {
    forma: 'DOCUMENTO',
    documento: { ...COMUM_AOS_DOCUMENTOS, tipoDocumento: { id: tipoId }, momento },
  };
}

const PAGINA_DE_REVISAO: JsonDaApi<DefinirFormularioRequest>['paginas'][number] = {
  codigo: 'REVISAO',
  ordem: 1,
  tipo: 'BLOCO',
  bloco: 'REVISAO_E_ACEITE',
  apresentacao: { titulo: 'Revisão e aceite', descricao: null, aviso: null },
};

/** O formulário de inscrição, só com a página de revisão que a API aceita como mínimo. */
export function formularioDeInscricao(faseId: string): JsonDaApi<DefinirFormularioRequest> {
  return { faseId, titulo: null, obrigatorio: true, paginas: [PAGINA_DE_REVISAO] };
}

export function enviarDocumentosExigidos(processoId: string, regras: readonly RegraEnviada[]) {
  return chamarApi<RecusaDaApi | null>(
    OPERADOR_DO_ROTEIRO,
    'PUT',
    `${RAIZ}/${processoId}/documentos-exigidos`,
    { corpo: regras },
  );
}

export function gravarFormulario(
  processoId: string,
  codigo: string,
  corpo: JsonDaApi<DefinirFormularioRequest>,
) {
  return chamarApi<RecusaDaApi | null>(
    OPERADOR_DO_ROTEIRO,
    'PUT',
    `/api/selecao/admin/processos-seletivos/${processoId}/formularios/${codigo}`,
    { corpo },
  );
}

export function removerFormulario(processoId: string, codigo: string) {
  return chamarApi<RecusaDaApi | null>(
    OPERADOR_DO_ROTEIRO,
    'DELETE',
    `/api/selecao/admin/processos-seletivos/${processoId}/formularios/${codigo}`,
  );
}

export async function lerDocumentosExigidos(
  processoId: string,
): Promise<readonly JsonDaApi<DocumentoExigidoDto>[]> {
  const resposta = await chamarApi<{ documentosExigidos: JsonDaApi<DocumentoExigidoDto>[] }>(
    OPERADOR_DO_ROTEIRO,
    'GET',
    `${RAIZ}/${processoId}`,
  );
  expect(resposta.status).toBe(200);
  return resposta.corpo.documentosExigidos;
}

export async function lerCodigosDosFormularios(processoId: string): Promise<readonly string[]> {
  const resposta = await chamarApi<{ formularios: { codigo: string }[] }>(
    OPERADOR_DO_ROTEIRO,
    'GET',
    `${RAIZ}/${processoId}`,
  );
  expect(resposta.status).toBe(200);
  return resposta.corpo.formularios.map((formulario) => formulario.codigo);
}

interface TipoDoCatalogo {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

async function tipoDoCatalogo(codigo: string): Promise<TipoDoCatalogo> {
  const catalogo = await chamarApi<TipoDoCatalogo[]>(
    OPERADOR_DO_ROTEIRO,
    'GET',
    '/api/configuracao/tipos-documento?limit=100',
  );
  expect(catalogo.status).toBe(200);
  const tipo = catalogo.corpo.find((item) => item.codigo === codigo);
  if (tipo === undefined) throw new Error(`Tipo de documento ${codigo} não está no catálogo.`);
  return tipo;
}

export async function tipoDeDocumentoDoCatalogo(codigo: string): Promise<string> {
  return (await tipoDoCatalogo(codigo)).id;
}

/** O nome com que o catálogo mostra o tipo de documento na tela. */
export async function nomeDoTipoDeDocumento(codigo: string): Promise<string> {
  return (await tipoDoCatalogo(codigo)).nome;
}
