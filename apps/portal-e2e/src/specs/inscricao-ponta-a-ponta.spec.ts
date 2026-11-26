import { expect, test } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { keycloakLogin } from '../support/keycloak-login';
import {
  EDICAO_DO_ENEM,
  HELENA,
  MUNICIPIO_DE_RESIDENCIA_DO_FATOR,
  MUNICIPIO_DO_FATOR,
  NOME_SOCIAL_DA_HELENA,
  ORGAO_EMISSOR,
  PERSONA,
  PROCESSO_ID,
  somenteDigitos,
} from '../support/persona-da-inscricao';
import {
  campo,
  escolher,
  irParaSecao,
  lista,
  pergunta,
  preencherDadosDoCandidato,
  preencherRestante,
} from '../support/preenchimento-da-inscricao';
import {
  abrirComprovanteNaLista,
  abrirInscricaoComo,
  abrirVitrineDo,
  ancestraisQueCortamOComprovante,
  comJanelaDeAltura,
  comprovante,
  enviarPeloTeclado,
  gravarNomeSocialNaConta,
  inscricaoNaLista,
  modalidadesDoComprovante,
  nomeDivulgado,
  partirDaContaSemNomeSocial,
  salvarRascunhoSeHouver,
  segurarGravacao,
} from '../support/passos-da-inscricao';

test.describe('Inscrição do candidato de ponta a ponta', () => {
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
      await abrirVitrineDo(page, processo);
      const verEdital = page
        .getByRole('link', { name: `Ver edital — ${processo} (abre em nova aba)` })
        .first();
      await expect(verEdital).toHaveAttribute('href', /\/editais\/.+\.pdf$/);
      const pdf = await page.request.get((await verEdital.getAttribute('href')) ?? '');
      expect(pdf.ok()).toBe(true);
      expect(pdf.headers()['content-type']).toBe('application/pdf');
    });
    await test.step('"Ver publicações" lista os atos do certame, com o PDF, e não oferece inscrição', async () => {
      await abrirVitrineDo(page, processo);
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
      await abrirVitrineDo(page, processo);
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
      await page
        .getByRole('button', { name: /^Dados do candidato\s*:?\s*\(\d+ (item|itens)\)/ })
        .click();
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
      await expect(comprovante(page)).toContainText('Envio 1 de 1');
      await expect(comprovante(page)).toContainText('horário de Belém (PA)');
      await expect(comprovante(page)).toContainText('Uso do nome social');
      await expect(comprovante(page)).toContainText(PERSONA.nomeSocial);
      await expect(comprovante(page)).toContainText(PERSONA.nome);
      await expect(comprovante(page)).toContainText(PERSONA.cpfMascarado);
      await expect(comprovante(page)).toContainText(somenteDigitos(PERSONA.celular));
      await expect(comprovante(page)).not.toContainText(PERSONA.rg);
      // Município pelo nome, e nenhum código de fato ou IBGE cru na tela.
      await expect(
        comprovante(page).locator('dl > div', {
          has: page.getByText('Município de nascimento', { exact: true }),
        }),
      ).toHaveText(new RegExp(`^\\s*Município de nascimento\\s*${PERSONA.cidade}\\s*$`));
      await expect(comprovante(page)).not.toContainText(`${PERSONA.cidade} — MS`);
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
    await test.step('o aviso do envio leva ao comprovante novo, que traz a correção; o anterior continua igual', async () => {
      await page.getByRole('link', { name: 'Ver o comprovante' }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Comprovante de inscrição' }),
      ).toBeVisible();
      await expect(comprovante(page)).toContainText('Envio 2 de 2');
      await expect(comprovante(page)).toContainText(somenteDigitos(PERSONA.fixo));
      const anterior = page.getByRole('link', { name: '‹ Envio anterior' });
      const destino = await anterior.getAttribute('href');
      expect(destino).not.toBeNull();
      await anterior.click();
      await expect(page).toHaveURL(new RegExp(`${String(destino)}$`));
      await expect(page).toHaveURL(new RegExp('/inscricao/comprovante/[^/]+/\\d+$'));
      await expect(comprovante(page)).toContainText(somenteDigitos(PERSONA.celular));
      await expect(comprovante(page)).not.toContainText(somenteDigitos(PERSONA.fixo));
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

  test('Enter e Espaço em Enviar inscrição durante a gravação não geram segunda requisição', async ({
    page,
  }) => {
    const gravacao = await segurarGravacao(page, 'inscricao/envio', 'POST');
    await abrirInscricaoComo(page, PERSONA.usuario);
    const enviar = page.getByRole('button', { name: 'Enviar inscrição' });
    await expect(enviar).not.toHaveAttribute('aria-disabled', 'true');
    await enviar.focus();

    await page.keyboard.press('Enter');
    const enviando = page.getByRole('button', { name: 'Enviando…' });
    await expect(enviando).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await enviando.dispatchEvent('click');

    expect(gravacao.pedidos()).toBe(1);
    gravacao.liberar();
    await expect(page.getByText('Inscrição enviada', { exact: true })).toBeVisible();
    expect(gravacao.pedidos()).toBe(1);
  });

  test('Enter e Espaço em Salvar rascunho durante a gravação não geram segunda requisição', async ({
    page,
  }) => {
    const gravacao = await segurarGravacao(page, 'inscricao', 'PUT');
    await abrirInscricaoComo(page, 'betina.neves');
    const salvar = page.getByRole('button', { name: 'Salvar rascunho' });
    await salvar.focus();

    await page.keyboard.press('Enter');
    const salvando = page.getByRole('button', { name: 'Salvando…' });
    await expect(salvando).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await salvando.dispatchEvent('click');

    expect(gravacao.pedidos()).toBe(1);
    gravacao.liberar();
    await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeFocused();
    expect(gravacao.pedidos()).toBe(1);
  });

  test('quem não tem nome social na conta é orientado, cadastra em Meu perfil e a inscrição passa a usá-lo', async ({
    page,
    request,
  }) => {
    const processo = await nomeDivulgado(request);
    const recusa =
      'Você marcou que deseja usar nome social, mas sua conta não tem nome social cadastrado.';

    await test.step('entra sem nome social na conta e escolhe usá-lo: o campo fica vazio e travado, com a orientação', async () => {
      await page.goto(`/inscricao/${PROCESSO_ID}`);
      await keycloakLogin(page, HELENA.usuario, HELENA.senha, {
        expectRedirectTo: new RegExp(`/inscricao/${PROCESSO_ID}`),
      });
      await partirDaContaSemNomeSocial(page);
      await preencherDadosDoCandidato(page, HELENA);
      await preencherRestante(page);
    });

    await test.step('o envio é recusado no campo "Nome social", com o caminho para resolver', async () => {
      await enviarPeloTeclado(page);
      await irParaSecao(page, 'Dados do candidato');
      await expect(page.getByText(recusa)).toBeVisible();
      // Só o rascunho se salva: a inscrição já enviada muda apenas por um novo envio.
      await salvarRascunhoSeHouver(page);
    });

    await test.step('cadastra o nome social em Meu perfil e volta à inscrição com ele, sem novo login', async () => {
      await gravarNomeSocialNaConta(page, NOME_SOCIAL_DA_HELENA);
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
      await gravarNomeSocialNaConta(page, '');
      await page.getByRole('button', { name: /^Abrir menu da conta de / }).click();
      await page.getByTestId('auth-user-profile-item').click();
      await expect(page.getByTestId('auth-profile-nome-social-acao')).toHaveText(
        /Cadastrar nome social/,
      );
    });
  });
});
