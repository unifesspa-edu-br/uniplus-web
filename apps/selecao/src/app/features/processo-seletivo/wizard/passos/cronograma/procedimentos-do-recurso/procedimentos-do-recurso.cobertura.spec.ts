import { afterEach, describe, expect, it, vi } from 'vitest';

import * as cobertura from '../../../shared/procedimentos-do-recurso/cobertura-dos-procedimentos';
import {
  atualizar,
  HOMOLOGACAO,
  montarEdicao,
  NOTA,
  type EntradasDaEdicao,
} from './procedimentos-do-recurso.edicao.testing';
import { procedimento, procedimentoDoDocumento } from './procedimentos.testing';

const ANTERIOR = procedimento({ tipoDeDecisao: NOTA, regraCodigo: 'REGRA-ANTERIOR' });
const DOCUMENTAL = procedimentoDoDocumento({ regra: { codigo: 'REGRA-DOCUMENTAL', versao: 'v2' } });
const RECUSA = {
  codigo: 'uniplus.selecao.recurso_da_etapa.procedimento_de_recurso_desconhecido',
  mensagem: 'O procedimento de recurso não consta no catálogo.',
  pagina: null,
};
const FORMATOS: readonly {
  formato: string;
  procedimentos: EntradasDaEdicao['procedimentos'];
  regras: readonly string[];
}[] = [
  { formato: 'ausente', procedimentos: [], regras: [] },
  { formato: 'anterior', procedimentos: [ANTERIOR], regras: ['REGRA-ANTERIOR'] },
  { formato: 'documento', procedimentos: [DOCUMENTAL], regras: ['REGRA-DOCUMENTAL'] },
  {
    formato: 'misto',
    procedimentos: [ANTERIOR, DOCUMENTAL],
    regras: ['REGRA-ANTERIOR', 'REGRA-DOCUMENTAL'],
  },
];

afterEach(() => vi.restoreAllMocks());

describe.each(['edicao', 'consulta', 'bloqueado'] as const)('cobertura na tela em %s', (modo) => {
  describe.each([true, false])('com período de recurso: %s', (temJanela) => {
    describe.each([false, true])('com recusa: %s', (comRecusa) => {
      it.each(FORMATOS)('mantém procedimentos e avisos no formato $formato', async (formato) => {
        const { procedimentos, regras } = formato;
        const { elementoDaTela } = await montarEdicao({
          modo,
          temJanela,
          tiposDeclarados: [NOTA, HOMOLOGACAO],
          procedimentos,
          recusas: comRecusa ? [{ tipoDeDecisao: NOTA, alvo: null, recusa: RECUSA }] : [],
        });
        const faltantes = cobertura.tiposSemProcedimento(
          temJanela,
          [NOTA, HOMOLOGACAO],
          procedimentos,
        );
        const avisos = Array.from(
          elementoDaTela.querySelectorAll('.alert--warning'),
          (aviso) => aviso.id,
        );
        expect(elementoDaTela.hidden).toBe(false);
        expect(elementoDaTela.querySelectorAll('sel-procedimento-do-tipo')).toHaveLength(2);
        expect(avisos).toEqual(faltantes.map((tipo) => `proc-${tipo}-falta`));
        for (const regra of regras) expect(elementoDaTela.textContent).toContain(regra);
        expect(elementoDaTela.textContent?.includes(RECUSA.codigo)).toBe(comRecusa);
        if (modo === 'consulta') {
          expect(elementoDaTela.querySelector('input, select, button')).toBeNull();
          expect(elementoDaTela.textContent).not.toContain('Procedimento não declarado');
        }
        if (modo === 'bloqueado' || !temJanela) {
          expect(
            elementoDaTela.querySelector('select:not(:disabled), input:not(:disabled)'),
          ).toBeNull();
        }
      });
    });
  });
});

describe('ligação da apresentação à função pura de cobertura', () => {
  it('apresenta somente o resultado recebido da função, sem recalcular no componente', async () => {
    const calcular = vi.spyOn(cobertura, 'tiposSemProcedimento').mockReturnValue([HOMOLOGACAO]);
    const { elementoDaTela } = await montarEdicao({ tiposDeclarados: [NOTA, HOMOLOGACAO] });
    expect(calcular).toHaveBeenCalledExactlyOnceWith(true, [NOTA, HOMOLOGACAO], []);
    expect(elementoDaTela.querySelector(`#proc-${NOTA}-falta`)).toBeNull();
    expect(elementoDaTela.querySelector(`#proc-${HOMOLOGACAO}-falta`)).not.toBeNull();
  });

  it('atualiza a cobertura quando mudam os procedimentos, os tipos ou o período', async () => {
    const { fixture, elementoDaTela } = await montarEdicao({
      modo: 'consulta',
      tiposDeclarados: [NOTA],
    });
    expect(elementoDaTela.querySelectorAll('.alert--warning')).toHaveLength(1);
    for (const procedimentos of [[ANTERIOR], [DOCUMENTAL], [ANTERIOR, DOCUMENTAL]]) {
      await atualizar(fixture, { procedimentos });
      expect(elementoDaTela.querySelector('.alert--warning')).toBeNull();
    }
    await atualizar(fixture, { procedimentos: [] });
    expect(elementoDaTela.querySelectorAll('.alert--warning')).toHaveLength(1);
    await atualizar(fixture, { tiposDeclarados: [NOTA, HOMOLOGACAO] });
    expect(elementoDaTela.querySelectorAll('.alert--warning')).toHaveLength(2);
    await atualizar(fixture, { temJanela: false });
    expect(elementoDaTela.querySelector('.alert--warning')).toBeNull();
  });
});
