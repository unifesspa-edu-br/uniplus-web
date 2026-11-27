import type {
  ConsequenciaDoDescumprimentoCodigo,
  TipoAbrangenciaCodigo,
  StatusBaseLegalCodigo,
} from '@uniplus/shared-data/selecao';
import type { AplicabilidadeCodigo } from '@uniplus/shared-data/selecao';
import type {
  FormaDeComprovacaoCodigo,
  RegraDeComprovacaoInformada,
  ItemDocumentoExigidoInput,
} from '@uniplus/shared-data/selecao';
import { expect, type Browser, type Page } from '@playwright/test';
import { chamarApi, entrarComoPersona, OPERADOR_DO_ROTEIRO } from '@uniplus/shared-e2e';

const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';
const BASES_LEGAIS = [
  {
    referencia: 'Edital nº XX/2026-CEPS/Unifesspa, itens 1.6 e 13',
    abrangencia:
      'INTERNA_EDITAL' satisfies `${TipoAbrangenciaCodigo}` as TipoAbrangenciaCodigo.INTERNA_EDITAL,
    situacao: 'RESOLVIDO' satisfies `${StatusBaseLegalCodigo}` as StatusBaseLegalCodigo.RESOLVIDO,
    observacao: null,
  },
];
type RegraNoTransporte = Omit<RegraDeComprovacaoInformada, 'forma' | 'documento'> & {
  forma: `${FormaDeComprovacaoCodigo}`;
  documento: Omit<ItemDocumentoExigidoInput, 'requisitos'> & {
    requisitos: NonNullable<ItemDocumentoExigidoInput['requisitos']>;
  };
};

function requisitosPendentes() {
  return {
    prazoDeEmissao: null,
    validade: null,
    formatosPermitidos: 'QUALQUER',
    tamanhoMaximoBytes: null,
    modelo: null,
  };
}

function indeferimentoPendente() {
  return {
    obrigatorio: true,
    consequenciaDoDescumprimento:
      'ELIMINA_DO_PROCESSO' satisfies `${ConsequenciaDoDescumprimentoCodigo}` as ConsequenciaDoDescumprimentoCodigo.ELIMINA_DO_PROCESSO,
    basesLegais: BASES_LEGAIS,
    abrePrazoParaReenvio: false,
  };
}

function documentoPendente(tipoId: string, faseId: string) {
  return {
    tipoDocumento: { id: tipoId },
    momento: { faseId, etapaId: null },
    aplicabilidade: { tipo: 'GERAL' as AplicabilidadeCodigo.GERAL, condicoes: [] },
    indeferimento: indeferimentoPendente(),
    requisitos: requisitosPendentes(),
  };
}

function regraPendente(tipoId: string, faseId: string): RegraNoTransporte {
  return {
    forma: 'DOCUMENTO',
    documento: documentoPendente(tipoId, faseId),
    cardinalidade: null,
    indeferimento: null,
    itens: null,
  };
}

export async function exigirTipoPendente(
  processoId: string,
  tipoId: string,
  faseId: string,
): Promise<void> {
  const resposta = await chamarApi<{ code: string }>(
    OPERADOR_DO_ROTEIRO,
    'PUT',
    `/api/selecao/processos-seletivos/${processoId}/documentos-exigidos`,
    { corpo: [regraPendente(tipoId, faseId)] },
  );
  verificarRecusa(resposta);
}

function verificarRecusa(resposta: { status: number; corpo: { code: string } }): void {
  expect(resposta.status).toBe(422);
  expect(resposta.corpo.code).toBe(
    'uniplus.selecao.documento_exigido.tipo_documento_com_protecao_pendente',
  );
}

async function abrirHabilitacao(pagina: Page): Promise<void> {
  await pagina.getByRole('button', { name: /^Cronograma/ }).click();
  await expect(pagina.getByRole('heading', { name: /Passo 5/ })).toBeVisible();
  await pagina.getByText('3. Habilitação', { exact: true }).click();
}

export async function conferirTipoPendente(
  browser: Browser,
  processoId: string,
  nome: string,
): Promise<void> {
  const pagina = await entrarComoPersona(
    browser,
    APP,
    OPERADOR_DO_ROTEIRO,
    `/processo-seletivo/${processoId}`,
  );
  await abrirHabilitacao(pagina);
  await verificarOpcaoPendente(pagina, nome);
}

async function verificarOpcaoPendente(pagina: Page, nome: string): Promise<void> {
  const seletor = pagina.getByRole('combobox', { name: /Documento a exigir/ });
  await seletor.scrollIntoViewIfNeeded();
  await seletor.fill(nome);

  const opcao = pagina.getByRole('option', {
    name: new RegExp(`${nome}.*aguarda a aprovação da proteção de dados`),
  });
  await expect(opcao).toBeVisible();
  await expect(opcao).toHaveAttribute('aria-disabled', 'true');
}
