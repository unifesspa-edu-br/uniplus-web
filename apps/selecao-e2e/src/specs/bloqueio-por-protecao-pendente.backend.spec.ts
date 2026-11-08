import { test, expect } from '@playwright/test';
import { OPERADOR_DO_ROTEIRO, chamarApi, entrarComoPersona, prepararAcessosDaSimulacao } from '@uniplus/shared-e2e';
import { rascunhoParaConfiguracao } from '../fixtures/cenario-da-projecao';

/**
 * O tipo de documento que aguarda a aprovação da proteção de dados não pode ser exigido na
 * configuração do processo (cenário "item pendente na configuração do processo"):
 * a API recusa o vínculo e a tela mostra o item indisponível, com o motivo.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';
const BASES_LEGAIS = [
  {
    referencia: 'Edital nº XX/2026-CEPS/Unifesspa, itens 1.6 e 13',
    abrangencia: 'INTERNA_EDITAL',
    status: 'RESOLVIDO',
    observacao: null,
  },
];

test.describe('Configuração do processo com item de catálogo pendente', () => {
  const sufixo = Date.now();
  const nome = `Comprovante pendente ${sufixo}`;
  let processoId: string;
  let tipoId: string;
  let faseId: string;

  test.beforeAll(async () => {
    test.setTimeout(900_000);
    await prepararAcessosDaSimulacao();
    ({ processoId, faseHabilitacaoId: faseId } = await rascunhoParaConfiguracao());
    const criado = await chamarApi<string>('isabella.figueiredo', 'POST', '/api/configuracao/admin/tipos-documento', {
      corpo: {
        codigo: `COMPROVANTE_PENDENTE_${sufixo}`,
        nome,
        categoria: 'IDENTIFICACAO',
        classificacaoProtecao: 'INTERNO',
        hipoteseLegal: 'CUMPRIMENTO_OBRIGACAO_LEGAL',
        finalidadeTratamento: 'Conferência do bloqueio de item pendente na configuração do processo.',
      },
    });
    expect(criado.status).toBe(201);
    tipoId = criado.corpo;
  });

  test('a API recusa exigir o tipo pendente', async () => {
    const resposta = await chamarApi<{ code: string }>(
      OPERADOR_DO_ROTEIRO,
      'PUT',
      `/api/selecao/processos-seletivos/${processoId}/documentos-exigidos`,
      {
        corpo: [
          {
            tipo: 'FOLHA',
            documento: {
              exigidoNaFaseId: faseId,
              finalidade: 'HABILITACAO',
              tipoDocumentoId: tipoId,
              aplicabilidade: 'GERAL',
              obrigatorio: true,
              consequenciaIndeferimento: 'ELIMINA',
              condicoes: [],
              basesLegais: BASES_LEGAIS,
              formatosPermitidos: 'QUALQUER',
            },
          },
        ],
      },
    );

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.code).toBe('uniplus.selecao.documento_exigido.tipo_documento_com_protecao_pendente');
  });

  test('a tela oferece o tipo pendente como indisponível, aguardando a proteção de dados', async ({ browser }) => {
    const pagina = await entrarComoPersona(browser, APP, OPERADOR_DO_ROTEIRO, `/processo-seletivo/${processoId}`);
    await pagina.getByRole('button', { name: /^Cronograma/ }).click();
    await expect(pagina.getByRole('heading', { name: /Passo 5/ })).toBeVisible();
    await pagina.getByText('3. Habilitação', { exact: true }).click();

    const seletor = pagina.getByRole('combobox', { name: /Documento a exigir/ });
    await seletor.scrollIntoViewIfNeeded();
    await seletor.fill(nome);

    const opcao = pagina.getByRole('option', { name: new RegExp(`${nome}.*aguarda a aprovação da proteção de dados`) });
    await expect(opcao).toBeVisible();
    await expect(opcao).toHaveAttribute('aria-disabled', 'true');
  });
});
