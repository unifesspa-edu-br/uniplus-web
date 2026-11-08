import { test } from '@playwright/test';
import {
  entrarComoPersona,
  garantirConcessao,
  garantirPerfil,
  PDF_MINIMO,
  unidadeDoCertame,
} from '@uniplus/shared-e2e';
import { expect } from '../fixtures/auth.fixture';

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

    await expect(page.getByRole('heading', { level: 1, name: /Tipo do processo/i })).toBeVisible();

    // Passo 1 — o tipo vem do catálogo de Configuração; o rascunho guarda o UUID.
    const primeiroTipo = page.locator('.type-card').first();
    await expect(primeiroTipo).toBeVisible({ timeout: 15_000 });
    await primeiroTipo.click();
    await expect(primeiroTipo).toHaveClass(/is-selected/);
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Passo 2 — identificação, com o conteúdo do certame de Medicina: o mesmo
    // que a coleção Newman de cadastro monta pela API, aqui percorrido pela
    // interface.
    await expect(page.getByRole('heading', { level: 1, name: /Identificação/i })).toBeVisible();
    await page.locator('#f-nome').fill(`Medicina 2027 — CEPS — E2E ${sufixo}`);
    // O identificador legível é único entre processos: o sufixo da execução evita colidir com o
    // de uma rodada anterior contra o mesmo banco.
    await page.locator('#f-identificador').fill(`medicina-2027-e2e-${sufixo}`);

    // O CEPS administra o certame e tem cidade cadastrada pelo roteiro da stack: a API recusa a
    // criação sem ela (`ProcessoSeletivo.UnidadeAdministradoraSemCidade`). A opção é escolhida pelo
    // id resolvido na API, não pelo texto.
    const unidade = page.locator('#f-unidade');
    await expect(unidade.locator(`option[value="${unidadeId}"]`)).toHaveCount(1, { timeout: 15_000 });
    await unidade.selectOption(unidadeId);
    await page.locator('#f-origem').selectOption('inscricaoPropria');

    // O município que rege os prazos é declarado, não deduzido da unidade: o
    // servidor recusa a criação sem ele. A busca da Geo casa por trecho do
    // nome, não por prefixo — com "Mar" viriam vinte "…do Maranhão" antes de
    // Marabá aparecer, e a janela de resultados cortaria fora.
    await page.getByRole('combobox', { name: 'Município que rege os prazos' }).fill('Marabá');
    const opcaoMaraba = page.getByRole('option', { name: /^Marabá — PA$/ }).first();
    await expect(opcaoMaraba).toBeVisible({ timeout: 15_000 });
    await opcaoMaraba.click();

    // Concluir a identificação é o que cria o processo — o anexo do edital não
    // participa disso e vive no passo de publicação.
    //
    // O rótulo do avanço muda com o estado: enquanto não há processo criado ele diz "Gravar e
    // avançar", e só vira "Próximo" depois, quando o passo passa a ser navegação como os
    // outros. Esperar "Próximo" aqui é esperar o botão que só existe DEPOIS da gravação.
    await page.getByRole('button', { name: 'Gravar e avançar' }).click();

    // Nenhum destes campos é alterável depois de gravado — o contrato não expõe atualização
    // deles —, e por isso o passo confirma antes de enviar.
    await expect(page.getByRole('heading', { name: /Confirmar o cadastro/i })).toBeVisible();
    await page.getByRole('button', { name: 'Gravar processo' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: /Taxa de inscrição/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Criado o processo, os campos do comando não aceitam mais alteração.
    await page.getByRole('button', { name: 'Anterior' }).click();
    await expect(page.locator('#f-nome')).toBeDisabled();
    await expect(page.locator('#f-unidade')).toBeDisabled();
    await expect(page.locator('#f-origem')).toBeDisabled();
    // O identificador, ao contrário, continua editável enquanto o processo for rascunho.
    await expect(page.locator('#f-identificador')).toBeEnabled();

    // O edital é anexado na revisão e publicação, com o processo já existente.
    await page.getByRole('button', { name: /Revisão e publicação/i }).click();
    await page.locator('#f-file').setInputFiles({
      name: `edital-${sufixo}.pdf`,
      mimeType: 'application/pdf',
      buffer: PDF_MINIMO,
    });

    await expect(page.locator('.uni-uploader__item.is-success')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.uni-uploader__item .uni-uploader__item-meta')).toHaveText('Envio concluído');
    await expect(page.locator('.uni-uploader [role="progressbar"]')).toHaveAttribute('aria-valuenow', '100');
  });

  /**
   * A recusa de formato acontece no cliente e impede a iniciação do documento, o passo que sela
   * um PDF como imutável. O campo do edital aparece para quem tem `selecao:processos:publicar`,
   * mesmo sem processo criado, então o teste vai direto à revisão e publicação.
   */
  test('recusa arquivo que não é PDF antes de qualquer requisição', async ({ browser }) => {
    const page = await entrarComoPersona(browser, APP, PERSONA, '/processo-seletivo/novo');
    const requisicoesDeDocumento: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/documentos-a-publicar')) {
        requisicoesDeDocumento.push(req.url());
      }
    });

    const primeiroTipo = page.locator('.type-card').first();
    await expect(primeiroTipo).toBeVisible({ timeout: 15_000 });
    await primeiroTipo.click();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Todos os passos ficam montados no DOM, então sem esta âncora o teste
    // passaria mesmo que o avanço tivesse falhado.
    await expect(page.getByRole('heading', { level: 1, name: /Identificação/i })).toBeVisible();

    await page.getByRole('button', { name: /Revisão e publicação/i }).click();
    await page.locator('#f-file').setInputFiles({
      name: 'edital.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('conteudo qualquer', 'utf-8'),
    });

    await expect(page.getByRole('alert')).toContainText('Tipo de arquivo não permitido');
    expect(requisicoesDeDocumento).toEqual([]);
  });
});
