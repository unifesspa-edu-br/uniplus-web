import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { keycloakLogin } from './keycloak-login';
import { API_URL, PERSONA, PROCESSO_ID } from './persona-da-inscricao';

export async function enviarPeloTeclado(page: Page): Promise<void> {
  const enviar = page.getByRole('button', { name: 'Enviar inscrição' });
  // O botão só se ativa com o formulário válido; o foco só se fixa nele depois disso.
  await expect(enviar).toBeEnabled();
  await enviar.focus();
  await expect(enviar).toBeFocused();
  await page.keyboard.press('Enter');
}

/**
 * A vitrine pagina os certames por data de encerramento, e a base local acumula processos de
 * teste: a busca traz o processo da execução à primeira página.
 */
export async function abrirVitrineDo(page: Page, processo: string): Promise<void> {
  await page.goto('/processos');
  await page.getByRole('searchbox', { name: 'Buscar por edital ou título' }).fill(processo);
  await expect(page.getByRole('heading', { level: 3, name: processo }).first()).toBeVisible();
}

/** O nome com que o processo de teste foi divulgado, como a lista de inscrições o mostra. */
export async function nomeDivulgado(request: APIRequestContext): Promise<string> {
  const certame = await request.get(`${API_URL}/api/selecao/certames/${PROCESSO_ID}`, {
    headers: { Accept: 'application/vnd.uniplus.certame.v1+json' },
  });
  expect(certame.ok()).toBe(true);
  return ((await certame.json()) as { nome: string }).nome;
}

/** A inscrição do processo de teste na lista: o candidato pode ter inscrições em outros processos. */
export const inscricaoNaLista = (page: Page, processo: string): Locator =>
  page
    .getByRole('listitem')
    .or(page.getByRole('article'))
    .filter({ has: page.getByRole('heading', { name: processo, exact: true }) });

export async function abrirComprovanteNaLista(page: Page, processo: string): Promise<void> {
  await page.getByRole('link', { name: 'Ver minhas inscrições' }).click();
  const item = inscricaoNaLista(page, processo);
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: 'Ver comprovante' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Comprovante de inscrição' }),
  ).toBeVisible();
}

/** O documento do comprovante fica no conteúdo principal da página. */
export const comprovante = (page: Page): Locator => page.getByRole('main');

/** A seção do comprovante com as modalidades em que o envio concorre. */
export const modalidadesDoComprovante = (page: Page): Locator =>
  comprovante(page).locator('ui-secao-de-documento', {
    has: page.getByRole('heading', { name: 'Modalidades de concorrência' }),
  });

/**
 * Ancestrais do comprovante que, na mídia corrente, cortam o que passa da própria altura. Na
 * impressão o único que pode crescer é o documento: qualquer outro corta o papel na primeira tela.
 */
export const ancestraisQueCortamOComprovante = (page: Page): Promise<string[]> =>
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
export async function comJanelaDeAltura(
  page: Page,
  altura: number,
  passo: () => Promise<void>,
): Promise<void> {
  const janela = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.setViewportSize({ width: janela.width, height: altura });
  await passo();
  await page.setViewportSize(janela);
}

/** Abre a tela Meu perfil pelo menu da conta. */
export async function abrirMeuPerfil(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Abrir menu da conta de / }).click();
  await page.getByTestId('auth-user-profile-item').click();
}

/** A atualização de perfil do Keycloak, aberta a partir de Meu perfil, e a volta ao portal. */
export async function gravarNomeSocialNaConta(page: Page, valor: string): Promise<void> {
  const acao = page.getByTestId('auth-profile-nome-social-acao');
  if (!(await acao.isVisible())) await abrirMeuPerfil(page);
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

/**
 * Uma rodada anterior interrompida pode ter deixado o nome social na conta: o cenário parte da
 * conta sem ele.
 */
export async function partirDaContaSemNomeSocial(page: Page): Promise<void> {
  await abrirMeuPerfil(page);
  const acao = page.getByTestId('auth-profile-nome-social-acao');
  if ((await acao.textContent())?.includes('Alterar')) {
    await gravarNomeSocialNaConta(page, '');
    return;
  }
  await page.keyboard.press('Escape');
  await expect(acao).toBeHidden();
}

/** Só o rascunho se salva: a inscrição já enviada muda apenas por um novo envio. */
export async function salvarRascunhoSeHouver(page: Page): Promise<void> {
  const salvar = page.getByRole('button', { name: 'Salvar rascunho' });
  if (!(await salvar.isVisible())) return;
  await salvar.click();
  await expect(page.getByText(/rascunho/i).first()).toBeVisible();
}

function aguardarLiberacao() {
  let liberar!: () => void;
  const espera = new Promise<void>((resolver) => (liberar = resolver));
  return { espera, liberar };
}

/**
 * Segura a primeira gravação que sai para `sufixo` e conta quantas saem. O navegador real é quem
 * prova que Enter e Espaço no botão indisponível não geram outra requisição.
 */
type GravacaoSegurada = { pedidos: () => number; liberar: () => void };

export async function segurarGravacao(
  page: Page,
  sufixo: string,
  metodo: 'PUT' | 'POST',
): Promise<GravacaoSegurada> {
  let total = 0;
  const { espera, liberar } = aguardarLiberacao();
  await page.route(`**/api/selecao/processos-seletivos/${PROCESSO_ID}/${sufixo}`, async (rota) => {
    if (rota.request().method() !== metodo) return rota.continue();
    total++;
    await espera;
    return rota.continue();
  });
  return { pedidos: () => total, liberar };
}

export async function abrirInscricaoComo(page: Page, usuario: string): Promise<void> {
  await page.goto(`/inscricao/${PROCESSO_ID}`);
  await keycloakLogin(page, usuario, PERSONA.senha, {
    expectRedirectTo: new RegExp(`/inscricao/${PROCESSO_ID}`),
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Inscrição' })).toBeVisible();
}
