import { test, expect } from '@playwright/test';
import { chamarApi, prepararAcessosDaSimulacao } from '@uniplus/shared-e2e';
import { formularioDeInscricao, gravarFormulario } from '../support/api-dos-documentos-exigidos';
import { exigirTipoPendente, conferirTipoPendente } from '../support/passos-da-protecao-pendente';
import { rascunhoParaConfiguracao } from '../fixtures/cenario-da-projecao';

const FORMULARIO_DA_FASE = 'HABILITACAO';

/**
 * O tipo de documento que aguarda a aprovação da proteção de dados não pode ser exigido na
 * configuração do processo (cenário "item pendente na configuração do processo"):
 * a API recusa o vínculo e a tela mostra o item indisponível, com o motivo.
 */
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
    const formulario = await gravarFormulario(
      processoId,
      FORMULARIO_DA_FASE,
      formularioDeInscricao(faseId),
    );
    expect(formulario.status).toBe(204);
    const criado = await chamarApi<string>(
      'isabella.figueiredo',
      'POST',
      '/api/configuracao/admin/tipos-documento',
      {
        corpo: {
          codigo: `COMPROVANTE_PENDENTE_${sufixo}`,
          nome,
          categoria: 'IDENTIFICACAO',
          classificacaoProtecao: 'INTERNO',
          hipoteseLegal: 'CUMPRIMENTO_OBRIGACAO_LEGAL',
          finalidadeTratamento:
            'Conferência do bloqueio de item pendente na configuração do processo.',
        },
      },
    );
    expect(criado.status).toBe(201);
    tipoId = criado.corpo;
  });

  test('a API recusa exigir o tipo pendente', async () => {
    await exigirTipoPendente(processoId, tipoId, faseId, FORMULARIO_DA_FASE);
  });

  test('a tela oferece o tipo pendente como indisponível, aguardando a proteção de dados', async ({
    browser,
  }) => {
    await conferirTipoPendente(browser, processoId, nome);
  });
});
