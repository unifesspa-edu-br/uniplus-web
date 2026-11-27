import { expect, test } from '@playwright/test';
import { aprovarCatalogoInicial, prepararAcessosDaSimulacao } from '@uniplus/shared-e2e';
import { novoRascunhoComAFaseDeInscricao } from '../fixtures/cenario-da-projecao';
import {
  enviarDocumentosExigidos,
  FORMULARIO_DE_INSCRICAO,
  formularioDeInscricao,
  gravarFormulario,
  lerCodigosDosFormularios,
  lerDocumentosExigidos,
  regraDoDocumento,
  removerFormulario,
  tipoDeDocumentoDoCatalogo,
} from '../support/api-dos-documentos-exigidos';

/**
 * A ordem em que o assistente grava: o Cronograma vem antes dos Formulários, e a API só aceita um
 * documento exigido que cite um formulário já gravado na mesma fase, substituindo o conjunto
 * inteiro a cada envio. Cada teste parte de um processo em rascunho novo, com a fase de inscrição
 * e nenhum formulário.
 *
 * Roda com `E2E_BACKEND_REAL=1`, a stack da uniplus-api no ar e `E2E_ROTEIRO_DO_PROCESSO` com o
 * caminho de `scripts/roteiro-processo-teste-inscricao.sh` da API.
 */
const CODIGO_DA_RECUSA_SEM_FORMULARIO = 'uniplus.selecao.formulario_processo.codigo_obrigatorio';
const CODIGO_DA_RECUSA_DE_REMOCAO =
  'uniplus.selecao.formulario_processo.remocao_de_formulario_com_exigencia';
const TIPOS = ['HISTORICO_ENSINO_MEDIO', 'RG'];

let tiposIds: string[];

test.beforeAll(async () => {
  test.setTimeout(900_000);
  await prepararAcessosDaSimulacao();
  await aprovarCatalogoInicial();
  tiposIds = [];
  // Um de cada vez: dois pedidos de token ao mesmo tempo para a mesma pessoa fazem o Keycloak recusar um.
  for (const tipo of TIPOS) tiposIds.push(await tipoDeDocumentoDoCatalogo(tipo));
});

async function novoProcesso() {
  const nome = `E2E documentos exigidos na ordem do assistente ${Date.now()}`;
  return novoRascunhoComAFaseDeInscricao(nome);
}

function regras(faseId: string, formularioCodigo: string) {
  return tiposIds.map((tipoId) => regraDoDocumento(tipoId, faseId, formularioCodigo));
}

test('recusa documento sem formulário e não grava nenhum', async () => {
  const { processoId, faseDeInscricaoId } = await novoProcesso();

  const resposta = await enviarDocumentosExigidos(processoId, regras(faseDeInscricaoId, ''));

  expect(resposta.status).toBe(422);
  expect(resposta.corpo?.errors.map((erro) => erro.code)).toContain(
    CODIGO_DA_RECUSA_SEM_FORMULARIO,
  );
  expect(await lerDocumentosExigidos(processoId)).toHaveLength(0);
});

test('grava os documentos citando o formulário de inscrição depois de gravado', async () => {
  const { processoId, faseDeInscricaoId } = await novoProcesso();
  await enviarDocumentosExigidos(processoId, regras(faseDeInscricaoId, ''));

  const formulario = await gravarFormulario(
    processoId,
    FORMULARIO_DE_INSCRICAO,
    formularioDeInscricao(faseDeInscricaoId),
  );
  const envio = await enviarDocumentosExigidos(
    processoId,
    regras(faseDeInscricaoId, FORMULARIO_DE_INSCRICAO),
  );

  expect(formulario.status).toBe(204);
  expect(envio.status).toBe(204);
  const gravados = await lerDocumentosExigidos(processoId);
  expect(gravados.map((documento) => documento.tipoDocumento.id).sort()).toEqual(
    [...tiposIds].sort(),
  );
  for (const documento of gravados) {
    expect(documento.momento).toMatchObject({
      faseId: faseDeInscricaoId,
      formularioCodigo: FORMULARIO_DE_INSCRICAO,
    });
  }
});

test('o envio substitui o conjunto inteiro, e a lista vazia o esvazia', async () => {
  const { processoId, faseDeInscricaoId } = await novoProcesso();
  await gravarFormulario(
    processoId,
    FORMULARIO_DE_INSCRICAO,
    formularioDeInscricao(faseDeInscricaoId),
  );
  const primeiroEnvio = await enviarDocumentosExigidos(
    processoId,
    regras(faseDeInscricaoId, FORMULARIO_DE_INSCRICAO),
  );
  expect(primeiroEnvio.status).toBe(204);
  expect(await lerDocumentosExigidos(processoId)).toHaveLength(tiposIds.length);

  const reenvioDeUm = await enviarDocumentosExigidos(
    processoId,
    regras(faseDeInscricaoId, FORMULARIO_DE_INSCRICAO).slice(0, 1),
  );
  expect(reenvioDeUm.status).toBe(204);
  const restantes = await lerDocumentosExigidos(processoId);
  expect(restantes.map((documento) => documento.tipoDocumento.id)).toEqual([tiposIds[0]]);

  const vazio = await enviarDocumentosExigidos(processoId, []);
  expect(vazio.status).toBe(204);
  expect(await lerDocumentosExigidos(processoId)).toHaveLength(0);
});

test('recusa remover o formulário que entrega documento exigido', async () => {
  const { processoId, faseDeInscricaoId } = await novoProcesso();
  await gravarFormulario(
    processoId,
    FORMULARIO_DE_INSCRICAO,
    formularioDeInscricao(faseDeInscricaoId),
  );
  await enviarDocumentosExigidos(processoId, regras(faseDeInscricaoId, FORMULARIO_DE_INSCRICAO));

  const remocao = await removerFormulario(processoId, FORMULARIO_DE_INSCRICAO);

  expect(remocao.status).toBe(422);
  expect(remocao.corpo?.errors.map((erro) => erro.code)).toContain(CODIGO_DA_RECUSA_DE_REMOCAO);
  expect(await lerCodigosDosFormularios(processoId)).toContain(FORMULARIO_DE_INSCRICAO);
  expect(await lerDocumentosExigidos(processoId)).toHaveLength(tiposIds.length);
});
