import { test, expect } from '@playwright/test';
import { chamarApi, entrarComoPersona, identidadeDoToken, lerTopicoDoKafka, tokenDaPersona } from '@uniplus/shared-e2e';
import { cenarioDaProjecao, type CenarioDaProjecao } from '../fixtures/cenario-da-projecao';

/**
 * Revelação de identificador a pedido no detalhe da inscrição (revelação no web) contra a API
 * real, e o registro de acesso que cada decisão deixa no tópico do Kafka. A tela só oferece
 * "Revelar" onde a API diz `podeRevelar`, e o valor revelado vale para aquele campo apenas.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';
const TOPICO = 'autorizacao_registros_de_acesso';

interface RegistroDeAcesso {
  readonly instante: string;
  readonly atorSubject: string;
  readonly processoId: string | null;
  readonly permissao: string;
  readonly sensibilidade: string;
  readonly inscricaoId: string | null;
  readonly fatoCodigo: string | null;
  readonly permitido: boolean;
  readonly origem: string;
}

/** As mensagens do tópico, do início, como o broker as guarda. */
function mensagensDoTopico(): string[] {
  return lerTopicoDoKafka(TOPICO);
}

function registrosDe(mensagens: readonly string[]): RegistroDeAcesso[] {
  return mensagens
    .flatMap((linha) => JSON.parse(linha) as { registro: RegistroDeAcesso }[])
    .map((entrada) => entrada.registro);
}

test.describe('Revelação de identificadores', () => {
  let cenario: CenarioDaProjecao;
  let rota: string;

  test.beforeAll(async () => {
    test.setTimeout(900_000);
    cenario = await cenarioDaProjecao();
    rota = `/processo-seletivo/${cenario.processoId}/inscricoes/${cenario.fernanda.inscricaoId}`;
  });

  test('revela o CPF de Fernanda só naquele campo, e o RG continua oculto', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', rota);
    // Quem revela também consulta a classe: o campo chega mascarado, com a revelação oferecida.
    await expect(pagina.getByText('***.598.363-**').first()).toBeVisible();

    await pagina.getByRole('button', { name: 'Revelar CPF' }).click();

    await expect(pagina.getByText(cenario.fernanda.cpf)).toBeVisible();
    await expect(pagina.getByText(cenario.fernanda.rg)).toHaveCount(0);
    await expect(pagina.getByRole('button', { name: 'Ocultar CPF' })).toBeVisible();
  });

  test('revela outro identificador, o número do RG', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', rota);

    await pagina.getByRole('button', { name: /^Revelar (RG|Número do RG|Documento)/i }).first().click();

    await expect(pagina.getByText(cenario.fernanda.rg)).toBeVisible();
    await expect(pagina.getByText(cenario.fernanda.cpf)).toHaveCount(0);
  });

  test('quem só consulta o identificador vê o CPF mascarado como a API devolveu, sem "Revelar"', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'helena.rezende', rota);

    await expect(pagina.getByText('***.598.363-**').first()).toBeVisible();
    await expect(pagina.getByRole('button', { name: /Revelar/ })).toHaveCount(0);
    await expect(pagina.getByText(cenario.fernanda.cpf)).toHaveCount(0);
  });

  test('sem permissão sobre o identificador o CPF não aparece e não há "Revelar"', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'kevin.carvalho', rota);

    await expect(pagina.getByRole('heading', { level: 2, name: 'Respostas do formulário' })).toBeVisible();
    await expect(pagina.getByText('CPF', { exact: true })).toHaveCount(0);
    await expect(pagina.getByRole('button', { name: /Revelar/ })).toHaveCount(0);
    await expect(pagina.locator('main')).not.toContainText(/\*\*\*\.598|Não exibido/);
  });

  test('o valor revelado não aparece ao abrir outra inscrição', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', rota);
    await pagina.getByRole('button', { name: 'Revelar CPF' }).click();
    await expect(pagina.getByText(cenario.fernanda.cpf)).toBeVisible();

    await pagina.goto(`/processo-seletivo/${cenario.processoId}/inscricoes/${cenario.erick.inscricaoId}`);

    await expect(pagina.getByText('Erick Isaac Ramos')).toBeVisible();
    await expect(pagina.locator('main')).not.toContainText(cenario.fernanda.cpf);
    await expect(pagina.locator('main')).not.toContainText(cenario.erick.cpf);
  });

  test('revelação recusada pela API mantém o CPF mascarado e avisa "Dado não disponível"', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', rota);
    await pagina.route(/\/campos\/[^/]+\/revelacao$/, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ status: 404, title: 'Não encontrado', code: 'uniplus.nao_encontrado' }),
      }),
    );

    await pagina.getByRole('button', { name: 'Revelar CPF' }).click();

    await expect(pagina.getByText('Dado não disponível')).toBeVisible();
    await expect(pagina.getByText('***.598.363-**').first()).toBeVisible();
    await expect(pagina.getByText(cenario.fernanda.cpf)).toHaveCount(0);
  });

  // A decisão de revelar vem antes da busca da resposta: quem não pode e o campo que não existe
  // recebem a mesma recusa, e ninguém descobre por ela se o dado existe.
  test('a API recusa do mesmo modo quem não pode revelar e o campo que não existe', async () => {
    const caminho = (campo: string) =>
      `/api/selecao/processos-seletivos/${cenario.processoId}/inscricoes/${cenario.fernanda.inscricaoId}/campos/${campo}/revelacao`;

    const semPermissao = await chamarApi<{ code: string }>('helena.rezende', 'POST', caminho('CPF'));
    const semAcesso = await chamarApi<{ code: string }>('kevin.carvalho', 'POST', caminho('CPF'));
    const inexistente = await chamarApi<{ code: string }>('diogo.souza', 'POST', caminho('CAMPO_QUE_NAO_EXISTE'));
    const naoIdentificador = await chamarApi<{ code: string }>('diogo.souza', 'POST', caminho('NOME'));

    for (const recusa of [semPermissao, semAcesso, inexistente, naoIdentificador]) {
      expect(recusa.status).toBe(404);
      expect(typeof recusa.corpo.code === 'string' && recusa.corpo.code !== '').toBe(true);
      expect(recusa.corpo.code).toBe(inexistente.corpo.code);
    }
  });

  test('listagem, detalhe e revelação deixam registro de acesso publicado no Kafka', async ({ browser }) => {
    test.setTimeout(240_000);
    const inicio = Date.now();
    const diogo = identidadeDoToken(await tokenDaPersona('diogo.souza')).sub;
    const pagina = await entrarComoPersona(browser, APP, 'diogo.souza', `/processo-seletivo/${cenario.processoId}/inscricoes`);
    await expect(pagina.getByRole('row', { name: /Ariel Drumond/ })).toBeVisible();
    await pagina.getByRole('row', { name: /Ariel Drumond/ }).getByRole('link').first().click();
    await pagina.getByRole('button', { name: 'Revelar CPF' }).click();
    await expect(pagina.getByText(cenario.fernanda.cpf)).toBeVisible();

    // O produtor publica em lote: espera os três registros aparecerem no tópico.
    const meus = (mensagens: readonly string[]) =>
      registrosDe(mensagens).filter((r) => r.atorSubject === diogo && Date.parse(r.instante) >= inicio);
    const achados = (mensagens: readonly string[]) => {
      const registros = meus(mensagens);
      return {
        listagem: registros.some(
          (r) => r.permissao === 'selecao:inscricoes:consultar' && r.inscricaoId === null && r.processoId === cenario.processoId && r.permitido,
        ),
        detalhe: registros.some(
          (r) => r.permissao === 'selecao:dados-pessoais:consultar' && r.inscricaoId === cenario.fernanda.inscricaoId && r.permitido,
        ),
        revelacao: registros.some(
          (r) =>
            r.permissao === 'selecao:dados-identificadores:revelar' &&
            r.inscricaoId === cenario.fernanda.inscricaoId &&
            r.fatoCodigo === 'CPF' &&
            r.permitido,
        ),
      };
    };
    let mensagens: string[] = [];
    await expect
      .poll(
        () => {
          mensagens = mensagensDoTopico();
          return achados(mensagens);
        },
        { timeout: 90_000, intervals: [1_000] },
      )
      .toEqual({ listagem: true, detalhe: true, revelacao: true });

    expect(meus(mensagens).every((r) => r.origem === 'api')).toBe(true);
    // O registro identifica a decisão e o alvo, nunca o valor: nenhuma mensagem do tópico, de
    // ninguém, traz o CPF das inscrições do cenário, em dígitos ou formatado.
    for (const { cpf } of [cenario.fernanda, cenario.erick]) {
      const digitos = cpf.replace(/\D/g, '');
      const formatado = `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
      expect(mensagens.filter((m) => m.includes(digitos) || m.includes(formatado))).toEqual([]);
    }
  });
});
