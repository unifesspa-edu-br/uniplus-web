import { type APIRequestContext, expect, type Locator, type Page, test } from '@playwright/test';
import { assertDocumentoSemRolagemVertical, runAxeWcagAA } from '@uniplus/shared-e2e';

import { keycloakLogin } from '../support/keycloak-login';

/**
 * A inscrição do candidato de ponta a ponta, contra a stack local com o processo de teste que o
 * roteiro da API publica (`scripts/roteiro-processo-teste-inscricao.sh`, que imprime o
 * `PROCESSO_ID`). Repetir o teste no mesmo processo continua valendo: a inscrição já enviada é
 * retomada e corrigida de novo, e cada envio soma um comprovante.
 */
const PROCESSO_ID = process.env['E2E_PROCESSO_ID'] ?? '';
const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:5000';

/** Fernanda Drumond, persona fictícia do portal de documentação, que usa o nome social Ariel. */
const PERSONA = {
  usuario: 'fernanda.drumond',
  senha: process.env['E2E_SENHA_PERSONAS'] ?? 'Uni+Teste26',
  nome: 'Fernanda Laura Nicole Drumond',
  nomeSocial: 'Ariel Drumond',
  cpfMascarado: '***.598.363-**',
  nascimento: '1970-02-02',
  rg: '12.868.927-4',
  mae: 'Maria Marli',
  pai: 'Joaquim Eduardo Drumond',
  email: 'fernanda_laura_drumond@lhp.com.br',
  celular: '(67) 99490-8277',
  fixo: '(67) 3931-4637',
  cep: '79096730',
  numero: '743',
  uf: 'Mato Grosso do Sul',
  cidade: 'Campo Grande',
} as const;

/** Uma das edições que o roteiro da API declara como aceitas pelo processo de validação. */
const EDICAO_DO_ENEM = 'ENEM 2026';
const MUNICIPIO_DO_FATOR = 'Marabá/PA';

const campo = (page: Page, rotulo: string): Locator =>
  page.getByRole('textbox', { name: new RegExp(`^${rotulo}`) });

const lista = (page: Page, rotulo: string): Locator =>
  page.getByRole('combobox', { name: new RegExp(`^${rotulo}`) });

/** O rádio tem um marcador visual sobre o input: escolhe-se pelo rótulo, como o candidato. */
async function escolher(page: Page, pergunta: string, opcao: string): Promise<void> {
  await page
    .getByRole('group', { name: new RegExp(`^${pergunta}`) })
    .getByText(opcao, { exact: true })
    .click();
}

async function irParaSecao(page: Page, secao: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Seções do formulário' })
    .getByRole('button', { name: secao })
    .click();
  await expect(
    page.getByRole('heading', { level: 3, name: new RegExp(`^${secao}`) }),
  ).toBeVisible();
}

async function municipio(page: Page, rotulo: string, nome: string): Promise<void> {
  await lista(page, rotulo).fill(nome);
  await page
    .getByRole('option', { name: new RegExp(`^${nome}`) })
    .first()
    .click();
}

async function preencherDadosDoCandidato(page: Page): Promise<void> {
  await irParaSecao(page, 'Dados do candidato');
  await campo(page, 'Nome completo').fill(PERSONA.nome);
  await escolher(page, 'Deseja usar nome social', 'Sim');
  await campo(page, 'Nome social').fill(PERSONA.nomeSocial);
  await escolher(page, 'Nacionalidade', 'Brasileiro nato');
  await expect(campo(page, 'CPF')).toHaveValue(PERSONA.cpfMascarado);
  await campo(page, 'Número do RG').fill(PERSONA.rg);
  await campo(page, 'Órgão emissor do RG').fill('SSP');
  await lista(page, 'UF de emissão do RG').selectOption({ label: PERSONA.uf });
  await campo(page, 'Data de emissão do RG').fill('1990-05-10');
  await campo(page, 'Data de nascimento').fill(PERSONA.nascimento);
  await lista(page, 'UF de nascimento').selectOption({ label: PERSONA.uf });
  await municipio(page, 'Município de nascimento', PERSONA.cidade);
  await campo(page, 'Nome da mãe').fill(PERSONA.mae);
  await campo(page, 'Nome do pai').fill(PERSONA.pai);
  await escolher(page, 'Estado civil', 'Solteiro(a)');
  await escolher(page, 'Sexo', 'Feminino');
  await escolher(page, 'Cor ou raça', 'Branca');
  await campo(page, 'E-mail').fill(PERSONA.email);
  await campo(page, 'Telefone').fill(PERSONA.celular);
  await lista(page, 'Tipo de localidade').selectOption({ label: 'Zona urbana' });

  const endereco = page.getByRole('group', { name: /^Endereço residencial/ });
  // Na inscrição retomada o CEP já resolvido fica travado até "Trocar CEP".
  if (!(await endereco.getByRole('button', { name: 'Trocar CEP' }).isVisible())) {
    await endereco.getByRole('textbox', { name: 'CEP' }).fill(PERSONA.cep);
    await endereco.getByRole('button', { name: 'Buscar CEP' }).click();
  }
  await expect(endereco.getByRole('textbox', { name: 'Cidade' })).toHaveValue(PERSONA.cidade);
  await endereco.getByRole('textbox', { name: /^Número/ }).fill(PERSONA.numero);
}

async function preencherRestante(page: Page): Promise<void> {
  await irParaSecao(page, 'ENEM');
  await escolher(page, 'Qual edição do ENEM você vai usar', EDICAO_DO_ENEM);

  await irParaSecao(page, 'Ensino médio');
  await escolher(page, 'Como você concluiu o ensino médio', 'Ensino médio regular');
  await lista(page, 'Onde você cursou o ensino médio').selectOption({ label: 'Escola privada' });

  await irParaSecao(page, 'Fator de Atenuação das Desigualdades de Acesso');
  const municipioDoFator = lista(page, 'Em qual município da área de abrangência você reside');
  // A inscrição retomada já traz a resposta anterior: o "Não" fixa o ponto de partida.
  await escolher(page, 'Deseja solicitar o Fator de Atenuação das Desigualdades de Acesso', 'Não');
  await expect(municipioDoFator).toHaveCount(0);
  await escolher(page, 'Deseja solicitar o Fator de Atenuação das Desigualdades de Acesso', 'Sim');
  await municipioDoFator.selectOption({ label: MUNICIPIO_DO_FATOR });

  await irParaSecao(page, 'Reserva de vagas');
  for (const pergunta of [
    'Você é pessoa com deficiência',
    'Deseja concorrer às vagas para pretos, pardos e indígenas',
    'Você se autodeclara indígena',
    'Você se autodeclara quilombola',
    'A renda da sua família é de até um salário mínimo por pessoa',
  ]) {
    await escolher(page, pergunta, 'Não');
  }
  // A página rola só pela área de conteúdo: nenhuma opção estica o documento, e o foco pelo
  // teclado no último controle rola a área, não a janela.
  await assertDocumentoSemRolagemVertical(page);
  await page.getByRole('radio').last().focus();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await irParaSecao(page, 'Revisão e aceite');
  // Na inscrição retomada os termos já vêm aceitos: clicar de novo os desmarcaria.
  for (const termo of await page.getByRole('article').all()) {
    if (!(await termo.getByRole('checkbox').isChecked())) {
      await termo.getByText('Li e aceito (obrigatório)').click();
    }
    await expect(termo.getByRole('checkbox')).toBeChecked();
  }
}

/** O envio pelo teclado: foco no botão e Enter, como quem não usa o mouse. */
async function enviarPeloTeclado(page: Page): Promise<void> {
  const enviar = page.getByRole('button', { name: 'Enviar inscrição' });
  await enviar.focus();
  await expect(enviar).toBeFocused();
  await page.keyboard.press('Enter');
}

/** O nome com que o processo de teste foi divulgado, como a lista de inscrições o mostra. */
async function nomeDivulgado(request: APIRequestContext): Promise<string> {
  const certame = await request.get(`${API_URL}/api/selecao/certames/${PROCESSO_ID}`, {
    headers: { Accept: 'application/vnd.uniplus.certame.v1+json' },
  });
  expect(certame.ok()).toBe(true);
  return ((await certame.json()) as { nome: string }).nome;
}

/** A inscrição do processo de teste na lista: o candidato pode ter inscrições em outros processos. */
const inscricaoNaLista = (page: Page, processo: string): Locator =>
  page
    .getByRole('listitem')
    .or(page.getByRole('article'))
    .filter({ has: page.getByRole('heading', { name: processo, exact: true }) });

async function abrirComprovanteNaLista(page: Page, processo: string): Promise<void> {
  await page.getByRole('link', { name: 'Ver minhas inscrições' }).click();
  const item = inscricaoNaLista(page, processo);
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: 'Ver comprovante' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Comprovante de inscrição' }),
  ).toBeVisible();
}

const comprovante = (page: Page): Locator => page.getByRole('article');

/**
 * Ancestrais do comprovante que, na mídia corrente, cortam o que passa da própria altura. Na
 * impressão o único que pode crescer é o documento: qualquer outro corta o papel na primeira tela.
 */
const ancestraisQueCortamOComprovante = (page: Page): Promise<string[]> =>
  comprovante(page).evaluate((artigo) => {
    const cortes: string[] = [];
    for (let el = artigo.parentElement; el && el !== document.body; el = el.parentElement) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1) {
        cortes.push(`${el.tagName.toLowerCase()}.${el.className}`);
      }
    }
    return cortes;
  });

/** Roda `passo` numa janela de `altura` px e volta à janela de antes para os passos seguintes. */
async function comJanelaDeAltura(
  page: Page,
  altura: number,
  passo: () => Promise<void>,
): Promise<void> {
  const janela = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.setViewportSize({ width: janela.width, height: altura });
  await passo();
  await page.setViewportSize(janela);
}

test.describe('Inscrição do candidato de ponta a ponta', () => {
  test.skip(!PROCESSO_ID, 'Defina E2E_PROCESSO_ID com o processo que o roteiro da API publicou.');
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'A inscrição é única por candidato e processo: dois navegadores em paralelo disputariam a mesma.',
  );
  test.setTimeout(180_000);

  let processo = '';
  test.beforeAll(async ({ request }) => {
    processo = await nomeDivulgado(request);
  });

  test('entra, se inscreve, corrige e confere os comprovantes e as inscrições', async ({
    page,
  }) => {
    await test.step('entra pela vitrine e volta à inscrição escolhida', async () => {
      await page.goto('/processos');
      await page.locator(`a[href="/inscricao/${PROCESSO_ID}"]`).first().click();
      await keycloakLogin(page, PERSONA.usuario, PERSONA.senha, {
        expectRedirectTo: new RegExp(`/inscricao/${PROCESSO_ID}`),
      });
      await expect(page.getByRole('heading', { level: 1, name: 'Inscrição' })).toBeVisible();
    });

    await test.step('o campo obrigatório recusado é anunciado e ligado à mensagem', async () => {
      await irParaSecao(page, 'Dados do candidato');
      await campo(page, 'Nome completo').fill('');
      await enviarPeloTeclado(page);
      await expect(page.locator('[aria-live="polite"]').first()).toContainText(/recusad/);
      await irParaSecao(page, 'Dados do candidato');
      const nome = campo(page, 'Nome completo');
      await expect(nome).toHaveAttribute('aria-invalid', 'true');
      await expect(nome).toHaveAccessibleDescription(/Responda este campo\./);
    });

    await test.step('o formulário não tem violação de WCAG 2.1 AA', async () => {
      const resultado = await runAxeWcagAA(page, { exclude: ['vlibras-widget, [vw]'] });
      expect(resultado.violations).toEqual([]);
    });

    await test.step('preenche e envia', async () => {
      await preencherDadosDoCandidato(page);
      await preencherRestante(page);
      await enviarPeloTeclado(page);
      await expect(page.getByText('Inscrição enviada', { exact: true })).toBeVisible();
    });

    await test.step('o comprovante mostra o nome social, o CPF mascarado, o município e a edição', async () => {
      await abrirComprovanteNaLista(page, processo);
      await expect(comprovante(page)).toContainText(PERSONA.nomeSocial);
      await expect(comprovante(page)).toContainText(PERSONA.cpfMascarado);
      await expect(comprovante(page)).toContainText(PERSONA.celular);
      await expect(comprovante(page)).not.toContainText(PERSONA.rg);
      // Município pelo nome, e nenhum código de fato ou IBGE cru na tela.
      await expect(comprovante(page)).toContainText(`${PERSONA.cidade} — MS`);
      await expect(comprovante(page)).toContainText(`${PERSONA.cidade}/MS`);
      await expect(comprovante(page)).toContainText(EDICAO_DO_ENEM);
      await expect(comprovante(page)).toContainText(MUNICIPIO_DO_FATOR);
      await expect(comprovante(page)).not.toContainText('Código IBGE');
      await expect(comprovante(page)).not.toContainText(/[A-Z]+_[A-Z_]+/);
    });

    await test.step('o comprovante sai inteiro na impressão, sem cabeçalho nem rodapé', () =>
      // Janela mais baixa que o comprovante: sem isso o corte na primeira tela não apareceria.
      comJanelaDeAltura(page, 480, async () => {
        const altura = await comprovante(page).evaluate((el) => el.getBoundingClientRect().height);
        expect(altura).toBeGreaterThan(480);
        expect(await ancestraisQueCortamOComprovante(page)).not.toEqual([]);

        await page.emulateMedia({ media: 'print' });
        expect(await ancestraisQueCortamOComprovante(page)).toEqual([]);
        await expect(page.getByRole('banner')).toBeHidden();
        await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeHidden();
        await expect(page.getByRole('contentinfo')).toBeHidden();
        await expect(comprovante(page)).toBeVisible();
        await page.emulateMedia({ media: null });
      }));

    await test.step('corrige o telefone e envia de novo', async () => {
      await page.goto(`/inscricao/${PROCESSO_ID}`);
      await irParaSecao(page, 'Dados do candidato');
      await expect(campo(page, 'Telefone')).toHaveValue(PERSONA.celular);
      await campo(page, 'Telefone').fill(PERSONA.fixo);
      await enviarPeloTeclado(page);
      await expect(page.getByText('Inscrição enviada', { exact: true })).toBeVisible();
    });

    await test.step('o comprovante novo traz a correção e o anterior continua igual', async () => {
      await abrirComprovanteNaLista(page, processo);
      await expect(comprovante(page)).toContainText(PERSONA.fixo);
      const anterior = page.getByRole('link', { name: 'Comprovante anterior' });
      const destino = (await anterior.getAttribute('href')) ?? '';
      await anterior.click();
      await expect(page).toHaveURL(new RegExp(`${destino}$`));
      await expect(page).toHaveURL(new RegExp(`/inscricao/${PROCESSO_ID}/comprovantes/\\d+$`));
      await expect(comprovante(page)).toContainText(PERSONA.celular);
      await expect(comprovante(page)).not.toContainText(PERSONA.fixo);
    });

    await test.step('minhas inscrições mostra a inscrição com o nome social', async () => {
      await page.getByRole('link', { name: 'Voltar às minhas inscrições' }).first().click();
      const item = inscricaoNaLista(page, processo);
      await expect(item).toContainText(PERSONA.nomeSocial);
      await expect(item).not.toContainText(PERSONA.nome);
    });
  });
});
