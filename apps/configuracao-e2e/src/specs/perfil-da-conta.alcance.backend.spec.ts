import { test, expect } from '@playwright/test';
import {
  OPERADOR_DO_ROTEIRO,
  chamarApi,
  entrarComoPersona,
  garantirOperadorDoRoteiro,
} from '@uniplus/shared-e2e';

/**
 * O alcance de cada perfil na conta da pessoa (menu do cabeçalho e Meu perfil) contra a API real.
 * A persona é o operador do roteiro de processo de teste, que recebe um perfil da instituição
 * inteira (cadastros) e outro na unidade do certame; a spec garante os dois antes de conferir.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4203';
const PERSONA = OPERADOR_DO_ROTEIRO;

interface PerfilDaApi {
  readonly nome: string;
  readonly escopoTipo: { readonly codigo: 'UNIDADE' | 'INSTITUICAO'; readonly rotulo: string };
  readonly unidadeSigla: string | null;
  readonly unidadeNome: string | null;
}

async function perfisDaApi(): Promise<readonly PerfilDaApi[]> {
  const resposta = await chamarApi<{ perfis: readonly PerfilDaApi[] }>(
    PERSONA,
    'GET',
    '/api/profile/me',
  );
  expect(resposta.status).toBe(200);
  return resposta.corpo.perfis;
}

function alcanceEsperado(perfil: PerfilDaApi): string {
  return perfil.escopoTipo.codigo === 'INSTITUICAO'
    ? perfil.escopoTipo.rotulo
    : (perfil.unidadeSigla ?? perfil.unidadeNome ?? '');
}

test.describe('Alcance do perfil na conta da pessoa', () => {
  test.beforeAll(async () => {
    test.setTimeout(600_000);
    await garantirOperadorDoRoteiro();
  });

  test('o perfil da instituição e o da unidade mostram cada um o seu alcance no menu e em Meu perfil', async ({
    browser,
  }) => {
    const perfis = await perfisDaApi();
    const institucional = perfis.find((p) => p.escopoTipo.codigo === 'INSTITUICAO');
    const daUnidade = perfis.find((p) => p.escopoTipo.codigo === 'UNIDADE');
    if (!institucional || !daUnidade) throw new Error('A persona precisa dos dois perfis.');
    const esperados = [institucional, daUnidade].map((p) => `${p.nome} — ${alcanceEsperado(p)}`);

    const pagina = await entrarComoPersona(browser, APP, PERSONA);
    await pagina.getByRole('button', { name: /^Abrir menu da conta de / }).click();
    const noMenu = pagina.getByTestId('auth-user-perfis');
    for (const texto of esperados) await expect(noMenu, texto).toContainText(texto);

    await pagina.getByTestId('auth-user-profile-item').click();
    const emMeuPerfil = pagina.getByTestId('auth-profile-perfis');
    for (const texto of esperados) await expect(emMeuPerfil, texto).toContainText(texto);
    await expect(emMeuPerfil).not.toContainText('Unidade não identificada');
  });
});
