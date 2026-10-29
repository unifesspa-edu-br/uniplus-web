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

/** Os dados de uma persona fictícia do portal de documentação, como a inscrição os pede. */
interface Persona {
  readonly usuario: string;
  readonly senha: string;
  readonly nome: string;
  /** O nome social da conta; nulo quando a conta não tem. */
  readonly nomeSocial: string | null;
  readonly cpfMascarado: string;
  readonly nascimento: string;
  readonly rg: string;
  readonly mae: string;
  readonly pai: string;
  readonly email: string;
  readonly celular: string;
  readonly fixo?: string;
  readonly cep: string;
  readonly numero: string;
  readonly uf: string;
  readonly cidade: string;
}

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
} as const satisfies Persona;

/** Helena Rezende, persona fictícia do portal de documentação, cuja conta começa sem nome social. */
const HELENA: Persona = {
  usuario: 'helena.rezende',
  senha: process.env['E2E_SENHA_PERSONAS'] ?? 'Uni+Teste26',
  nome: 'Helena Bianca Sueli Rezende',
  nomeSocial: null,
  cpfMascarado: '***.287.930-**',
  nascimento: '1954-05-12',
  rg: '19.377.269-3',
  mae: 'Jéssica Tatiane',
  pai: 'Thomas Felipe Marcos Vinicius Rezende',
  email: 'helena_bianca_rezende@paginacom.com.br',
  celular: '(51) 98703-7357',
  cep: '90840510',
  numero: '336',
  uf: 'Rio Grande do Sul',
  cidade: 'Porto Alegre',
};

/** O nome social que a Helena cadastra em Meu perfil durante o teste e remove ao final. */
const NOME_SOCIAL_DA_HELENA = 'Helena Rezende';

/** Uma das edições que o roteiro da API declara como aceitas pelo processo de validação. */
const EDICAO_DO_ENEM = 'ENEM 2026';
const MUNICIPIO_DO_FATOR = 'Marabá/PA';
const MUNICIPIO_DE_RESIDENCIA_DO_FATOR = 'Imperatriz/MA';
const ORGAO_EMISSOR = 'Secretaria de Segurança Pública (SSP)';

const campo = (page: Page, rotulo: string): Locator =>
  page.getByRole('textbox', { name: new RegExp(`^${rotulo}`) });

const lista = (page: Page, rotulo: string): Locator =>
  page.getByRole('combobox', { name: new RegExp(`^${rotulo}`) });

/** O rádio tem um marcador visual sobre o input: escolhe-se pelo rótulo, como o candidato. */
async function escolher(page: Page, pergunta: string | RegExp, opcao: string): Promise<void> {
  await page
    .getByRole('group', {
      name: typeof pergunta === 'string' ? new RegExp(`^${pergunta}`) : pergunta,
    })
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

/**
 * O nascimento depois do dia do envio é recusado ao sair do campo, com a dica dos limites em dd/mm/aaaa,
 * e o calendário não passa do dia do envio.
 */
async function recusarNascimentoNoFuturo(page: Page): Promise<void> {
  const nascimento = campo(page, 'Data de nascimento');
  await nascimento.fill(`${new Date().getFullYear() + 1}-01-10`);
  await nascimento.blur();
  await expect(nascimento).toHaveAttribute('aria-invalid', 'true');
  await expect(nascimento).toHaveAccessibleDescription(
    /Informe uma data entre \d{2}\/\d{2}\/\d{4} e \d{2}\/\d{2}\/\d{4}\./,
  );
  await expect(nascimento).toHaveAttribute('max', /^\d{4}-\d{2}-\d{2}$/);
}

async function preencherDadosDoCandidato(page: Page, persona: Persona = PERSONA): Promise<void> {
  await irParaSecao(page, 'Dados do candidato');
  // O nome civil vem da conta e não se edita.
  const nome = campo(page, 'Nome completo');
  await expect(nome).toHaveValue(persona.nome);
  await expect(nome).not.toBeEditable();
  // O nome social também vem da conta: só a escolha de usá-lo é do candidato.
  await escolher(page, 'Deseja usar nome social', 'Sim');
  const nomeSocial = campo(page, 'Nome social');
  await expect(nomeSocial).toHaveValue(persona.nomeSocial ?? '');
  await expect(nomeSocial).not.toBeEditable();
  await expect(page.getByText(/^Vem da sua conta e não pode ser alterado aqui\./)).toBeVisible();
  await escolher(page, 'Nacionalidade', 'Brasileiro nato');
  await expect(campo(page, 'CPF')).toHaveValue(persona.cpfMascarado);
  await campo(page, 'Número do RG').fill(persona.rg);
  // Só o "Outro" pede o nome do órgão; com um órgão da lista, o campo sai de novo.
  const orgaoEmissor = lista(page, 'Órgão emissor do RG');
  const nomeDoOrgao = campo(page, 'Nome do órgão emissor');
  await orgaoEmissor.selectOption({ label: 'Outro' });
  await expect(nomeDoOrgao).toBeVisible();
  await orgaoEmissor.selectOption({ label: ORGAO_EMISSOR });
  await expect(nomeDoOrgao).toHaveCount(0);
  await lista(page, 'UF de emissão do RG').selectOption({ label: persona.uf });
  await campo(page, 'Data de emissão do RG').fill('1990-05-10');
  await recusarNascimentoNoFuturo(page);
  await campo(page, 'Data de nascimento').fill(persona.nascimento);
  await expect(campo(page, 'Data de nascimento')).not.toHaveAttribute('aria-invalid', 'true');
  await lista(page, 'UF de nascimento').selectOption({ label: persona.uf });
  await municipio(page, 'Município de nascimento', persona.cidade);
  await campo(page, 'Nome da mãe').fill(persona.mae);
  await campo(page, 'Nome do pai').fill(persona.pai);
  await escolher(page, 'Estado civil', 'Solteiro(a)');
  // "Sexo civil" também começa por "Sexo": o nome do grupo é conferido inteiro.
  await escolher(page, /^Sexo biológico \*?$/, 'Feminino');
  await escolher(page, 'Cor ou raça', 'Branca');
  await campo(page, 'E-mail').fill(persona.email);
  await campo(page, 'Telefone').fill(persona.celular);
  await lista(page, 'Tipo de localidade').selectOption({ label: 'Zona urbana' });

  const endereco = page.getByRole('group', { name: /^Endereço residencial/ });
  // Na inscrição retomada o CEP já resolvido fica travado até "Trocar CEP".
  if (!(await endereco.getByRole('button', { name: 'Trocar CEP' }).isVisible())) {
    await endereco.getByRole('textbox', { name: 'CEP' }).fill(persona.cep);
    await endereco.getByRole('button', { name: 'Buscar CEP' }).click();
  }
  await expect(endereco.getByRole('textbox', { name: 'Cidade' })).toHaveValue(persona.cidade);
  await endereco.getByRole('textbox', { name: /^Número/ }).fill(persona.numero);
  await escolher(page, 'Sexo civil', 'Feminino');
  await escolher(page, 'Identidade de gênero', 'Prefiro não informar');
  await escolher(page, 'Orientação sexual', 'Prefiro não informar');
}

/**
 * O modelo de inscrição sem prova não tem etapa presencial, então o formulário não oferece a seção
 * de atendimento especializado.
 */
async function conferirSemAtendimentoEspecializado(page: Page): Promise<void> {
  const secoes = page.getByRole('navigation', { name: 'Seções do formulário' });
  await expect(secoes.getByRole('button', { name: 'Dados do candidato' })).toBeVisible();
  await expect(secoes.getByRole('button', { name: 'Atendimento especializado' })).toHaveCount(0);
}

const pergunta = (page: Page, rotulo: string): Locator =>
  page.getByRole('group', { name: new RegExp(`^${rotulo}`) });

function perguntasDaReserva(page: Page) {
  return {
    escolaPublica: pergunta(
      page,
      'Deseja concorrer às vagas para quem cursou o ensino médio em escola pública',
    ),
    pertencimentoIndigena: pergunta(page, 'Você pertence a um povo indígena'),
    quilombola: pergunta(page, 'Você se autodeclara quilombola'),
    ppi: pergunta(page, 'Deseja concorrer às vagas para pretos, pardos e indígenas'),
    renda: pergunta(page, 'A renda da sua família é de até um salário mínimo por pessoa'),
  };
}

async function declararCor(page: Page, cor: string): Promise<void> {
  await irParaSecao(page, 'Dados do candidato');
  await escolher(page, 'Cor ou raça', cor);
}

async function declararOndeCursou(page: Page, onde: string): Promise<void> {
  await irParaSecao(page, 'Ensino médio');
  await lista(page, 'Onde você cursou o ensino médio').selectOption({ label: onde });
}

/**
 * As perguntas das cotas da lei só se fazem a quem optou por elas, e a da PPI só a quem tem cor ou
 * pertencimento que dá acesso a ela. Sem enviar, a mesma inscrição passa por egressa de escola
 * pública Branca, Parda e Indígena, e volta ao estado de partida: escola privada e Branca. Cada
 * ausência é conferida depois de uma pergunta que a mesma resposta faz aparecer.
 */
async function conferirReservaPelaElegibilidade(page: Page): Promise<void> {
  const reserva = perguntasDaReserva(page);

  await declararOndeCursou(page, 'Somente em escola pública');
  await irParaSecao(page, 'Reserva de vagas');
  await escolher(page, 'Você é pessoa com deficiência', 'Não');
  await escolher(
    page,
    'Deseja concorrer às vagas para quem cursou o ensino médio em escola pública',
    'Sim',
  );
  // Branca que optou pelas cotas responde quilombola e renda, mas não a PPI nem o pertencimento.
  await expect(reserva.quilombola).toBeVisible();
  await expect(reserva.renda).toBeVisible();
  await expect(reserva.ppi).toHaveCount(0);
  await expect(reserva.pertencimentoIndigena).toHaveCount(0);

  await declararCor(page, 'Parda');
  await irParaSecao(page, 'Reserva de vagas');
  await expect(reserva.ppi).toBeVisible();
  await expect(reserva.pertencimentoIndigena).toHaveCount(0);

  // Indígena confirma o pertencimento antes de a PPI aparecer.
  await declararCor(page, 'Indígena');
  await irParaSecao(page, 'Reserva de vagas');
  await escolher(page, 'Você pertence a um povo indígena', 'Não');
  await expect(reserva.pertencimentoIndigena).toBeVisible();
  await expect(reserva.ppi).toHaveCount(0);
  await escolher(page, 'Você pertence a um povo indígena', 'Sim');
  await expect(reserva.ppi).toBeVisible();

  await declararCor(page, 'Branca');
  await declararOndeCursou(page, 'Escola privada');
}

async function preencherRestante(page: Page): Promise<void> {
  await irParaSecao(page, 'ENEM');
  await escolher(page, 'Qual edição do ENEM você vai usar', EDICAO_DO_ENEM);

  await irParaSecao(page, 'Ensino médio');
  await escolher(page, 'Como você concluiu o ensino médio', 'Ensino médio regular');
  await lista(page, 'Onde você cursou o ensino médio').selectOption({ label: 'Escola privada' });

  await irParaSecao(page, 'Fator de Atenuação das Desigualdades de Acesso');
  // Quem concluiu o ensino médio regular informa o município em que o cursou, sem escolher caminho.
  const municipioDoFator = lista(
    page,
    'Em qual município da área de influência você cursou o ensino médio',
  );
  const caminhoDoFator = page.getByRole('group', {
    name: /^Por qual vínculo com a área você solicita o Fator/,
  });
  const residenciaDoFator = lista(page, 'Em qual município da área de abrangência você residiu');
  // A inscrição retomada já traz a resposta anterior: o "Não" fixa o ponto de partida.
  await escolher(page, 'Deseja solicitar o Fator de Atenuação das Desigualdades de Acesso', 'Não');
  await expect(municipioDoFator).toHaveCount(0);
  await escolher(page, 'Deseja solicitar o Fator de Atenuação das Desigualdades de Acesso', 'Sim');
  // O município e o caminho dependem da mesma resposta: com o município à vista, a ausência do
  // caminho já é a definitiva.
  await expect(municipioDoFator).toBeVisible();
  await expect(caminhoDoFator).toHaveCount(0);
  await expect(residenciaDoFator).toHaveCount(0);
  await municipioDoFator.selectOption({ label: MUNICIPIO_DO_FATOR });

  await conferirReservaPelaElegibilidade(page);

  // De volta à escola privada, nenhuma pergunta de cota da lei se faz. O formulário calcula a
  // exibição no navegador, junto com o desenho da seção: aberta a seção, a ausência das perguntas
  // de cota já é a definitiva.
  await irParaSecao(page, 'Reserva de vagas');
  const reserva = perguntasDaReserva(page);
  await escolher(page, 'Você é pessoa com deficiência', 'Não');
  for (const ausente of [reserva.escolaPublica, reserva.quilombola, reserva.ppi, reserva.renda]) {
    await expect(ausente).toHaveCount(0);
  }
  // A página rola só pela área de conteúdo: nenhuma opção estica o documento, e o foco pelo
  // teclado no último controle rola a área, não a janela.
  await assertDocumentoSemRolagemVertical(page);
  await page.getByRole('radio').last().focus();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await conferirSemAtendimentoEspecializado(page);

  // Quem cursou o ensino médio em escola privada concorre só na ampla concorrência: a lista é a que a
  // API calcula das respostas, já gravadas ou ainda na tela.
  await irParaSecao(page, 'Modalidades de concorrência');
  const modalidades = page.locator('ui-modalidades-da-inscricao');
  await expect(
    modalidades
      .getByRole('list', { name: 'Modalidades em que você concorre' })
      .getByRole('listitem'),
  ).toHaveText([/Ampla concorrência/i]);
  await expect(modalidades).toHaveAttribute('aria-busy', 'false', { timeout: 10_000 });

  // O processo de validação só pede documentos na habilitação: nesta fase a avaliação não pede nada.
  await irParaSecao(page, 'Documentos');
  const documentos = page.locator('ui-documentos-da-inscricao');
  await expect(documentos).toHaveAttribute('aria-busy', 'false', { timeout: 10_000 });
  await expect(documentos).toContainText('Você não envia documentos nesta etapa.');
  await expect(documentos.getByRole('heading', { level: 4 })).toHaveCount(0);

  await irParaSecao(page, 'Revisão e aceite');
  await expect(
    page
      .locator('ui-modalidades-da-inscricao')
      .getByRole('list', { name: 'Modalidades em que você concorre' })
      .getByRole('listitem'),
  ).toHaveText([/Ampla concorrência/i]);
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
  // O botão só se ativa com o formulário válido; o foco só se fixa nele depois disso.
  await expect(enviar).toBeEnabled();
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

/** O documento do comprovante fica no conteúdo principal da página. */
const comprovante = (page: Page): Locator => page.getByRole('main');

/** A seção do comprovante com as modalidades em que o envio concorre. */
const modalidadesDoComprovante = (page: Page): Locator =>
  comprovante(page).locator('ui-secao-de-documento', {
    has: page.getByRole('heading', { name: 'Modalidades em que você concorre' }),
  });

/**
 * Ancestrais do comprovante que, na mídia corrente, cortam o que passa da própria altura. Na
 * impressão o único que pode crescer é o documento: qualquer outro corta o papel na primeira tela.
 */
const ancestraisQueCortamOComprovante = (page: Page): Promise<string[]> =>
  comprovante(page).evaluate((documento) => {
    const cortes: string[] = [];
    for (let el = documento.parentElement; el && el !== document.body; el = el.parentElement) {
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
  // Os dois testes usam a mesma persona e a mesma inscrição: um depois do outro.
  test.describe.configure({ mode: 'serial' });

  let processo = '';
  test.beforeAll(async ({ request }) => {
    processo = await nomeDivulgado(request);
  });

  test('entra, se inscreve, corrige e confere os comprovantes e as inscrições', async ({
    page,
  }) => {
    await test.step('a vitrine leva ao PDF do edital no acervo público, que abre sem credencial', async () => {
      await page.goto('/processos');
      const verEdital = page
        .getByRole('link', { name: `Ver edital — ${processo} (abre em nova aba)` })
        .first();
      await expect(verEdital).toHaveAttribute('href', /\/editais\/.+\.pdf$/);
      const pdf = await page.request.get((await verEdital.getAttribute('href')) ?? '');
      expect(pdf.ok()).toBe(true);
      expect(pdf.headers()['content-type']).toBe('application/pdf');
    });

    await test.step('"Ver publicações" lista os atos do certame, com o PDF, e não oferece inscrição', async () => {
      await page.goto('/processos');
      await page
        .getByRole('button', { name: `Ver publicações — ${processo}` })
        .first()
        .click();
      const painel = page.getByRole('region', { name: `Ver publicações — ${processo}` }).first();
      await expect(
        painel.getByRole('heading', { level: 4, name: /^Edital de abertura/ }),
      ).toBeVisible();
      const verDocumento = painel.getByRole('link', {
        name: /^.+\.pdf \(PDF, [^)]+\) , abre em nova aba$/,
      });
      await expect(verDocumento).toHaveAttribute('href', /\/editais\/.+\.pdf$/);
      const pdf = await page.request.get((await verDocumento.getAttribute('href')) ?? '');
      expect(pdf.ok()).toBe(true);
      expect(pdf.headers()['content-type']).toBe('application/pdf');
      await expect(painel.getByText(/Inscri(ções abertas|ver-se)/)).toHaveCount(0);
    });

    await test.step('entra pela vitrine e volta à inscrição escolhida', async () => {
      await page.goto('/processos');
      await page.locator(`a[href="/inscricao/${PROCESSO_ID}"]`).first().click();
      await keycloakLogin(page, PERSONA.usuario, PERSONA.senha, {
        expectRedirectTo: new RegExp(`/inscricao/${PROCESSO_ID}`),
      });
      await expect(page.getByRole('heading', { level: 1, name: 'Inscrição' })).toBeVisible();
    });

    await test.step('o envio com obrigatório em branco não sai: fica inativo, aponta a seção e liga o campo à mensagem', async () => {
      await irParaSecao(page, 'Dados do candidato');
      await campo(page, 'Nome da mãe').fill('');
      const enviar = page.getByRole('button', { name: 'Enviar inscrição' });
      await expect(enviar).toBeDisabled();
      await expect(enviar).toHaveAccessibleDescription(/Falta(m)? corrigir \d+ (item|itens)\./);
      await page.getByRole('button', { name: /^Dados do candidato\s*:?\s*\(\d+ (item|itens)\)/ }).click();
      // O foco vai ao primeiro campo que falta, que pode ser outro além do nome da mãe.
      await expect(page.locator(':focus')).toHaveAttribute('aria-invalid', 'true');
      const mae = campo(page, 'Nome da mãe');
      await expect(mae).toHaveAttribute('aria-invalid', 'true');
      await expect(mae).toHaveAccessibleDescription(/Responda este campo\./);
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
      await expect(comprovante(page)).toContainText('É o que vale');
      await expect(comprovante(page)).toContainText('horário de Belém (PA)');
      await expect(comprovante(page)).toContainText('Uso do nome social');
      await expect(comprovante(page)).toContainText(PERSONA.nomeSocial);
      await expect(comprovante(page)).toContainText(PERSONA.nome);
      await expect(comprovante(page)).toContainText(PERSONA.cpfMascarado);
      await expect(comprovante(page)).toContainText(PERSONA.celular);
      await expect(comprovante(page)).not.toContainText(PERSONA.rg);
      // Município pelo nome, e nenhum código de fato ou IBGE cru na tela.
      await expect(comprovante(page)).toContainText(`${PERSONA.cidade} — MS`);
      await expect(comprovante(page)).toContainText(`${PERSONA.cidade}/MS`);
      await expect(comprovante(page)).toContainText(EDICAO_DO_ENEM);
      await expect(comprovante(page)).toContainText(MUNICIPIO_DO_FATOR);
      await expect(comprovante(page)).toContainText(ORGAO_EMISSOR);
      await expect(comprovante(page)).not.toContainText('Código IBGE');
      await expect(comprovante(page)).not.toContainText(/[A-Z]+_[A-Z_]+/);
      // As modalidades que o envio gravou, pelo nome congelado: escola privada concorre só na ampla.
      await expect(modalidadesDoComprovante(page).getByRole('listitem')).toHaveText([
        /Ampla concorrência/i,
      ]);
    });

    await test.step('o comprovante sai inteiro na impressão, com o cabeçalho institucional e sem o do portal', () =>
      // Janela mais baixa que o comprovante, mas acima de 500 px: abaixo disso o shell libera a
      // rolagem da página (janela baixa) e nenhum ancestral corta, então a precondição ficaria vazia.
      comJanelaDeAltura(page, 600, async () => {
        const altura = await comprovante(page).evaluate((el) => el.getBoundingClientRect().height);
        expect(altura).toBeGreaterThan(600);
        expect(await ancestraisQueCortamOComprovante(page)).not.toEqual([]);

        // O navegador avisa o beforeprint antes de montar o papel; a emulação da mídia, não.
        await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
        await page.emulateMedia({ media: 'print' });
        expect(await ancestraisQueCortamOComprovante(page)).toEqual([]);
        await expect(page.getByRole('banner')).toBeHidden();
        await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeHidden();
        await expect(page.getByRole('contentinfo')).toBeHidden();
        await expect(comprovante(page)).toBeVisible();
        // A seção das modalidades não se parte entre folhas: o título não fica sozinho no pé da página.
        await expect(modalidadesDoComprovante(page).getByRole('listitem')).toHaveText([
          /Ampla concorrência/i,
        ]);
        await expect(modalidadesDoComprovante(page)).toHaveCSS('break-inside', 'avoid');
        await expect(
          page.getByRole('img', {
            name: 'Unifesspa — Universidade Federal do Sul e Sudeste do Pará',
          }),
        ).toBeVisible();
        await expect(
          page.getByText(/^Impresso em \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/u),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Imprimir comprovante' })).toBeHidden();
        // No tema de contraste, a etiqueta da situação tem de continuar legível no papel branco.
        const temaAnterior = await page.evaluate(() => {
          const anterior = document.documentElement.dataset['theme'] ?? '';
          document.documentElement.dataset['theme'] = 'contrast';
          return anterior;
        });
        await expect(page.locator('.tag', { hasText: 'É o que vale' })).toHaveCSS(
          'color',
          'rgb(10, 90, 22)',
        );
        await page.evaluate((tema) => {
          document.documentElement.dataset['theme'] = tema;
        }, temaAnterior);
        // A emulação da mídia não pagina: só o PDF mostra folha em branco ou páginas a mais.
        const comoTexto = async (pageRanges?: string): Promise<string> =>
          (await page.pdf({ preferCSSPageSize: true, pageRanges })).toString('latin1');
        const paginas = (await comoTexto()).match(/\/Type\s*\/Page[^s]/gu) ?? [];
        expect(paginas.length).toBeGreaterThanOrEqual(1);
        expect(paginas.length).toBeLessThanOrEqual(3);
        // A marca é a única imagem do comprovante: na primeira folha, ela prova que a folha não saiu em branco.
        expect(await comoTexto('1')).toMatch(/\/Subtype\s*\/Image/u);
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
      const anterior = page.getByRole('link', { name: '‹ Envio anterior' });
      const destino = (await anterior.getAttribute('href')) ?? '';
      await anterior.click();
      await expect(page).toHaveURL(new RegExp(`${destino}$`));
      await expect(page).toHaveURL(new RegExp('/inscricao/comprovante/[^/]+/\\d+$'));
      await expect(comprovante(page)).toContainText(PERSONA.celular);
      await expect(comprovante(page)).not.toContainText(PERSONA.fixo);
      await expect(comprovante(page)).toContainText('Substituído');
      await expect(page.getByRole('link', { name: 'Ver o envio mais recente' })).toBeVisible();
    });

    await test.step('minhas inscrições mostra a inscrição enviada, sem expor o nome civil', async () => {
      await page.getByRole('link', { name: 'Voltar às minhas inscrições' }).first().click();
      const item = inscricaoNaLista(page, processo);
      await expect(item).toContainText('Enviada');
      await expect(item.getByRole('button', { name: 'Ver comprovante' })).toBeVisible();
      await expect(item).not.toContainText(PERSONA.nome);
    });
  });

  test('quem concluiu por certificação escolhe o caminho do Fator e responde o município dele', async ({
    page,
  }) => {
    const pedido = 'Deseja solicitar o Fator de Atenuação das Desigualdades de Acesso';
    const caminho = pergunta(page, 'Por qual vínculo com a área você solicita o Fator');
    const municipioDoEnsinoMedio = lista(
      page,
      'Em qual município da área de influência você cursou o ensino médio',
    );
    const municipioDeResidencia = lista(
      page,
      'Em qual município da área de abrangência você residiu',
    );

    await test.step('entra na inscrição e declara a conclusão por certificação', async () => {
      await page.goto(`/inscricao/${PROCESSO_ID}`);
      await keycloakLogin(page, PERSONA.usuario, PERSONA.senha, {
        expectRedirectTo: new RegExp(`/inscricao/${PROCESSO_ID}`),
      });
      await irParaSecao(page, 'Ensino médio');
      await escolher(page, 'Como você concluiu o ensino médio', 'Certificação pelo ENCCEJA');
      await lista(page, 'Onde você cursou o ensino médio').selectOption({
        label: 'Concluí por certificação',
      });
    });

    await test.step('a escolha do caminho só aparece com o pedido do Fator, e cada caminho pergunta o seu município', async () => {
      await irParaSecao(page, 'Fator de Atenuação das Desigualdades de Acesso');
      // A inscrição retomada já traz a resposta anterior: o "Não" fixa o ponto de partida.
      await escolher(page, pedido, 'Não');
      await expect(caminho).toHaveCount(0);
      await escolher(page, pedido, 'Sim');
      await expect(caminho).toBeVisible();

      await escolher(
        page,
        'Por qual vínculo com a área você solicita o Fator',
        'Cursei pelo menos um ano do ensino médio na área',
      );
      await expect(municipioDoEnsinoMedio).toBeVisible();
      await expect(municipioDeResidencia).toHaveCount(0);

      await escolher(
        page,
        'Por qual vínculo com a área você solicita o Fator',
        'Residi na área no período do edital',
      );
      await expect(municipioDeResidencia).toBeVisible();
      await expect(municipioDoEnsinoMedio).toHaveCount(0);
      await municipioDeResidencia.selectOption({ label: MUNICIPIO_DE_RESIDENCIA_DO_FATOR });
    });

    await test.step('o envio sai e o comprovante mostra as respostas do Fator', async () => {
      // Egressa por certificação passa a ser perguntada sobre as cotas da lei: segue sem optar por elas.
      await irParaSecao(page, 'Reserva de vagas');
      await escolher(
        page,
        'Deseja concorrer às vagas para quem cursou o ensino médio em escola pública',
        'Não',
      );
      await enviarPeloTeclado(page);
      await expect(page.getByText('Inscrição enviada', { exact: true })).toBeVisible();
      await abrirComprovanteNaLista(page, processo);
      await expect(comprovante(page)).toContainText('Residi na área no período do edital');
      await expect(comprovante(page)).toContainText(MUNICIPIO_DE_RESIDENCIA_DO_FATOR);
      await expect(comprovante(page)).not.toContainText(/[A-Z]+_[A-Z_]+/);
    });
  });

  test('quem não tem nome social na conta é orientado, cadastra em Meu perfil e a inscrição passa a usá-lo', async ({
    page,
    request,
  }) => {
    const processo = await nomeDivulgado(request);
    const recusa =
      'Você marcou que deseja usar nome social, mas sua conta não tem nome social cadastrado.';

    /** A atualização de perfil do Keycloak, aberta a partir de Meu perfil, e a volta ao portal. */
    async function gravarNomeSocialNaConta(valor: string): Promise<void> {
      const acao = page.getByTestId('auth-profile-nome-social-acao');
      if (!(await acao.isVisible())) {
        await page.getByRole('button', { name: /^Abrir menu da conta de / }).click();
        await page.getByTestId('auth-user-profile-item').click();
      }
      await acao.click();
      const nomeSocial = page.getByLabel('Nome social');
      await expect(nomeSocial).toBeVisible();
      // Na conta, o titular edita só o nome social: o nome civil e o e-mail ficam travados.
      await expect(page.locator('input[name="firstName"]')).not.toBeEditable();
      await expect(page.locator('input[name="email"]')).not.toBeEditable();
      await nomeSocial.fill(valor);
      await page.locator('[type="submit"]').first().click();
      await expect(page).toHaveURL(new RegExp(`/inscricao/${PROCESSO_ID}`));
    }

    await test.step('entra sem nome social na conta e escolhe usá-lo: o campo fica vazio e travado, com a orientação', async () => {
      await page.goto(`/inscricao/${PROCESSO_ID}`);
      await keycloakLogin(page, HELENA.usuario, HELENA.senha, {
        expectRedirectTo: new RegExp(`/inscricao/${PROCESSO_ID}`),
      });
      // Uma rodada anterior interrompida pode ter deixado o nome social na conta: o cenário parte
      // da conta sem ele.
      await page.getByRole('button', { name: /^Abrir menu da conta de / }).click();
      await page.getByTestId('auth-user-profile-item').click();
      const acao = page.getByTestId('auth-profile-nome-social-acao');
      if ((await acao.textContent())?.includes('Alterar')) {
        await gravarNomeSocialNaConta('');
      } else {
        await page.keyboard.press('Escape');
        await expect(acao).toBeHidden();
      }
      await preencherDadosDoCandidato(page, HELENA);
      await preencherRestante(page);
    });

    await test.step('o envio é recusado no campo "Nome social", com o caminho para resolver', async () => {
      await enviarPeloTeclado(page);
      await irParaSecao(page, 'Dados do candidato');
      await expect(page.getByText(recusa)).toBeVisible();
      // Só o rascunho se salva: a inscrição já enviada muda apenas por um novo envio.
      const salvar = page.getByRole('button', { name: 'Salvar rascunho' });
      if (await salvar.isVisible()) {
        await salvar.click();
        await expect(page.getByText(/rascunho/i).first()).toBeVisible();
      }
    });

    await test.step('cadastra o nome social em Meu perfil e volta à inscrição com ele, sem novo login', async () => {
      await gravarNomeSocialNaConta(NOME_SOCIAL_DA_HELENA);
      await irParaSecao(page, 'Dados do candidato');
      const nomeSocial = campo(page, 'Nome social');
      await expect(nomeSocial).toHaveValue(NOME_SOCIAL_DA_HELENA);
      await expect(nomeSocial).not.toBeEditable();
    });

    await test.step('o envio sai, e o comprovante registra o uso do nome social da conta', async () => {
      await enviarPeloTeclado(page);
      await expect(page.getByText('Inscrição enviada', { exact: true })).toBeVisible();
      await abrirComprovanteNaLista(page, processo);
      await expect(comprovante(page)).toContainText('Uso do nome social');
      await expect(comprovante(page)).toContainText(NOME_SOCIAL_DA_HELENA);
      await expect(comprovante(page)).toContainText(HELENA.nome);
    });

    await test.step('remove o nome social da conta, para o teste valer de novo', async () => {
      await page.goto(`/inscricao/${PROCESSO_ID}`);
      await gravarNomeSocialNaConta('');
      await page.getByRole('button', { name: /^Abrir menu da conta de / }).click();
      await page.getByTestId('auth-user-profile-item').click();
      await expect(page.getByTestId('auth-profile-nome-social-acao')).toHaveText(
        /Cadastrar nome social/,
      );
    });
  });
});
