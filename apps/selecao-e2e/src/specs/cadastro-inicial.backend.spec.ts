import { expect, test } from '../fixtures/auth.fixture';

/**
 * Exercita o cadastro inicial do Processo Seletivo contra a API real: criação
 * do agregado, upload do edital direto ao storage por URL pré-assinada e
 * confirmação server-side. O que este teste cobre e o unitário não: CORS do
 * storage, a assinatura do PUT (o content type entra na assinatura), o papel
 * exigido pelas rotas administrativas e o encadeamento real das três fases.
 *
 * Roda apenas com `E2E_BACKEND_REAL=1` e a stack do `uniplus-api` no ar — o CI
 * provisiona só o Keycloak. Como escreve de verdade (cria processo e sobe
 * arquivo), o ambiente alvo tem de ser descartável.
 *
 * ```bash
 * E2E_BACKEND_REAL=1 npx nx e2e selecao-e2e --project=selecao-backend-real
 * ```
 *
 * Duas dependências do ambiente, ambas verificáveis no seed:
 * a unidade administradora escolhida precisa ter cidade cadastrada, e o papel
 * administrativo precisa chegar no token do client `selecao-web`.
 *
 * O conteúdo exercitado é o do certame de Medicina 2027 do CEPS — o mesmo que a
 * coleção Newman de cadastro monta chamando a API direto. Aqui ele passa pela
 * interface, que é o que a coleção não cobre.
 */

/** PDF mínimo válido: a API confere a assinatura `%PDF-` do conteúdo. */
const PDF_MINIMO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
  'utf-8',
);

test.describe('Cadastro inicial do processo seletivo', () => {
  test('cria o processo e anexa o edital pelo fluxo real de upload', async ({ page }) => {
    const sufixo = `${Date.now()}`;

    await page.goto('/processo-seletivo/novo');
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
    await page.locator('#f-num').fill(`${sufixo.slice(-3)}/2026`);
    await page.locator('#f-ano').fill('2026');
    await page.locator('#f-data').fill('2026-09-23');
    await page.locator('#f-orgao').fill('CEPS');
    await page.locator('#f-periodo').selectOption('1º semestre');
    await page.locator('#f-nome').fill(`Medicina 2027 — CEPS — E2E ${sufixo}`);

    // A unidade precisa ter cidade cadastrada: a API recusa a criação sem ela
    // (`ProcessoSeletivo.UnidadeAdministradoraSemCidade`). A Pró-Reitoria de
    // Ensino de Graduação, em Marabá, é a administradora do certame.
    const unidade = page.locator('#f-unidade');
    const opcaoComCidade = unidade.locator('option', { hasText: 'PROEG' });
    await expect(opcaoComCidade).toHaveCount(1, { timeout: 15_000 });
    // O value é o UUID da unidade, gerado pelo seed — daí a leitura, em vez de
    // um valor fixo no teste.
    const valorUnidade = await opcaoComCidade.evaluate(
      (option) => (option as HTMLOptionElement).value,
    );
    expect(valorUnidade).toBeTruthy();
    await unidade.selectOption(valorUnidade);
    await page.locator('#f-origem').selectOption('inscricaoPropria');

    // Anexar dispara criação + iniciação + PUT no storage + confirmação.
    await page.locator('#f-file').setInputFiles({
      name: `edital-${sufixo}.pdf`,
      mimeType: 'application/pdf',
      buffer: PDF_MINIMO,
    });

    await expect(page.locator('.file-status')).toHaveText('Edital anexado', { timeout: 30_000 });
    await expect(page.locator('.file-progress')).toHaveAttribute('aria-valuenow', '100');

    // Criado o processo, os campos do comando não aceitam mais alteração.
    await expect(page.locator('#f-nome')).toBeDisabled();
    await expect(page.locator('#f-unidade')).toBeDisabled();
    await expect(page.locator('#f-origem')).toBeDisabled();

    // Com o edital confirmado, o passo libera o avanço.
    await page.getByRole('button', { name: 'Próximo' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Modalidades/i })).toBeVisible();
  });

  test('recusa arquivo que não é PDF antes de qualquer requisição', async ({ page }) => {
    const requisicoesDeCriacao: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/selecao/processos-seletivos')) {
        requisicoesDeCriacao.push(req.url());
      }
    });

    await page.goto('/processo-seletivo/novo');
    const primeiroTipo = page.locator('.type-card').first();
    await expect(primeiroTipo).toBeVisible({ timeout: 15_000 });
    await primeiroTipo.click();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Todos os passos ficam montados no DOM, então sem esta âncora o teste
    // passaria mesmo que o avanço tivesse falhado.
    await expect(page.getByRole('heading', { level: 1, name: /Identificação/i })).toBeVisible();

    await page.locator('#f-file').setInputFiles({
      name: 'edital.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('conteudo qualquer', 'utf-8'),
    });

    await expect(page.getByRole('alert')).toContainText('deve ser um arquivo PDF');
    expect(requisicoesDeCriacao).toEqual([]);
  });
});
