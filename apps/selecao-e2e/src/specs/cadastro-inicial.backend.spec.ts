import { test } from '@playwright/test';
import {
  entrarComoPersona,
  garantirConcessao,
  garantirPerfil,
  unidadeDoCertame,
} from '@uniplus/shared-e2e';
import {
  anexarEdital,
  escolherTipoDoProcesso,
  gravarProcesso,
  preencherIdentificacaoDoProcesso,
  verificarCamposAposGravacao,
  verificarRecusaDeArquivoInvalido,
} from '../support/passos-do-cadastro-inicial';

/**
 * Exercita o cadastro inicial do Processo Seletivo contra a API real: criação
 * do agregado, upload do edital direto ao storage por URL pré-assinada e
 * confirmação server-side. O que este teste cobre e o unitário não: CORS do
 * storage, a assinatura do PUT (o content type entra na assinatura), a permissão
 * exigida pelas rotas administrativas e o encadeamento real das três fases.
 *
 * Roda apenas com `E2E_BACKEND_REAL=1` e a stack do `uniplus-api` no ar — o CI
 * provisiona só o Keycloak. Como escreve de verdade (cria processo e sobe
 * arquivo), o ambiente alvo tem de ser descartável.
 *
 * ```bash
 * E2E_BACKEND_REAL=1 npx nx e2e selecao-e2e --project=selecao-backend-real
 * ```
 *
 * O acesso é por permissão efetiva na unidade dona do certame, o CEPS: criar o
 * processo exige `selecao:processos:configurar` e anexar o edital exige
 * `selecao:processos:publicar`. A spec entra como persona fictícia do portal e
 * garante, pelo fluxo real de pedido, um perfil com as duas permissões no CEPS.
 * O assistente também lê o catálogo de modelos de formulário da Configuração, que
 * é permissão institucional e, por isso, vai em perfil à parte: a API não deixa
 * um perfil misturar permissão de unidade com permissão institucional.
 *
 * A única dependência do ambiente é o roteiro da stack
 * (`scripts/roteiro-processo-teste-inscricao.sh` da uniplus-api), que cria o CEPS
 * com cidade — a API recusa a criação do processo sem ela. Sem o roteiro, a spec
 * falha dizendo isso.
 *
 * O conteúdo exercitado é o do certame de Medicina 2027 do CEPS — o mesmo que a
 * coleção Newman de cadastro monta chamando a API direto. Aqui ele passa pela
 * interface, que é o que a coleção não cobre.
 */

const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';

/** Persona fictícia do portal sem outra concessão nas specs de backend real. */
const PERSONA = 'helena.rezende';
const PERMISSOES = ['selecao:processos:configurar', 'selecao:processos:publicar'];
/** Institucional: o perfil não mistura com as de unidade. */
const PERMISSOES_INSTITUCIONAIS = ['configuracao:modelos-formulario:consultar'];

test.describe('Cadastro inicial do processo seletivo', () => {
  // O preparo de perfil e concessão é compartilhado e não é seguro rodar em dois workers ao mesmo tempo.
  test.describe.configure({ mode: 'serial' });

  let unidadeId = '';

  test.beforeAll(async () => {
    // O pedido de concessão passa por quatro personas e leva além dos 30 s padrão.
    test.setTimeout(180_000);
    unidadeId = await unidadeDoCertame();
    const perfilId = await garantirPerfil(
      'E2E cadastro inicial — Configuração e publicação do CEPS',
      'Perfil da spec do cadastro inicial: cria o processo e anexa o edital.',
      PERMISSOES,
    );
    await garantirConcessao(PERSONA, perfilId, unidadeId);
    const perfilInstitucional = await garantirPerfil(
      'E2E cadastro inicial — Consulta dos cadastros do assistente',
      'Perfil da spec do cadastro inicial: lê os cadastros que o assistente oferece.',
      PERMISSOES_INSTITUCIONAIS,
    );
    await garantirConcessao(PERSONA, perfilInstitucional, unidadeId);
  });

  test('cria o processo e anexa o edital pelo fluxo real de upload', async ({ browser }) => {
    const sufixo = `${Date.now()}`;
    const page = await entrarComoPersona(browser, APP, PERSONA, '/processo-seletivo/novo');

    await escolherTipoDoProcesso(page);
    await preencherIdentificacaoDoProcesso(page, sufixo, unidadeId);
    await gravarProcesso(page);
    await verificarCamposAposGravacao(page);
    await anexarEdital(page, sufixo);
  });

  /**
   * A recusa de formato acontece no cliente e impede a iniciação do documento, o passo que sela
   * um PDF como imutável. O campo do edital aparece para quem tem `selecao:processos:publicar`,
   * mesmo sem processo criado, então o teste vai direto à revisão e publicação.
   */
  test('recusa arquivo que não é PDF antes de qualquer requisição', async ({ browser }) => {
    const page = await entrarComoPersona(browser, APP, PERSONA, '/processo-seletivo/novo');
    await verificarRecusaDeArquivoInvalido(page);
  });
});
