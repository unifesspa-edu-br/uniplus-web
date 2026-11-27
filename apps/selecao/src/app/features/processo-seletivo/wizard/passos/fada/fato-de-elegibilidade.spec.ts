import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type { ConteudoDoFormulario } from '@uniplus/shared-inscricao/formulario';
import type { WizardDraft } from '../../processo-seletivo.models';
import { citaFatoDeElegibilidade, fatosDeElegibilidade } from './fato-de-elegibilidade';

const rascunho = (aplica: boolean | null, origem: OrigemCandidatosCodigo): WizardDraft =>
  ({
    fada: { aplica },
    identificacao: { origemCandidatos: origem },
  }) as unknown as WizardDraft;

const item = (fatoCodigo: string, tipoDeCampo: string, rotulo = fatoCodigo) => ({
  fatoCodigo,
  apresentacao: { tipoDeCampo, rotulo },
});

describe('citaFatoDeElegibilidade', () => {
  it('só quando o processo aplica o acréscimo e o candidato se inscreve nele', () => {
    expect(citaFatoDeElegibilidade(rascunho(true, OrigemCandidatosCodigo.INSCRICAO_PROPRIA))).toBe(
      true,
    );
    expect(citaFatoDeElegibilidade(rascunho(true, OrigemCandidatosCodigo.IMPORTACAO_EXTERNA))).toBe(
      false,
    );
    expect(citaFatoDeElegibilidade(rascunho(false, OrigemCandidatosCodigo.INSCRICAO_PROPRIA))).toBe(
      false,
    );
  });
});

describe('fatosDeElegibilidade', () => {
  it('oferece os campos de sim ou não da inscrição e as derivações de sim ou não, e nada mais', () => {
    const inscricao = {
      itens: [
        item('PEDE_O_ACRESCIMO', 'SIM_OU_NAO', 'Deseja solicitar o acréscimo?'),
        item('MUNICIPIO_DE_RESIDENCIA', 'MUNICIPIO'),
      ],
    } as unknown as ConteudoDoFormulario;
    const fatos = fatosDeElegibilidade(inscricao, [
      { codigoFato: 'TEM_DIREITO', regras: [{ contribui: null, ordem: 1, quando: [] }] },
      { codigoFato: 'MODALIDADE', regras: [{ contribui: 'AC', ordem: 1, quando: [] }] },
    ]);

    expect(fatos).toEqual([
      { codigo: 'PEDE_O_ACRESCIMO', rotulo: 'Deseja solicitar o acréscimo?', origem: 'campo' },
      { codigo: 'TEM_DIREITO', rotulo: 'TEM_DIREITO', origem: 'derivado' },
    ]);
  });
});
