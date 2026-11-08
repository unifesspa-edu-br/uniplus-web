import { test, expect } from '@playwright/test';
import { chamarApi, entrarComoPersona, garantirConcessao, garantirPerfil, unidadeDoCertame } from '@uniplus/shared-e2e';
import { cenarioDaProjecao, type CenarioDaProjecao } from '../fixtures/cenario-da-projecao';
import { inscreverPersona, type InscricaoCriada } from '../fixtures/inscricoes-reais';

/**
 * Emissão do comprovante da inscrição pela unidade (UNI-REQ-0227) contra a API real. Quem tem a
 * permissão de emitir vê a ação no detalhe e abre o comprovante, inclusive o da inscrição cancelada,
 * que traz a tarja de validade na tela e a repete em todas as folhas do papel. Quem só consulta não
 * vê a ação.
 *
 * Personas desta spec: Marlene emite e Evelyn só consulta. Nenhuma outra spec nem o suporte as usa
 * para permissão, e a spec confere pelas permissões efetivas que elas têm só o esperado antes de
 * conceder e depois. Breno se inscreve e cancela aqui: o cancelamento é irreversível, então não pode
 * ser a inscrição que as outras specs do cenário compartilham.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';
const AVISO_DA_CANCELADA = /^Documento sem validade: inscrição cancelada em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}:\d{2}$/;
const QUEM_EMITE = 'marlene.martins';
const QUEM_SO_CONSULTA = 'evelyn.moraes';
const CONSULTAR = 'selecao:inscricoes:consultar';
const EMITIR = 'selecao:inscricoes:emitir-comprovante';

interface ComprovanteLido {
  readonly cancelamento?: { readonly aviso: string } | null;
}

function exigir(resposta: { status: number; corpo: unknown }, esperado: number, passo: string): void {
  expect(resposta.status, `${passo}: ${JSON.stringify(resposta.corpo)}`).toBe(esperado);
}

async function permissoesDe(persona: string): Promise<string[]> {
  const resposta = await chamarApi<{ codigo: string }[]>(persona, 'GET', '/api/autorizacao/permissoes/efetivas', {
    cabecalhos: { accept: 'application/vnd.uniplus.permissao-efetiva.v1+json' },
  });
  exigir(resposta, 200, `permissões efetivas de ${persona}`);
  return resposta.corpo.map((p) => p.codigo).sort();
}

/** Falha se a persona tiver algo além do que esta spec concede: outra spec ou concessão a usa. */
async function exigirSomente(persona: string, permitidas: readonly string[], quando: string): Promise<void> {
  const atuais = await permissoesDe(persona);
  const estranhas = atuais.filter((codigo) => !permitidas.includes(codigo));
  expect(estranhas, `${persona} ${quando} tem permissões fora do esperado`).toEqual([]);
}

async function conceder(persona: string, permissoes: readonly string[], nome: string): Promise<void> {
  await exigirSomente(persona, permissoes, 'antes da concessão');
  const perfil = await garantirPerfil(nome, `Spec do comprovante: ${persona}.`, permissoes);
  await garantirConcessao(persona, perfil, await unidadeDoCertame());
  expect(await permissoesDe(persona), `${persona} depois da concessão`).toEqual([...permissoes].sort());
}

/** O comprovante do envio 1, lido por quem emite; é o caminho que traz a inscrição cancelada de fato. */
async function lerComprovante(processoId: string, inscricaoId: string): Promise<ComprovanteLido> {
  const resposta = await chamarApi<ComprovanteLido>(
    QUEM_EMITE,
    'GET',
    `/api/selecao/processos-seletivos/${processoId}/inscricoes/${inscricaoId}/comprovantes/1`,
    { cabecalhos: { accept: 'application/vnd.uniplus.comprovante-inscricao.v1+json' } },
  );
  exigir(resposta, 200, 'ler o comprovante do envio 1');
  return resposta.corpo;
}

async function cancelarSeAindaNao(processoId: string, inscricao: InscricaoCriada): Promise<void> {
  if ((await lerComprovante(processoId, inscricao.inscricaoId)).cancelamento) return;

  const rota = `/api/selecao/processos-seletivos/${processoId}/inscricao`;
  const atual = await chamarApi<{ eTag: string }>(inscricao.username, 'GET', rota, {
    cabecalhos: { accept: 'application/vnd.uniplus.inscricao.v1+json' },
  });
  exigir(atual, 200, `ler a inscrição de ${inscricao.username} para obter o ETag`);
  const cancelamento = await chamarApi(inscricao.username, 'POST', `${rota}/cancelamento`, {
    corpo: { motivo: null },
    cabecalhos: { 'if-match': atual.corpo.eTag },
  });
  exigir(cancelamento, 204, `cancelar a inscrição de ${inscricao.username}`);
  const depois = await lerComprovante(processoId, inscricao.inscricaoId);
  expect(depois.cancelamento, 'a inscrição cancelada traz o cancelamento no comprovante').toBeTruthy();
}

/** Cada folha do PDF é um objeto `/Type /Page`; `/Pages` é a árvore, não uma folha. */
function folhasDoPdf(pdf: Buffer): number {
  return pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0;
}

test.describe('Comprovante da inscrição emitido pela unidade', () => {
  let cenario: CenarioDaProjecao;
  let breno: InscricaoCriada;
  let rotaDoDetalhe: string;
  let rotaDoComprovante: string;

  test.beforeAll(async () => {
    test.setTimeout(900_000);
    cenario = await cenarioDaProjecao();
    await conceder(QUEM_EMITE, [CONSULTAR, EMITIR], 'E2E comprovante — consulta e emite');
    await conceder(QUEM_SO_CONSULTA, [CONSULTAR], 'E2E comprovante — só consulta');
    breno = await inscreverPersona(cenario.processoId, 'breno.novaes', false);
    await cancelarSeAindaNao(cenario.processoId, breno);

    rotaDoDetalhe = `/processo-seletivo/${cenario.processoId}/inscricoes/${breno.inscricaoId}`;
    rotaDoComprovante = `${rotaDoDetalhe}/comprovantes/1`;
  });

  test('quem emite abre o comprovante da inscrição cancelada pela ação do detalhe, com a tarja na tela', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, QUEM_EMITE, rotaDoDetalhe);

    await pagina.getByRole('link', { name: 'Emitir comprovante' }).click();

    await expect(pagina).toHaveURL(new RegExp(`${rotaDoComprovante}$`));
    await expect(pagina.getByRole('heading', { level: 1, name: 'Comprovante de inscrição' })).toBeVisible();
    const tarja = pagina.locator('.documento__aviso');
    await expect(tarja).toBeVisible();
    await expect(tarja).toHaveText(AVISO_DA_CANCELADA);
    await expect(pagina.getByRole('heading', { name: 'Cancelamento' })).toBeVisible();
    await expect(pagina.locator('main')).toContainText('***.');
  });

  test('no papel, a marca do aviso é fixa e o documento passa de uma folha', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, QUEM_EMITE, rotaDoComprovante);
    const aviso = (await pagina.locator('.documento__aviso').innerText()).trim();
    expect(aviso).toMatch(AVISO_DA_CANCELADA);

    await pagina.emulateMedia({ media: 'print' });

    // Elemento fixo é repetido pelo navegador em todas as folhas.
    const marca = pagina.locator('.documento__aviso-marca');
    await expect(marca).toHaveText(aviso);
    const estilo = await marca.evaluate((el) => {
      const css = getComputedStyle(el);
      return { posicao: css.position, exibicao: css.display, visibilidade: css.visibility };
    });
    expect(estilo).toEqual({ posicao: 'fixed', exibicao: 'block', visibilidade: 'visible' });
    // A altura da folha é reduzida para o conteúdo passar de uma folha com certeza.
    const pdf = await pagina.pdf({ width: '210mm', height: '120mm', printBackground: false });
    expect(folhasDoPdf(pdf)).toBeGreaterThan(1);
  });

  test('quem só consulta as inscrições não vê a ação de emitir o comprovante', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, QUEM_SO_CONSULTA, '/dashboard');
    // Sem classe de dado a projeção não traz respostas e a seção não existe: o que prova a tela
    // carregada é a resposta do detalhe.
    const respostaDoDetalhe = pagina.waitForResponse(
      (res) => res.request().method() === 'GET' && res.url().endsWith(`/inscricoes/${breno.inscricaoId}`),
    );
    await pagina.goto(rotaDoDetalhe);
    expect((await respostaDoDetalhe).status()).toBe(200);
    await expect(pagina.getByRole('link', { name: 'Emitir comprovante' })).toHaveCount(0);
  });

  test('quem só consulta e abre o endereço do comprovante cai na página Acesso negado, sem aviso de documento', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, QUEM_SO_CONSULTA, rotaDoComprovante);

    await expect(pagina.getByRole('heading', { level: 1, name: 'Acesso negado' })).toBeVisible();
    await expect(pagina.locator('.documento__aviso')).toHaveCount(0);
  });
});
