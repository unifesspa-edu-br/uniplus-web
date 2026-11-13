import { expect, test } from '@playwright/test';
import {
  GESTOR_DE_ACESSOS,
  SEGUNDO_GESTOR_DE_ACESSOS,
  chamarApi,
  entrarComoPersona,
  garantirConcessao,
  garantirPerfil,
  identidadeDoToken,
  tokenDaPersona,
  unidadeDoCertame,
} from '@uniplus/shared-e2e';

/**
 * O termo de responsabilidade contra a API real: o gestor de acessos publica uma versão, o pedido
 * de perfil protegido fixa a versão vigente e o aceite exige a versão fixada; a versão divergente
 * dá 409. O Encarregado de dados (perfil de sistema 3) só consulta. Cada execução publica uma
 * versão nova, com texto próprio.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4203';
const ROTA_DO_TERMO = '/api/autorizacao/termos-de-responsabilidade';
const ROTA_DOS_PEDIDOS = '/api/autorizacao/pedidos-de-concessao';
const SOLICITANTE = 'manoel.aparicio';
const ENCARREGADO_DE_DADOS = 'isabella.figueiredo';
const PERFIL_DO_ENCARREGADO = '019a0000-0000-7000-8000-000000000003';
const VERSAO_QUALQUER = '01960000-0000-7000-0000-0000000000ff';

interface VersaoDoTermo {
  readonly id: string;
  readonly numero: number;
}

interface Pedido {
  readonly id: string;
  readonly situacao: string;
  readonly termo: { readonly versaoId: string } | null;
}

/** A pessoa beneficiária do pedido feito por outra pessoa: aceita depois, com a versão fixada. */
const BENEFICIARIO = SEGUNDO_GESTOR_DE_ACESSOS;

async function vigente(): Promise<VersaoDoTermo | null> {
  const lida = await chamarApi<VersaoDoTermo>(GESTOR_DE_ACESSOS, 'GET', `${ROTA_DO_TERMO}/vigente`);
  return lida.status === 200 ? lida.corpo : null;
}

function textoDaVersao(sufixo: number): string {
  return (
    `Termo de responsabilidade da execução ${sufixo}. ` +
    'Quem recebe acesso a dado pessoal ou sensível usa o dado só para a finalidade do processo ' +
    'seletivo, não o copia nem o compartilha fora do sistema, e comunica à gestão de acessos ' +
    'qualquer uso indevido de que tenha conhecimento.'
  );
}

async function pedir(
  perfilId: string,
  versaoId: string | null,
  beneficiarioEmail: string | null = null,
) {
  const unidadeId = await unidadeDoCertame();
  return chamarApi<Pedido>(SOLICITANTE, 'POST', ROTA_DOS_PEDIDOS, {
    corpo: {
      beneficiarioEmail,
      perfilId,
      unidadeId,
      justificativa: 'Conferência do termo de responsabilidade pela simulação.',
      anexaraDocumento: false,
      termoVersaoApresentadaId: versaoId,
    },
  });
}

test.describe('Termo de responsabilidade', () => {
  test.describe.configure({ mode: 'serial' });

  const sufixo = Date.now();
  let versao: VersaoDoTermo;
  let perfilProtegido: string;

  test.beforeAll(async () => {
    test.setTimeout(600_000);
    perfilProtegido = await garantirPerfil(
      'Consulta de dados pessoais (E2E do termo)',
      'Perfil protegido para conferir o termo de responsabilidade.',
      ['selecao:inscricoes:consultar', 'selecao:dados-pessoais:consultar'],
    );
    await garantirConcessao(ENCARREGADO_DE_DADOS, PERFIL_DO_ENCARREGADO, '');
  });

  test('o gestor de acessos publica uma versão, que passa a vigente', async () => {
    const anterior = await vigente();
    const publicada = await chamarApi<VersaoDoTermo>(
      GESTOR_DE_ACESSOS,
      'POST',
      `${ROTA_DO_TERMO}/versoes`,
      {
        corpo: {
          texto: textoDaVersao(sufixo),
          ato: `Portaria E2E ${sufixo}`,
          versaoVigenteEsperadaId: anterior?.id ?? null,
        },
      },
    );
    expect(publicada.status, JSON.stringify(publicada.corpo)).toBe(201);
    versao = publicada.corpo;
    expect((await vigente())?.id).toBe(versao.id);
  });

  test('o pedido de perfil protegido com versão divergente recebe 409', async () => {
    const recusado = await pedir(perfilProtegido, VERSAO_QUALQUER);

    expect(recusado.status, JSON.stringify(recusado.corpo)).toBe(409);
    expect(JSON.stringify(recusado.corpo)).toContain('uniplus.autorizacao.pedido.termo_divergente');
  });

  test('o pedido para outra pessoa fixa a vigente, e o aceite recusa outra versão e aceita a fixada', async () => {
    const email = identidadeDoToken(await tokenDaPersona(BENEFICIARIO)).email;
    const criado = await pedir(perfilProtegido, versao.id, email);
    expect(criado.status, JSON.stringify(criado.corpo)).toBe(201);
    const caminho = `${ROTA_DOS_PEDIDOS}/${criado.corpo.id}`;
    const lerPedido = async () => (await chamarApi<Pedido>(SOLICITANTE, 'GET', caminho)).corpo;
    await expect.poll(async () => (await lerPedido()).situacao).toBe('aguardando_beneficiario');
    expect((await lerPedido()).termo?.versaoId).toBe(versao.id);

    const divergente = await chamarApi(BENEFICIARIO, 'POST', `${caminho}/aceite`, {
      corpo: { termoVersaoApresentadaId: VERSAO_QUALQUER },
    });
    expect(divergente.status, JSON.stringify(divergente.corpo)).toBe(409);
    expect(JSON.stringify(divergente.corpo)).toContain(
      'uniplus.autorizacao.pedido.termo_divergente',
    );

    const aceito = await chamarApi(BENEFICIARIO, 'POST', `${caminho}/aceite`, {
      corpo: { termoVersaoApresentadaId: versao.id },
    });
    expect(aceito.status, JSON.stringify(aceito.corpo)).toBe(200);
  });

  test('o Encarregado de dados lê a versão vigente, mas não publica (403) nem lista o histórico', async ({
    browser,
  }) => {
    const lida = await chamarApi(ENCARREGADO_DE_DADOS, 'GET', `${ROTA_DO_TERMO}/vigente`);
    expect(lida.status).toBe(200);
    const historico = await chamarApi(ENCARREGADO_DE_DADOS, 'GET', `${ROTA_DO_TERMO}/versoes`);
    expect(historico.status).toBe(403);
    const publicacao = await chamarApi(ENCARREGADO_DE_DADOS, 'POST', `${ROTA_DO_TERMO}/versoes`, {
      corpo: {
        texto: textoDaVersao(sufixo + 1),
        ato: `Portaria E2E ${sufixo + 1}`,
        versaoVigenteEsperadaId: versao.id,
      },
    });
    expect(publicacao.status, JSON.stringify(publicacao.corpo)).toBe(403);

    const pagina = await entrarComoPersona(
      browser,
      APP,
      ENCARREGADO_DE_DADOS,
      '/acessos/termo-de-responsabilidade',
    );
    await expect(pagina.getByRole('button', { name: /Publicar/ })).toHaveCount(0);
  });
});
