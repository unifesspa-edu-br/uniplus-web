import { describe, expect, it } from 'vitest';
import { regrasDeComprovacaoParaEnvio } from './gravacao-das-exigencias';
import {
  ETAPAS_VIVAS,
  FASES,
  FORMULARIOS_POR_FASE,
  exigencia,
  rascunho,
  regraDoRascunho,
} from './exigencias.testing';

describe('origens das exigências enviadas', () => {
  it('conserva a ordem dos itens enviados sem incluir identificadores no corpo', () => {
    const ignorada = regraDoRascunho({
      forma: 'DOCUMENTO',
      documento: exigencia({ faseCodigo: 'AUSENTE' }),
    });
    const documento = rascunho(exigencia()).regrasDeComprovacao[0];
    const grupo = regraDoRascunho({ forma: 'TODOS_OS_ITENS', itens: [ignorada, documento] });
    const envio = regrasDeComprovacaoParaEnvio(
      { regrasDeComprovacao: [grupo], emTodasAsFases: [] },
      {
        faseIdPorCodigo: FASES,
        modalidadesOfertadas: [],
        etapasVivas: ETAPAS_VIVAS,
        formulariosPorFase: FORMULARIOS_POR_FASE,
      },
    );
    expect(envio.origens).toEqual([
      {
        identificadorDaRegra: grupo.identificadorNoRascunho,
        itens: [{ identificadorDaRegra: documento.identificadorNoRascunho, itens: [] }],
      },
    ]);
    expect(envio.regras[0].itens).toHaveLength(1);
    expect(JSON.stringify(envio.regras)).not.toContain('identificadorNoRascunho');
  });
});
