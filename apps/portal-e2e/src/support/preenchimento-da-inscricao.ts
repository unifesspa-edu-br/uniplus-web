import { expect, type Locator, type Page } from '@playwright/test';
import { assertDocumentoSemRolagemVertical } from '@uniplus/shared-e2e';
import {
  EDICAO_DO_ENEM,
  MUNICIPIO_DO_FATOR,
  ORGAO_EMISSOR,
  PERSONA,
  type Persona,
} from './persona-da-inscricao';

export const campo = (page: Page, rotulo: string): Locator =>
  page.getByRole('textbox', { name: new RegExp(`^${rotulo}`) });

export const lista = (page: Page, rotulo: string): Locator =>
  page.getByRole('combobox', { name: new RegExp(`^${rotulo}`) });

/** O rádio tem um marcador visual sobre o input: escolhe-se pelo rótulo, como o candidato. */
export async function escolher(
  page: Page,
  pergunta: string | RegExp,
  opcao: string,
): Promise<void> {
  await page
    .getByRole('group', {
      name: typeof pergunta === 'string' ? new RegExp(`^${pergunta}`) : pergunta,
    })
    .getByText(opcao, { exact: true })
    .click();
}

export async function irParaSecao(page: Page, secao: string): Promise<void> {
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

async function conferirNomesDaConta(page: Page, persona: Persona): Promise<void> {
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
}

async function preencherDocumentoDeIdentidade(page: Page, persona: Persona): Promise<void> {
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
}

async function preencherNascimentoEFiliacao(page: Page, persona: Persona): Promise<void> {
  await recusarNascimentoNoFuturo(page);
  await campo(page, 'Data de nascimento').fill(persona.nascimento);
  await expect(campo(page, 'Data de nascimento')).not.toHaveAttribute('aria-invalid', 'true');
  await lista(page, 'UF de nascimento').selectOption({ label: persona.uf });
  await municipio(page, 'Município de nascimento', persona.cidade);
  await campo(page, 'Nome da mãe').fill(persona.mae);
  await campo(page, 'Nome do pai').fill(persona.pai);
  await escolher(page, 'Estado civil', 'Solteiro(a)');
}

async function preencherContato(page: Page, persona: Persona): Promise<void> {
  // "Sexo civil" também começa por "Sexo": o nome do grupo é conferido inteiro.
  await escolher(page, /^Sexo biológico \*?$/, 'Feminino');
  await escolher(page, 'Cor ou raça', 'Branca');
  await campo(page, 'E-mail').fill(persona.email);
  await campo(page, 'Telefone').fill(persona.celular);
  await lista(page, 'Tipo de localidade').selectOption({ label: 'Zona urbana' });
}

async function preencherEndereco(page: Page, persona: Persona): Promise<void> {
  const endereco = page.getByRole('group', { name: /^Endereço residencial/ });
  // Na inscrição retomada o CEP já resolvido fica travado até "Trocar CEP".
  if (!(await endereco.getByRole('button', { name: 'Trocar CEP' }).isVisible())) {
    await endereco.getByRole('textbox', { name: 'CEP' }).fill(persona.cep);
    await endereco.getByRole('button', { name: 'Buscar CEP' }).click();
  }
  await expect(endereco.getByRole('textbox', { name: 'Cidade' })).toHaveValue(persona.cidade);
  await endereco.getByRole('textbox', { name: /^Número/ }).fill(persona.numero);
}

async function preencherIdentidade(page: Page): Promise<void> {
  await escolher(page, 'Sexo civil', 'Feminino');
  await escolher(page, 'Identidade de gênero', 'Prefiro não informar');
  await escolher(page, 'Orientação sexual', 'Prefiro não informar');
}

export async function preencherDadosDoCandidato(
  page: Page,
  persona: Persona = PERSONA,
): Promise<void> {
  await irParaSecao(page, 'Dados do candidato');
  await conferirNomesDaConta(page, persona);
  await preencherDocumentoDeIdentidade(page, persona);
  await preencherNascimentoEFiliacao(page, persona);
  await preencherContato(page, persona);
  await preencherEndereco(page, persona);
  await preencherIdentidade(page);
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

export const pergunta = (page: Page, rotulo: string): Locator =>
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
async function optarPelasCotas(page: Page): Promise<void> {
  await declararOndeCursou(page, 'Somente em escola pública');
  await irParaSecao(page, 'Reserva de vagas');
  await escolher(page, 'Você é pessoa com deficiência', 'Não');
  await escolher(
    page,
    'Deseja concorrer às vagas para quem cursou o ensino médio em escola pública',
    'Sim',
  );
}

async function conferirReservaParaPessoaBranca(page: Page): Promise<void> {
  const reserva = perguntasDaReserva(page);
  await optarPelasCotas(page);
  // Branca que optou pelas cotas responde quilombola e renda, mas não a PPI nem o pertencimento.
  await expect(reserva.quilombola).toBeVisible();
  await expect(reserva.renda).toBeVisible();
  await expect(reserva.ppi).toHaveCount(0);
  await expect(reserva.pertencimentoIndigena).toHaveCount(0);
}

async function conferirReservaParaPessoaParda(page: Page): Promise<void> {
  const reserva = perguntasDaReserva(page);
  await declararCor(page, 'Parda');
  await irParaSecao(page, 'Reserva de vagas');
  await expect(reserva.ppi).toBeVisible();
  await expect(reserva.pertencimentoIndigena).toHaveCount(0);
}

async function conferirReservaParaPessoaIndigena(page: Page): Promise<void> {
  const reserva = perguntasDaReserva(page);
  // Indígena confirma o pertencimento antes de a PPI aparecer.
  await declararCor(page, 'Indígena');
  await irParaSecao(page, 'Reserva de vagas');
  await escolher(page, 'Você pertence a um povo indígena', 'Não');
  await expect(reserva.pertencimentoIndigena).toBeVisible();
  await expect(reserva.ppi).toHaveCount(0);
  await escolher(page, 'Você pertence a um povo indígena', 'Sim');
  await expect(reserva.ppi).toBeVisible();
}

async function conferirReservaPelaElegibilidade(page: Page): Promise<void> {
  await conferirReservaParaPessoaBranca(page);
  await conferirReservaParaPessoaParda(page);
  await conferirReservaParaPessoaIndigena(page);
  await declararCor(page, 'Branca');
  await declararOndeCursou(page, 'Escola privada');
}

async function preencherEnemEEnsinoMedio(page: Page): Promise<void> {
  await irParaSecao(page, 'ENEM');
  await escolher(page, 'Qual edição do ENEM você vai usar', EDICAO_DO_ENEM);

  await irParaSecao(page, 'Ensino médio');
  await escolher(page, 'Como você concluiu o ensino médio', 'Ensino médio regular');
  await lista(page, 'Onde você cursou o ensino médio').selectOption({ label: 'Escola privada' });
}

async function conferirCaminhoDoFator(page: Page): Promise<void> {
  const caminhoDoFator = page.getByRole('group', {
    name: /^Por qual vínculo com a área você solicita o Fator/,
  });
  const residenciaDoFator = lista(page, 'Em qual município da área de abrangência você residiu');
  await expect(caminhoDoFator).toHaveCount(0);
  await expect(residenciaDoFator).toHaveCount(0);
}

async function preencherFator(page: Page): Promise<void> {
  await irParaSecao(page, 'Fator de Atenuação das Desigualdades de Acesso');
  // Quem concluiu o ensino médio regular informa o município em que o cursou, sem escolher caminho.
  const municipioDoFator = lista(
    page,
    'Em qual município da área de influência você cursou o ensino médio',
  );
  // A inscrição retomada já traz a resposta anterior: o "Não" fixa o ponto de partida.
  await escolher(page, 'Deseja solicitar o Fator de Atenuação das Desigualdades de Acesso', 'Não');
  await expect(municipioDoFator).toHaveCount(0);
  await escolher(page, 'Deseja solicitar o Fator de Atenuação das Desigualdades de Acesso', 'Sim');
  await expect(municipioDoFator).toBeVisible();
  await conferirCaminhoDoFator(page);
  await municipioDoFator.selectOption({ label: MUNICIPIO_DO_FATOR });
}

async function conferirReservaSemCotas(page: Page): Promise<void> {
  // De volta à escola privada, nenhuma pergunta de cota da lei se faz. O formulário calcula a
  // exibição no navegador, junto com o desenho da seção: aberta a seção, a ausência das perguntas
  // de cota já é a definitiva.
  await irParaSecao(page, 'Reserva de vagas');
  const reserva = perguntasDaReserva(page);
  await escolher(page, 'Você é pessoa com deficiência', 'Não');
  for (const ausente of [reserva.escolaPublica, reserva.quilombola, reserva.ppi, reserva.renda]) {
    await expect(ausente).toHaveCount(0);
  }
}

async function conferirRolagemDaReserva(page: Page): Promise<void> {
  // A página rola só pela área de conteúdo: nenhuma opção estica o documento, e o foco pelo
  // teclado no último controle rola a área, não a janela.
  await assertDocumentoSemRolagemVertical(page);
  await page.getByRole('radio').last().focus();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
}

async function conferirModalidades(page: Page): Promise<void> {
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
}

async function conferirDocumentos(page: Page): Promise<void> {
  // O processo de validação só pede documentos na habilitação: nesta fase a avaliação não pede nada.
  await irParaSecao(page, 'Documentos');
  const documentos = page.locator('ui-documentos-da-inscricao');
  await expect(documentos).toHaveAttribute('aria-busy', 'false', { timeout: 10_000 });
  await expect(documentos).toContainText('Você não envia documentos nesta etapa.');
  await expect(documentos.getByRole('heading', { level: 4 })).toHaveCount(0);
}

async function revisarEAceitarTermos(page: Page): Promise<void> {
  await irParaSecao(page, 'Revisão e aceite');
  await expect(
    page
      .locator('ui-modalidades-da-inscricao')
      .getByRole('list', { name: 'Modalidades em que você concorre' })
      .getByRole('listitem'),
  ).toHaveText([/Ampla concorrência/i]);
  await aceitarTermos(page);
}

async function aceitarTermos(page: Page): Promise<void> {
  // Na inscrição retomada os termos já vêm aceitos: clicar de novo os desmarcaria.
  for (const termo of await page.getByRole('article').all()) {
    if (!(await termo.getByRole('checkbox').isChecked())) {
      await termo.getByText('Li e aceito (obrigatório)').click();
    }
    await expect(termo.getByRole('checkbox')).toBeChecked();
  }
}

export async function preencherRestante(page: Page): Promise<void> {
  await preencherEnemEEnsinoMedio(page);
  await preencherFator(page);
  await conferirReservaPelaElegibilidade(page);
  await conferirReservaSemCotas(page);
  await conferirRolagemDaReserva(page);
  await conferirSemAtendimentoEspecializado(page);
  await conferirModalidades(page);
  await conferirDocumentos(page);
  await revisarEAceitarTermos(page);
}
