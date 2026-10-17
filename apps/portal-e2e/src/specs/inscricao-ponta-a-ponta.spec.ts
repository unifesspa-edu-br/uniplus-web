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
const MUNICIPIO_DE_RESIDENCIA_DO_FATOR = 'Imperatriz/MA';
const ORGAO_EMISSOR = 'Secretaria de Segurança Pública (SSP)';

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

async function preencherDadosDoCandidato(page: Page): Promise<void> {
  await irParaSecao(page, 'Dados do candidato');
  // O nome civil vem da conta e não se edita.
  const nome = campo(page, 'Nome completo');
  await expect(nome).toHaveValue(PERSONA.nome);
  await expect(nome).not.toBeEditable();
  // O nome social também vem da conta: só a escolha de usá-lo é do candidato.
  await escolher(page, 'Deseja usar nome social', 'Sim');
  const nomeSocial = campo(page, 'Nome social');
  await expect(nomeSocial).toHaveValue(PERSONA.nomeSocial);
  await expect(nomeSocial).not.toBeEditable();
  await escolher(page, 'Nacionalidade', 'Brasileiro nato');
  await expect(campo(page, 'CPF')).toHaveValue(PERSONA.cpfMascarado);
  await campo(page, 'Número do RG').fill(PERSONA.rg);
  // Só o "Outro" pede o nome do órgão; com um órgão da lista, o campo sai de novo.
  const orgaoEmissor = lista(page, 'Órgão emissor do RG');
  const nomeDoOrgao = campo(page, 'Nome do órgão emissor');
  await orgaoEmissor.selectOption({ label: 'Outro' });
  await expect(nomeDoOrgao).toBeVisible();
  await orgaoEmissor.selectOption({ label: ORGAO_EMISSOR });
  await expect(nomeDoOrgao).toHaveCount(0);
  await lista(page, 'UF de emissão do RG').selectOption({ label: PERSONA.uf });
  await campo(page, 'Data de emissão do RG').fill('1990-05-10');
  await recusarNascimentoNoFuturo(page);
  await campo(page, 'Data de nascimento').fill(PERSONA.nascimento);
  await expect(campo(page, 'Data de nascimento')).not.toHaveAttribute('aria-invalid', 'true');
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

/**
 * O pedido de atendimento especializado: com "Sim" aparecem a condição e o recurso, e a condição fora
 * da lista pede descrição; com "Não" os três somem. A inscrição segue com "Não".
 */
async function responderAtendimentoEspecializado(page: Page): Promise<void> {
  const pedido = 'Você precisa de atendimento especializado em alguma etapa presencial do processo';
  const condicoes = page.getByRole('group', { name: /^Em quais condições você se enquadra/ });
  const recursos = page.getByRole('group', {
    name: /^De quais recursos você vai precisar nas etapas presenciais/,
  });
  const descricao = campo(page, 'Descreva a sua condição específica');

  await irParaSecao(page, 'Atendimento especializado');
  // A inscrição retomada já traz a resposta anterior: o "Não" fixa o ponto de partida.
  await escolher(page, pedido, 'Não');
  await expect(condicoes).toHaveCount(0);
  await expect(recursos).toHaveCount(0);

  await escolher(page, pedido, 'Sim');
  await expect(condicoes).toBeVisible();
  await expect(recursos).toBeVisible();
  const outraCondicao = condicoes.getByRole('checkbox', { name: 'Outra condição específica' });
  if (!(await outraCondicao.isChecked())) {
    await condicoes.getByText('Outra condição específica', { exact: true }).click();
  }
  await expect(outraCondicao).toBeChecked();
  await expect(descricao).toBeVisible();

  await escolher(page, pedido, 'Não');
  await expect(condicoes).toHaveCount(0);
  await expect(recursos).toHaveCount(0);
  await expect(descricao).toHaveCount(0);
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

  await responderAtendimentoEspecializado(page);

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
        name: /^Ver documento \(PDF\) — Edital de abertura/,
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

    await test.step('o envio com obrigatório em branco não sai: anuncia e liga o campo à mensagem', async () => {
      await irParaSecao(page, 'Dados do candidato');
      await campo(page, 'Nome completo').fill('');
      await enviarPeloTeclado(page);
      await expect(page.getByText(/^Há (1 item|\d+ itens) a corrigir\./)).toBeAttached();
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
      await expect(page).toHaveURL(new RegExp(`/inscricao/${PROCESSO_ID}/comprovantes/\\d+$`));
      await expect(comprovante(page)).toContainText(PERSONA.celular);
      await expect(comprovante(page)).not.toContainText(PERSONA.fixo);
      await expect(comprovante(page)).toContainText('Substituído');
      await expect(page.getByRole('link', { name: 'Ver o envio mais recente' })).toBeVisible();
    });

    await test.step('minhas inscrições mostra a inscrição com o nome social', async () => {
      await page.getByRole('link', { name: 'Voltar às minhas inscrições' }).first().click();
      const item = inscricaoNaLista(page, processo);
      await expect(item).toContainText(PERSONA.nomeSocial);
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
});
