import { expect, test } from '@playwright/test';
import {
  aprovarCatalogoInicial,
  entrarComoPersona,
  OPERADOR_DO_ROTEIRO,
  prepararAcessosDaSimulacao,
} from '@uniplus/shared-e2e';
import { novoRascunhoParaATela } from '../fixtures/cenario-da-projecao';
import {
  FORMULARIO_DE_INSCRICAO,
  lerCodigosDosFormularios,
  lerDocumentosExigidos,
  nomeDoTipoDeDocumento,
  tipoDeDocumentoDoCatalogo,
} from '../support/api-dos-documentos-exigidos';
import {
  abrirAFaseDeInscricao,
  abrirOAssistente,
  acrescentarFormularioDeInscricao,
  conferirAvisoDeDocumentosPendentes,
  conferirRevisaoSemOBloqueioDeDocumentos,
  exigirDocumentoComNorma,
  gravarEAvancar,
} from '../support/passos-dos-documentos-na-ordem';

/**
 * A ordem do assistente pela tela: o Cronograma declara o documento antes de a fase ter
 * formulário, e a API só o aceita citando um formulário já gravado. Então o documento espera,
 * com aviso, e é gravado quando os Formulários são gravados.
 *
 * Roda com `E2E_BACKEND_REAL=1`, a stack da uniplus-api no ar e `E2E_ROTEIRO_DO_PROCESSO` com o
 * caminho de `scripts/roteiro-processo-teste-inscricao.sh` da API.
 *
 * ```bash
 * E2E_BACKEND_REAL=1 npx nx e2e selecao-e2e --project=selecao-backend-real
 * ```
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';
const TIPO_DO_DOCUMENTO = 'HISTORICO_ENSINO_MEDIO';

let nomeDoDocumento = '';
let tipoDoDocumentoId = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(900_000);
  await prepararAcessosDaSimulacao();
  await aprovarCatalogoInicial();
  nomeDoDocumento = await nomeDoTipoDeDocumento(TIPO_DO_DOCUMENTO);
  tipoDoDocumentoId = await tipoDeDocumentoDoCatalogo(TIPO_DO_DOCUMENTO);
});

test('o documento espera o formulário e é gravado quando os Formulários são gravados', async ({
  browser,
}, testInfo) => {
  const nome = `E2E documentos exigidos pela tela ${Date.now()}`;
  const { processoId } = await novoRascunhoParaATela(nome);
  const page = await entrarComoPersona(browser, APP, OPERADOR_DO_ROTEIRO, '/processo-seletivo');
  await abrirOAssistente(page, processoId);

  await abrirAFaseDeInscricao(page, testInfo);
  await exigirDocumentoComNorma(page, nomeDoDocumento);
  await gravarEAvancar(page);
  await conferirAvisoDeDocumentosPendentes(page, testInfo);
  expect(await lerDocumentosExigidos(processoId)).toHaveLength(0);

  await page
    .getByRole('navigation', { name: 'Etapas do cadastro' })
    .getByRole('button', { name: 'Formulários' })
    .click();
  await acrescentarFormularioDeInscricao(page, FORMULARIO_DE_INSCRICAO);
  await gravarEAvancar(page);

  await expect.poll(() => lerCodigosDosFormularios(processoId)).toContain(FORMULARIO_DE_INSCRICAO);
  const gravados = await lerDocumentosExigidos(processoId);
  expect(gravados).toHaveLength(1);
  expect(gravados[0].tipoDocumento.id).toBe(tipoDoDocumentoId);
  expect(gravados[0].momento).toMatchObject({ formularioCodigo: FORMULARIO_DE_INSCRICAO });

  await conferirRevisaoSemOBloqueioDeDocumentos(page, testInfo);
});
