import { expect, test, type Locator, type Page } from '@playwright/test';
import { CAMPUS, responder, simularCampi, simularOfertas } from '../support/respostas-lentas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Os avisos de falha de leitura têm `display: contents` no host e decidem a visibilidade por dentro.
 *
 * O que cada verificação prova:
 * - `ariaSnapshot` e `toMatchAriaSnapshot` do Playwright NÃO leem a árvore de acessibilidade do
 *   Chromium. A injeção do Playwright (`generateAriaTree`, em `playwright-core`) percorre o DOM na
 *   página e calcula papéis e nomes com a própria implementação das regras de ARIA, usando o estilo
 *   computado só para decidir se há quebra entre blocos. Elas provam o que o DOM e as regras de ARIA
 *   do Playwright dizem: papéis, nomes, ordem e texto. Não provam que o Chromium expõe esses nós.
 * - A árvore real do navegador é conferida pelo protocolo (`Accessibility.getFullAXTree` numa sessão
 *   CDP): é ali que se vê se o host com `display: contents` entra como nó e se o `alert` e o
 *   `status` continuam expostos às tecnologias assistivas do Chromium.
 * - Nenhuma delas prova o que um leitor de tela fala: isso só a avaliação humana abaixo confere.
 *
 * Roteiro da avaliação humana (NVDA ou JAWS no Windows, VoiceOver no macOS com Safari e no
 * Chrome). `AVALIACAO_HUMANA=1` abre o navegador com as respostas lentas e mantém o navegador aberto para a pessoa
 * conduzir. Em cada passo, anotar o que foi falado, se o foco ficou onde se espera e se algo foi
 * dito duas vezes.
 *   A. Listagem dos campi (`/campi`)
 *      1. A página abre com o aviso "Não foi possível carregar os campi". Deve ser lido uma única vez,
 *         como alerta, mesmo o aviso tendo sido inserido pelo `@if` depois do primeiro quadro.
 *      2. Ativar "Tentar novamente" (Enter ou Espaço). Deve ser lido "Tentando novamente…" e o foco
 *         deve ficar no botão. O aviso da falha não deve ser lido de novo.
 *      3. Na falha repetida, deve ser lido "A nova tentativa também falhou.", com o foco no botão.
 *      4. Na tentativa que dá certo, o aviso sai e o foco vai ao título "Campi". Com o foco fora do
 *         botão, deve ser lido "Dados carregados." e o foco não deve se mover.
 *   B. Campo em drawer (`/ofertas-curso`, "Nova oferta de curso")
 *      5. Com o drawer aberto, a falha do campo "Curso" deve ser lida como alerta, e o botão
 *         "Tentar novamente" deve vir depois da mensagem na ordem de leitura.
 *      6. Ativar o botão. Deve ser lido "Recarregando cursos…" uma só vez, apesar de o aviso do campo
 *         e o aviso dos catálogos (atrás do drawer) mostrarem o mesmo estado. O aviso atrás do drawer
 *         não deve ser lido: o drawer modal deixa a página inerte.
 *      7. Em "Recarregar cursos" da listagem (com o drawer fechado), deve ser lido
 *         "Recarregando cursos…" e, no desfecho, "A nova tentativa de recarregar cursos também
 *         falhou." ou "Dados carregados.".
 *   C. Comprovante do candidato (`/inscricao/comprovante/<id>/<n>` no portal; não há caso automatizado
 *      aqui porque o portal pede sessão de candidato e dados de inscrição)
 *      8. Com a leitura do comprovante recusada, o aviso "Não foi possível abrir o comprovante" deve
 *         ser lido como alerta. Ativar "Tentar novamente".
 *      9. Enquanto a leitura corre, deve ser lido só "Tentando novamente…". O indicador de carregamento
 *         da página ("Carregando o comprovante…") NÃO deve ser lido junto: ele perde o `role="status"`
 *         enquanto o aviso está na tela.
 *     10. Quando o comprovante abre, o foco deve ir ao título do documento, e "Dados carregados." NÃO
 *         deve ser lido (o foco já foi levado ao resultado).
 *   D. Cada troca do `role="status"`
 *     11. Em qualquer dos casos acima, a cada mudança de fase (tentando, também falhou) deve ser
 *         anunciado o texto novo, mesmo quando o texto da fase anterior era igual. Conferir que não há
 *         silêncio na segunda falha seguida.
 */

interface NoDaArvore {
  readonly nodeId: string;
  readonly ignored?: boolean;
  readonly role?: { readonly value?: unknown };
  readonly name?: { readonly value?: unknown };
  readonly childIds?: readonly string[];
  readonly backendDOMNodeId?: number;
}

/** A árvore de acessibilidade do Chromium, lida por CDP, com busca dos nós por seletor do DOM. */
async function arvoreDoChromium(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('Accessibility.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: NoDaArvore[] };

  const idsDoDom = async (seletor: string): Promise<number[]> => {
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', {
      nodeId: root.nodeId,
      selector: seletor,
    });
    const descritos = await Promise.all(
      nodeIds.map((nodeId) => cdp.send('DOM.describeNode', { nodeId })),
    );
    return descritos.map(({ node }) => node.backendNodeId);
  };
  const ids = new Map<string, number[]>();
  for (const seletor of [
    'ui-falha-de-leitura',
    'ui-falha-de-leitura [role="alert"]',
    'ui-falha-de-leitura button',
    'ui-falha-de-leitura [role="status"]',
  ]) {
    ids.set(seletor, await idsDoDom(seletor));
  }
  await cdp.detach();

  const papel = (no?: NoDaArvore): string => String(no?.role?.value ?? '');
  const textosDe = (no?: NoDaArvore): string => {
    const filhos = (no?.childIds ?? []).map((id) => nodes.find((c) => c.nodeId === id));
    return filhos
      .map((filho) =>
        papel(filho) === 'StaticText' ? String(filho?.name?.value ?? '') : textosDe(filho),
      )
      .join(' ');
  };
  return {
    papel,
    textosDe,
    /** O nó exposto do primeiro elemento do DOM que casa com o seletor. */
    noDe: (seletor: string) =>
      nodes.find((no) => no.ignored !== true && no.backendDOMNodeId === ids.get(seletor)?.[0]),
    /** Todo nó da árvore, exposto ou ignorado, que representa um elemento que casa com o seletor. */
    nosDo: (seletor: string) =>
      nodes.filter(
        (no) =>
          no.backendDOMNodeId !== undefined && ids.get(seletor)?.includes(no.backendDOMNodeId),
      ),
  };
}

test.describe('Aviso de falha de leitura — árvore de acessibilidade', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('o host com display: contents não vira nó e o alerta segue na árvore', async ({ page }) => {
    await simularCampi(page, 'falha');
    await page.goto('/campi');
    const host = page.locator('ui-falha-de-leitura');
    const alerta = host.locator('ui-alerta-nova-tentativa');
    await expect(alerta.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();

    expect(await host.evaluate((no) => getComputedStyle(no).display)).toBe('contents');
    expect(await host.evaluate((no) => no.getBoundingClientRect().height)).toBe(0);
    await expect(host.getByRole('alert')).toContainText('Não foi possível carregar os campi');
    expect(await host.ariaSnapshot()).toBe(await alerta.ariaSnapshot());
    await expect(host).toMatchAriaSnapshot(`
      - alert:
        - paragraph: Não foi possível carregar os campi
        - paragraph: /.+/
      - button "Tentar novamente"
      - status
    `);
  });

  test('a árvore de acessibilidade do Chromium expõe alerta, botão e status do aviso', async ({
    page,
  }) => {
    await simularCampi(page, 'falha');
    await page.goto('/campi');
    await expect(
      page.locator('ui-falha-de-leitura').getByRole('button', { name: 'Tentar novamente' }),
    ).toBeVisible();

    const arvore = await arvoreDoChromium(page);
    const alerta = arvore.noDe('ui-falha-de-leitura [role="alert"]');
    const botao = arvore.noDe('ui-falha-de-leitura button');
    const situacao = arvore.noDe('ui-falha-de-leitura [role="status"]');

    expect(arvore.papel(alerta)).toBe('alert');
    expect(arvore.textosDe(alerta)).toContain('Não foi possível carregar os campi');
    expect(arvore.papel(botao)).toBe('button');
    expect(botao?.name?.value).toBe('Tentar novamente');
    expect(arvore.papel(situacao)).toBe('status');
  });

  test('com display: contents o Chromium não cria nó para o host, e com display: block cria', async ({
    page,
  }) => {
    await simularCampi(page, 'falha');
    await page.goto('/campi');
    await expect(
      page.locator('ui-falha-de-leitura').getByRole('button', { name: 'Tentar novamente' }),
    ).toBeVisible();

    const comContents = await arvoreDoChromium(page);
    expect(comContents.nosDo('ui-falha-de-leitura')).toHaveLength(0);

    await page.addStyleTag({ content: 'ui-falha-de-leitura { display: block !important; }' });
    const comBlock = await arvoreDoChromium(page);
    expect(comBlock.nosDo('ui-falha-de-leitura').length).toBeGreaterThan(0);
    expect(comBlock.papel(comBlock.noDe('ui-falha-de-leitura [role="alert"]'))).toBe('alert');
  });

  test('sem falha o host não tem conteúdo nem aparece na árvore', async ({ page }) => {
    await page.route(/\/api\/configuracao\/campi(\?.*)?$/, (route) =>
      responder(route, false, [CAMPUS]),
    );
    await page.goto('/campi');
    await expect(page.getByRole('cell', { name: 'MARABA', exact: true })).toBeVisible();

    const host = page.locator('ui-falha-de-leitura');
    await expect(host).toBeEmpty();
    expect(await host.ariaSnapshot()).toBe('');
  });

  test('a nova tentativa mantém o alerta e muda o texto da mesma região de status', async ({
    page,
  }) => {
    await simularCampi(page, 'falha');
    await page.goto('/campi');
    const host = page.locator('ui-falha-de-leitura');
    const situacao = host.getByRole('status');
    const regiao = await situacao.elementHandle();

    await host.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(situacao).toHaveText('Tentando novamente…');
    await expect(host.getByRole('alert')).toContainText('Não foi possível carregar os campi');
    await expect(host).toMatchAriaSnapshot(`
      - alert
      - button "Tentar novamente"
      - status: Tentando novamente…
    `);
    await expect(situacao).toHaveText('A nova tentativa também falhou.');
    expect(await regiao?.evaluate((no) => no.isConnected)).toBe(true);
    await expect(host.getByRole('button', { name: 'Tentar novamente' })).toBeFocused();
  });

  test('a nova tentativa que dá certo tira o alerta e leva o foco ao título', async ({ page }) => {
    await simularCampi(page, 'sucesso');
    await page.goto('/campi');
    const host = page.locator('ui-falha-de-leitura');

    await host.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(host.getByRole('status')).toHaveText('Tentando novamente…');
    await expect(host.getByRole('alert')).toHaveCount(0);

    await expect(page.getByRole('heading', { name: 'Campi', level: 2 })).toBeFocused();
    expect(await host.ariaSnapshot()).toBe('');
  });

  test('o campo do drawer e o aviso da listagem mostram a mesma leitura, sem nó extra', async ({
    page,
  }) => {
    await simularOfertas(page);
    await page.goto('/ofertas-curso');
    const aviso = page.locator('ui-lookup-alert');
    await expect(aviso.getByRole('button', { name: 'Recarregar cursos' })).toBeVisible();

    await page.getByRole('button', { name: 'Nova oferta de curso' }).first().click();
    const campo = page.locator('ui-falha-de-leitura-do-campo').first();
    await expect(campo.getByRole('alert')).toHaveText('Não foi possível carregar os cursos.');
    expect(await campo.evaluate((no) => getComputedStyle(no).display)).toBe('contents');
    await expect(campo).toMatchAriaSnapshot(`
      - alert: Não foi possível carregar os cursos.
      - button "Tentar novamente"
      - status
    `);

    await campo.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(campo.getByRole('status')).toHaveText('Recarregando cursos…');
    await expect(aviso.getByRole('status')).toHaveText('Recarregando cursos…');
    await expect(campo.getByRole('status')).toHaveText(
      'A nova tentativa de recarregar cursos também falhou.',
    );
    await expect(aviso.getByRole('status')).toHaveText(
      'A nova tentativa de recarregar cursos também falhou.',
    );
  });

  test('o botão do aviso dos catálogos tem a fonte da mensagem do aviso', async ({ page }) => {
    await simularOfertas(page);
    await page.goto('/ofertas-curso');
    const aviso = page.locator('ui-lookup-alert');
    const botao = aviso.getByRole('button', { name: 'Recarregar cursos' });
    await expect(botao).toBeVisible();

    const fonte = (alvo: Locator): Promise<string> =>
      alvo.evaluate((no) => getComputedStyle(no).fontSize);
    const medidas = {
      botao: await fonte(botao),
      mensagem: await fonte(aviso.locator('.alert__msg')),
    };
    expect(medidas.botao).toBe(medidas.mensagem);
  });

  test('o botão de nova tentativa só mostra o cursor de espera quando a leitura corre', async ({
    page,
  }) => {
    await simularCampi(page, 'falha');
    await page.goto('/campi');
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();

    const cursores = await page.evaluate(() => {
      const area = document.createElement('div');
      area.className = 'list-state__retry';
      const criar = (atributos: Record<string, string>): HTMLButtonElement => {
        const botao = document.createElement('button');
        botao.className = 'btn btn--secondary btn--sm';
        for (const [nome, valor] of Object.entries(atributos)) botao.setAttribute(nome, valor);
        area.append(botao);
        return botao;
      };
      const indisponivel = criar({ 'aria-disabled': 'true' });
      const ocupado = criar({ 'aria-disabled': 'true', 'aria-busy': 'true' });
      document.body.append(area);
      const medidos = {
        indisponivelSemEspera: getComputedStyle(indisponivel).cursor,
        ocupado: getComputedStyle(ocupado).cursor,
      };
      area.remove();
      return medidos;
    });
    expect(cursores).toEqual({ indisponivelSemEspera: 'not-allowed', ocupado: 'progress' });
  });
});
