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
        const { raiz } = await montarEdicao({
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
        const avisos = Array.from(raiz.querySelectorAll('.alert--warning'), (aviso) => aviso.id);
        expect(raiz.hidden).toBe(false);
        expect(raiz.querySelectorAll('sel-procedimento-do-tipo')).toHaveLength(2);
        expect(avisos).toEqual(faltantes.map((tipo) => `proc-${tipo}-falta`));
        for (const regra of regras) expect(raiz.textContent).toContain(regra);
        expect(raiz.textContent?.includes(RECUSA.codigo)).toBe(comRecusa);
        if (modo === 'consulta') {
          expect(raiz.querySelector('input, select, button')).toBeNull();
          expect(raiz.textContent).not.toContain('Procedimento não declarado');
        }
        if (modo === 'bloqueado' || !temJanela) {
          expect(raiz.querySelector('select:not(:disabled), input:not(:disabled)')).toBeNull();
        }
      });
    });
  });
});

describe('ligação da apresentação à função pura de cobertura', () => {
  it('apresenta somente o resultado recebido da função, sem recalcular no componente', async () => {
    const calcular = vi.spyOn(cobertura, 'tiposSemProcedimento').mockReturnValue([HOMOLOGACAO]);
    const { raiz } = await montarEdicao({ tiposDeclarados: [NOTA, HOMOLOGACAO] });
    expect(calcular).toHaveBeenCalledExactlyOnceWith(true, [NOTA, HOMOLOGACAO], []);
    expect(raiz.querySelector(`#proc-${NOTA}-falta`)).toBeNull();
    expect(raiz.querySelector(`#proc-${HOMOLOGACAO}-falta`)).not.toBeNull();
  });

  it('atualiza a cobertura quando mudam os procedimentos, os tipos ou o período', async () => {
    const { fixture, raiz } = await montarEdicao({ modo: 'consulta', tiposDeclarados: [NOTA] });
    expect(raiz.querySelectorAll('.alert--warning')).toHaveLength(1);
    for (const procedimentos of [[ANTERIOR], [DOCUMENTAL], [ANTERIOR, DOCUMENTAL]]) {
      await atualizar(fixture, { procedimentos });
      expect(raiz.querySelector('.alert--warning')).toBeNull();
    }
    await atualizar(fixture, { procedimentos: [] });
    expect(raiz.querySelectorAll('.alert--warning')).toHaveLength(1);
    await atualizar(fixture, { tiposDeclarados: [NOTA, HOMOLOGACAO] });
    expect(raiz.querySelectorAll('.alert--warning')).toHaveLength(2);
    await atualizar(fixture, { temJanela: false });
    expect(raiz.querySelector('.alert--warning')).toBeNull();
  });
});
