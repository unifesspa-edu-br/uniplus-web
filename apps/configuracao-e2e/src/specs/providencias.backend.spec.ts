import { expect, test } from '@playwright/test';
import {
  GESTOR_DE_ACESSOS,
  REPRESENTANTE_DO_CONTROLADOR,
  acharNaListagem,
  chamarApi,
  entrarComoPersona,
  identidadeDoToken,
  tokenDaPersona,
} from '@uniplus/shared-e2e';

/**
 * As providências sobre concessões contra a API real, com os três papéis de governança: o
 * Encarregado de dados solicita e, sem administrar concessões, não responde, o gestor de acessos responde e o
 * Representante do controlador atende com a confirmação do e-mail, revogando a concessão. Usa a
 * concessão ativa da Helena, que a preparação da simulação concede; cada execução a revoga, então
 * a base precisa da preparação de novo para repetir.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4203';
const ENCARREGADO_DE_DADOS = 'isabella.figueiredo';
const BENEFICIARIA = 'helena.rezende';
const ROTA = '/api/autorizacao/providencias';
const FUNDAMENTO = 'Deixou a banca do certame e mantém o acesso aos dados das inscrições.';

interface Concessao {
  readonly id: string;
  readonly ativa: boolean;
  readonly beneficiario: { readonly sub: string };
}

interface Providencia {
  readonly id: string;
  readonly situacao: string;
}

async function concessaoAtivaDa(persona: string): Promise<Concessao> {
  const { sub } = identidadeDoToken(await tokenDaPersona(persona));
  const concessao = await acharNaListagem<Concessao>(
    GESTOR_DE_ACESSOS,
    '/api/autorizacao/concessoes?situacao=ativa&limit=100',
    (c) => c.beneficiario.sub === sub,
  );
  if (concessao === undefined) throw new Error(`${persona} não tem concessão ativa nesta base.`);
  return concessao;
}

/** Responde a aberta que uma execução anterior deixou, para a concessão aceitar uma nova. */
async function encerrarAberta(concessaoId: string): Promise<void> {
  const aberta = await acharNaListagem<Providencia>(
    GESTOR_DE_ACESSOS,
    `${ROTA}?situacao=aberta&concessao=${concessaoId}&limit=20`,
    () => true,
  );
  if (aberta === undefined) return;
  await chamarApi(GESTOR_DE_ACESSOS, 'POST', `${ROTA}/${aberta.id}/resposta`, {
    corpo: { motivo: 'Encerrada pela preparação da spec.' },
  });
}

function solicitar(concessaoId: string) {
  return chamarApi<Providencia>(ENCARREGADO_DE_DADOS, 'POST', ROTA, {
    corpo: { concessaoId, tipo: 'retirada', fundamento: FUNDAMENTO },
  });
}

test.describe('Providências sobre concessões', () => {
  test.describe.configure({ mode: 'serial' });

  let concessao: Concessao;
  let primeira: Providencia;

  test.beforeAll(async () => {
    concessao = await concessaoAtivaDa(BENEFICIARIA);
    await encerrarAberta(concessao.id);
  });

  test('o Encarregado de dados solicita, e a segunda aberta na mesma concessão recebe 409', async () => {
    const criada = await solicitar(concessao.id);
    expect(criada.status, JSON.stringify(criada.corpo)).toBe(201);
    primeira = criada.corpo;
    expect(primeira.situacao).toBe('aberta');

    const repetida = await solicitar(concessao.id);
    expect(repetida.status).toBe(409);
    expect(JSON.stringify(repetida.corpo)).toContain('providencia.ja_ha_aberta');
  });

  test('quem solicitou, sem administrar concessões, não responde, e a tela não lhe oferece a resposta', async ({
    browser,
  }) => {
    const resposta = await chamarApi(
      ENCARREGADO_DE_DADOS,
      'POST',
      `${ROTA}/${primeira.id}/resposta`,
      {
        corpo: { motivo: 'Tentativa de quem solicitou.' },
      },
    );
    expect(resposta.status).toBe(403);

    const pagina = await entrarComoPersona(
      browser,
      APP,
      ENCARREGADO_DE_DADOS,
      `/acessos/providencias/${primeira.id}`,
    );
    await expect(
      pagina.getByRole('heading', { name: 'Providência sobre concessão', level: 1 }),
    ).toBeVisible();
    await expect(pagina.getByRole('button', { name: 'Responder' })).toHaveCount(0);
  });

  test('o gestor de acessos responde com motivo, sem revogar', async () => {
    const resposta = await chamarApi<Providencia>(
      GESTOR_DE_ACESSOS,
      'POST',
      `${ROTA}/${primeira.id}/resposta`,
      {
        corpo: { motivo: 'A banca segue até o fim do certame.' },
      },
    );
    expect(resposta.status, JSON.stringify(resposta.corpo)).toBe(200);
    expect(resposta.corpo.situacao).toBe('respondida');
    expect((await concessaoAtivaDa(BENEFICIARIA)).id).toBe(concessao.id);
  });

  test('o Representante do controlador atende pela tela, com o e-mail da beneficiária, e a concessão é revogada', async ({
    browser,
  }) => {
    const segunda = await solicitar(concessao.id);
    expect(segunda.status, JSON.stringify(segunda.corpo)).toBe(201);
    const { email } = identidadeDoToken(await tokenDaPersona(BENEFICIARIA));

    const pagina = await entrarComoPersona(
      browser,
      APP,
      REPRESENTANTE_DO_CONTROLADOR,
      `/acessos/providencias/${segunda.corpo.id}`,
    );
    await pagina.getByRole('button', { name: 'Atender e revogar a concessão' }).click();
    const dialogo = pagina.getByRole('dialog', { name: 'Revogar a concessão' });
    await dialogo.getByRole('textbox', { name: 'Motivo' }).fill('Deixou a banca do certame.');
    await dialogo.getByRole('textbox', { name: 'E-mail do beneficiário' }).fill(email);
    await dialogo.getByRole('button', { name: 'Revogar concessão' }).click();

    await expect(pagina.getByText('Atendida', { exact: true })).toBeVisible();
    const lida = await chamarApi<Concessao>(
      GESTOR_DE_ACESSOS,
      'GET',
      `/api/autorizacao/concessoes/${concessao.id}`,
    );
    expect(lida.corpo.ativa).toBe(false);
  });
});
