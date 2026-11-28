import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type { ConteudoDoFormulario } from '@uniplus/shared-inscricao/formulario';
import type { WizardDraft } from '../../processo-seletivo.models';
import {
  citaFatoDeElegibilidade,
  fatosDeElegibilidade,
  rotuloDoFato,
} from './fato-de-elegibilidade';

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

const nomes = (codigo: string): string | undefined =>
  codigo === 'TEM_DIREITO' ? 'Tem direito ao acréscimo' : undefined;

const formulario = (...itens: ReturnType<typeof item>[]): ConteudoDoFormulario =>
  ({ itens }) as unknown as ConteudoDoFormulario;

const derivadoBooleano = (codigoFato: string) => ({
  codigoFato,
  regras: [{ contribui: null, ordem: 1, quando: [] }],
});

const derivadoDeValor = (codigoFato: string) => ({
  codigoFato,
  regras: [{ contribui: 'AC', ordem: 1, quando: [] }],
});

describe('fatosDeElegibilidade', () => {
  it('oferece só os campos de sim ou não da inscrição, com o texto da pergunta', () => {
    const inscricao = formulario(
      item('PEDE_O_ACRESCIMO', 'SIM_OU_NAO', 'Deseja solicitar o acréscimo?'),
      item('MUNICIPIO_DE_RESIDENCIA', 'MUNICIPIO'),
    );

    expect(fatosDeElegibilidade(inscricao, [], nomes)).toEqual([
      { codigo: 'PEDE_O_ACRESCIMO', rotulo: 'Deseja solicitar o acréscimo? (PEDE_O_ACRESCIMO)' },
    ]);
  });

  it('oferece só as derivações de sim ou não, com o nome do cadastro', () => {
    const derivacao = [derivadoBooleano('TEM_DIREITO'), derivadoDeValor('MODALIDADE')];

    expect(fatosDeElegibilidade(formulario(), derivacao, nomes)).toEqual([
      { codigo: 'TEM_DIREITO', rotulo: 'Tem direito ao acréscimo (TEM_DIREITO)' },
    ]);
  });

  it('mostra só o código do fato derivado que o cadastro não nomeia', () => {
    const fatos = fatosDeElegibilidade(formulario(), [derivadoBooleano('SEM_NOME')], nomes);

    expect(fatos).toEqual([{ codigo: 'SEM_NOME', rotulo: 'SEM_NOME' }]);
  });

  it('usa o nome do cadastro no campo cuja pergunta está em branco', () => {
    const inscricao = formulario(item('TEM_DIREITO', 'SIM_OU_NAO', ''));

    expect(fatosDeElegibilidade(inscricao, [], nomes)).toEqual([
      { codigo: 'TEM_DIREITO', rotulo: 'Tem direito ao acréscimo (TEM_DIREITO)' },
    ]);
  });

  it('trata a pergunta só com espaços como em branco e usa o nome do cadastro', () => {
    const inscricao = formulario(item('TEM_DIREITO', 'SIM_OU_NAO', '   '));

    expect(fatosDeElegibilidade(inscricao, [], nomes)).toEqual([
      { codigo: 'TEM_DIREITO', rotulo: 'Tem direito ao acréscimo (TEM_DIREITO)' },
    ]);
  });

  it('mostra só o código do campo sem pergunta e sem nome no cadastro', () => {
    const inscricao = formulario(item('OUTRO', 'SIM_OU_NAO', ''));

    expect(fatosDeElegibilidade(inscricao, [], nomes)).toEqual([
      { codigo: 'OUTRO', rotulo: 'OUTRO' },
    ]);
  });
});

describe('rotuloDoFato', () => {
  it('escreve "Nome (CÓDIGO)" e cai no código quando o nome falta ou está em branco', () => {
    expect(rotuloDoFato('A', 'Nome do dado')).toBe('Nome do dado (A)');
    expect(rotuloDoFato('A', undefined)).toBe('A');
    expect(rotuloDoFato('A', '  ')).toBe('A');
  });
});
