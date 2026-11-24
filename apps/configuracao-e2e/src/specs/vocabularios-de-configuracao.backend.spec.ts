import { expect, test } from '@playwright/test';
import { garantirOperadorDoRoteiro } from '@uniplus/shared-e2e';
import {
  COMPOSICAO,
  NATUREZA,
  REGRA,
  camposDaModalidade,
  criarModalidadePelaTela,
  modalidadeNaApi,
  removerModalidade,
  type ModalidadeGravada,
} from '../support/modalidade-real';
import { TELAS_COM_VOCABULARIO } from '../support/telas-com-vocabulario';
import {
  acharTermoNaLista,
  criarTermoPelaTela,
  escolherFormaDeAceite,
  removerTermo,
  termoNaApi,
} from '../support/termo-real';
import {
  comPagina,
  lerOpcoesDoVocabulario,
  lerVocabulario,
  type OpcaoDoVocabulario,
} from '../support/vocabularios-reais';

/**
 * Os enums de configuração pela API real: a tela oferece, em cada campo, o rótulo que o vocabulário
 * da API devolve e envia só o código. A persona é a que mantém todos os cadastros de configuração.
 * Os registros que a spec cria levam o instante da execução no código ou no nome e são removidos ao
 * fim; a base pode já ter dados.
 */
const EXECUCAO = Date.now();
/** A forma que o formulário já traz marcada: a spec escolhe outra, para a escolha ser da pessoa. */
const FORMA_DE_ACEITE_PADRAO = 'A_DEFINIR';

function escolhida(vocabulario: readonly OpcaoDoVocabulario[], codigo: string): OpcaoDoVocabulario {
  const opcao = vocabulario.find((o) => o.codigo === codigo);
  if (opcao === undefined) throw new Error(`O vocabulário não traz o código ${codigo}.`);
  return opcao;
}

test.beforeAll(async () => {
  test.setTimeout(600_000);
  await garantirOperadorDoRoteiro();
});

test.describe('Opções dos enums nas telas de configuração', () => {
  for (const tela of TELAS_COM_VOCABULARIO) {
    test(`${tela.nome}: cada campo oferece os rótulos que a API devolve`, async ({ browser }) => {
      await comPagina(browser, tela.rota, async (pagina) => {
        await tela.abrirFormulario(pagina);
        for (const campo of tela.campos) {
          const vocabulario = await lerVocabulario(campo.vocabulario);
          await expect
            .poll(() => lerOpcoesDoVocabulario(campo.localizar(pagina), vocabulario, campo.ler), {
              timeout: 20_000,
              message: 'As opções da tela devem ser as que a API devolve',
            })
            .toEqual(vocabulario.map(({ codigo, rotulo }) => ({ valor: codigo, texto: rotulo })));
        }
      });
    });
  }
});

test.describe('Modalidade de concorrência, da tela à API', () => {
  test.describe.configure({ mode: 'serial' });

  const codigo = `E2E_VOCABULARIO_${EXECUCAO}`;
  let gravada: ModalidadeGravada;
  let natureza: OpcaoDoVocabulario;
  let composicao: OpcaoDoVocabulario;
  let regra: OpcaoDoVocabulario;

  test.beforeAll(async () => {
    natureza = escolhida(await lerVocabulario('naturezas-legais'), NATUREZA);
    composicao = escolhida(await lerVocabulario('composicoes-vagas'), COMPOSICAO);
    regra = escolhida(await lerVocabulario('regras-remanejamento'), REGRA);
  });

  test.afterAll(async () => {
    await removerModalidade(codigo);
  });

  test('cria pela tela com os rótulos do vocabulário e grava só os códigos, com o remanejamento agrupado', async ({
    browser,
  }) => {
    await comPagina(browser, '/modalidades/novo', async (pagina) => {
      await criarModalidadePelaTela(pagina, codigo, { natureza, composicao, regra });
    });

    const lida = await modalidadeNaApi(codigo);
    expect(lida, `A modalidade ${codigo} deve estar na API`).toBeDefined();
    gravada = lida as ModalidadeGravada;
    expect(gravada.naturezaLegal).toEqual(natureza);
    expect(gravada.composicaoVagas).toEqual(composicao);
    expect(gravada.remanejamento).toEqual({ regra, destino: null, par: null, fallback: null });
  });

  test('reabre pela tela e mostra os rótulos das escolhas gravadas', async ({ browser }) => {
    await comPagina(browser, `/modalidades/${gravada.id}`, async (pagina) => {
      const campos = camposDaModalidade(pagina);
      for (const [select, opcao] of [
        [campos.natureza, natureza],
        [campos.composicao, composicao],
        [campos.regra, regra],
      ] as const) {
        await expect(select).toHaveValue(opcao.codigo);
        await expect(select.locator('option:checked')).toHaveText(opcao.rotulo);
      }
    });
  });
});

test.describe('Termo de consentimento, da tela à API', () => {
  const nome = `Termo de teste dos vocabulários ${EXECUCAO}`;

  test.afterAll(async () => {
    await removerTermo(nome);
  });

  test('cria pela tela com o rótulo da forma de aceite e a lista mostra o mesmo rótulo', async ({
    browser,
  }) => {
    const formas = await lerVocabulario('formas-aceite');
    const forma = escolherFormaDeAceite(formas, FORMA_DE_ACEITE_PADRAO);
    await comPagina(browser, '/termos-consentimento/novo', async (pagina) => {
      await criarTermoPelaTela(pagina, nome, forma);
      const linha = await acharTermoNaLista(pagina, nome);
      await expect(linha).toContainText(forma.rotulo);
    });

    const gravado = await termoNaApi(nome);
    expect(gravado?.formaAceiteRascunho).toEqual(forma);
  });
});
