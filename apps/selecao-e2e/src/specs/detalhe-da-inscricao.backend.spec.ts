import { test, expect } from '@playwright/test';
import { entrarComoPersona } from '@uniplus/shared-e2e';
import { cenarioDaProjecao, type CenarioDaProjecao } from '../fixtures/cenario-da-projecao';

/**
 * Detalhe da inscrição e abertura do laudo (web#1334) contra a API real. A tela mostra o que a
 * API devolve e nada além: o item que a pessoa não pode ver não chega e não deixa marca.
 * Fernanda enviou o laudo médico (classe sensível); Erick não enviou arquivo.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';

test.describe('Detalhe da inscrição e comprovantes enviados', () => {
  let cenario: CenarioDaProjecao;
  let rota: string;

  test.beforeAll(async () => {
    test.setTimeout(900_000);
    cenario = await cenarioDaProjecao();
    rota = `/processo-seletivo/${cenario.processoId}/inscricoes/${cenario.fernanda.inscricaoId}`;
  });

  test('CEPS abre o laudo pelo acesso auditado', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', rota);

    await expect(pagina.getByRole('heading', { level: 2, name: 'Arquivos enviados' })).toBeVisible();
    const abrir = pagina.getByRole('button', { name: /^Abrir Laudo médico/ }).first();
    // O arquivo abre em outra aba direto no endereço assinado do armazenamento, que o navegador
    // baixa ou exibe: o que se confere é o pedido ao armazenamento e a resposta dele.
    const resposta = pagina.context().waitForEvent('response', {
      predicate: (r) => /localhost:9000\/.*X-Amz-Signature=/.test(r.url()),
      timeout: 20_000,
    });
    await abrir.click();

    expect((await resposta).status()).toBe(200);
    await expect(pagina.getByText('Arquivo não disponível')).toHaveCount(0);
  });

  test('sem a permissão de documentos sensíveis o laudo não aparece e nada indica a omissão', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'kevin.carvalho', rota);

    await expect(pagina.getByRole('heading', { level: 2, name: 'Respostas do formulário' })).toBeVisible();
    await expect(pagina.getByText('Laudo médico')).toHaveCount(0);
    await expect(pagina.getByRole('heading', { name: 'Arquivos enviados' })).toHaveCount(0);
    await expect(pagina.locator('main')).not.toContainText(/oculto|sem permiss|omitid/i);
  });

  test('sem a permissão de dados pessoais vê a oferta e a situação, sem nome nem CPF', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'leandro.viana', rota);

    await expect(pagina.getByRole('heading', { level: 2, name: 'Inscrição', exact: true })).toBeVisible();
    await expect(pagina.getByText(`${cenario.nomeDoProcesso} — inscrição enviada`)).toBeVisible();
    await expect(pagina.getByText('Oferta escolhida', { exact: true })).toBeVisible();
    await expect(pagina.getByText('Medicina').first()).toBeVisible();
    await expect(pagina.getByText('Enviada', { exact: false }).first()).toBeVisible();
    await expect(pagina.locator('main')).not.toContainText(/Fernanda|\*\*\*\.598|CPF/);
    await expect(pagina.getByText('Laudo médico')).toHaveCount(0);
  });

  test('avaliação cega não recebe nenhum nome, nem o social', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'leandro.viana', rota);

    await expect(pagina.getByRole('heading', { level: 2, name: 'Inscrição', exact: true })).toBeVisible();
    // Nenhum fato é público: o painel das respostas nem existe para quem só tem dados públicos.
    await expect(pagina.getByRole('heading', { name: 'Respostas do formulário' })).toHaveCount(0);
    await expect(pagina.locator('main')).not.toContainText(/Ariel|Drumond/);
  });

  test('resposta de seleção aparece pelo rótulo e a descrição fica na dica do campo', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', rota);

    await expect(pagina.getByText('Brasileiro nato')).toBeVisible();
    await expect(pagina.getByText('Mato Grosso do Sul').first()).toBeVisible();
    // A descrição do fato acompanha o rótulo do campo.
    await expect(pagina.getByText(/Nome pelo qual o candidato prefere ser identificado/)).toBeVisible();
  });

  test('abrir o detalhe faz uma única requisição, sem buscar o processo à parte', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', '/dashboard');
    const chamadas: string[] = [];
    pagina.on('request', (req) => {
      const { pathname } = new URL(req.url());
      if (pathname.startsWith('/api/selecao/')) chamadas.push(`${req.method()} ${pathname}`);
    });

    const respostaDoDetalhe = pagina.waitForResponse(
      (res) => res.request().method() === 'GET' && res.url().endsWith(`/inscricoes/${cenario.fernanda.inscricaoId}`),
    );
    await pagina.goto(rota);
    await respostaDoDetalhe;
    await expect(pagina.getByRole('heading', { level: 2, name: 'Respostas do formulário' })).toBeVisible();

    expect(chamadas).toEqual([
      `GET /api/selecao/processos-seletivos/${cenario.processoId}/inscricoes/${cenario.fernanda.inscricaoId}`,
    ]);
  });

  test('o detalhe não é pré-carregado a partir da listagem', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', '/dashboard');
    const consultasAoDetalhe: string[] = [];
    pagina.on('request', (req) => {
      if (req.url().includes(`/inscricoes/${cenario.fernanda.inscricaoId}`)) consultasAoDetalhe.push(req.url());
    });

    const respostaDaListagem = pagina.waitForResponse(
      (res) => res.request().method() === 'GET' && res.url().includes(`/processos-seletivos/${cenario.processoId}/inscricoes?`),
    );
    await pagina.goto(`/processo-seletivo/${cenario.processoId}/inscricoes`);
    await respostaDaListagem;
    const linha = pagina.getByRole('row', { name: /Ariel Drumond/ });
    await expect(linha).toBeVisible();
    await linha.hover();
    await linha.getByRole('link').first().focus();
    // A página já estava ociosa antes da interação: provar a ausência exige observar a rede por uma janela depois dela;
    // o que sair durante a interação fica com o listener acima.
    const preCarregou = await pagina
      .waitForRequest((req) => req.url().includes(`/inscricoes/${cenario.fernanda.inscricaoId}`), { timeout: 3_000 })
      .then(() => true, () => false);

    expect(preCarregou).toBe(false);
    expect(consultasAoDetalhe).toEqual([]);
  });

  test('acesso direto e recarregamento mostram a mesma inscrição', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', rota);
    await expect(pagina.getByRole('heading', { level: 2, name: 'Respostas do formulário' })).toBeVisible();

    await pagina.reload();

    await expect(pagina.getByRole('heading', { level: 2, name: 'Respostas do formulário' })).toBeVisible();
    await expect(pagina.getByText('Brasileiro nato')).toBeVisible();
  });

  test('na troca de inscrição nada da anterior permanece', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', rota);
    await expect(pagina.getByText('Fernanda Laura Nicole Drumond')).toBeVisible();

    await pagina.goto(`/processo-seletivo/${cenario.processoId}/inscricoes/${cenario.erick.inscricaoId}`);

    await expect(pagina.getByText('Erick Isaac Ramos')).toBeVisible();
    await expect(pagina.locator('main')).not.toContainText(/Fernanda|Drumond/);
    await expect(pagina.getByRole('heading', { name: 'Arquivos enviados' })).toHaveCount(0);
  });

  test('acesso ao laudo recusado pela API mostra "Arquivo não disponível"', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', rota);
    await pagina.route(/\/documentos\/arquivos\/[^/]+\/acesso$/, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ status: 404, title: 'Não encontrado', code: 'uniplus.nao_encontrado' }),
      }),
    );
    await expect(pagina.getByRole('heading', { level: 2, name: 'Arquivos enviados' })).toBeVisible();

    await pagina.getByRole('button', { name: /^Abrir Laudo médico/ }).first().click();

    await expect(pagina.getByText('Arquivo não disponível')).toBeVisible();
  });

  test('inscrição inexistente mostra "Inscrição não encontrada" com retorno à listagem', async ({ browser }) => {
    const pagina = await entrarComoPersona(
      browser,
      APP,
      'diogo.souza',
      `/processo-seletivo/${cenario.processoId}/inscricoes/01a00000-0000-7000-8000-000000000000`,
    );

    await expect(pagina.getByText('Inscrição não encontrada')).toBeVisible();
    await expect(pagina.getByRole('link', { name: /Voltar|inscrições/i }).first()).toBeVisible();
  });
});
