import { describe, expect, it } from 'vitest';
import { SituacaoInscricaoCodigo } from '@uniplus/shared-data/selecao';

import {
  dependenciasDaInscricao,
  formularioCarregado,
  inicialDaInscricao,
  juntarSimulacoes,
  tituloDoFormulario,
} from './formularios-da-inscricao';
import {
  DOIS_FORMULARIOS,
  FORMULARIO_ACADEMICO,
  RESPONDIDA_NOS_DOIS,
} from './formularios-da-inscricao.testing';
import { FORMULARIO_DE_INSCRICAO_MOCK } from './inscricao-do-candidato.testing';
import { inscricao } from './inscricao-do-candidato.page.testing';

const GRAVADA = inscricao({
  ...RESPONDIDA_NOS_DOIS,
  situacao: { codigo: SituacaoInscricaoCodigo.RASCUNHO, rotulo: 'Situação de teste' },
});

describe('formularioCarregado', () => {
  it('parte só das respostas que o próprio formulário coleta', () => {
    const primeiro = formularioCarregado(FORMULARIO_DE_INSCRICAO_MOCK, GRAVADA, null);
    const segundo = formularioCarregado(FORMULARIO_ACADEMICO, GRAVADA, null);

    expect(Object.keys(primeiro.inicial.respostas ?? {})).not.toContain('INSTITUICAO_DE_ORIGEM');
    expect(Object.keys(segundo.inicial.respostas ?? {})).toEqual(['INSTITUICAO_DE_ORIGEM']);
  });

  it('traz só os termos aceitos no próprio formulário', () => {
    expect(formularioCarregado(FORMULARIO_DE_INSCRICAO_MOCK, GRAVADA, null).termosAceitos).toEqual([
      'VERACIDADE',
    ]);
    expect(formularioCarregado(FORMULARIO_ACADEMICO, GRAVADA, null).termosAceitos).toEqual([
      'DECLARACAO_ACADEMICA',
    ]);
  });
});

describe('dependenciasDaInscricao', () => {
  const comDependencias = (fatos: string[], grupos: string[]) => ({
    ...FORMULARIO_DE_INSCRICAO_MOCK,
    dependenciasDaAvaliacao: { fatos, grupos },
  });

  it('une os fatos e os grupos de todos os formulários, sem repetição', () => {
    const formularios = [
      comDependencias(['NOME', 'CPF'], ['FAMILIA']),
      { ...comDependencias(['CPF', 'RENDA'], ['FAMILIA', 'CURSOS']), codigo: 'OUTRO' },
    ];

    expect(dependenciasDaInscricao(formularios)).toEqual({
      fatos: ['NOME', 'CPF', 'RENDA'],
      grupos: ['FAMILIA', 'CURSOS'],
    });
  });

  it('é nula quando nenhum formulário declara dependência', () => {
    expect(dependenciasDaInscricao(DOIS_FORMULARIOS)).toBeNull();
  });
});

describe('juntarSimulacoes', () => {
  it('junta as respostas e os grupos dos formulários sem alterar as simulações de origem', () => {
    const primeira = { respostas: { NOME: 'Helena' }, grupos: { FAMILIA: [] } };
    const segunda = { respostas: { INSTITUICAO_DE_ORIGEM: 'Escola' }, paginasConcluidas: ['P'] };

    const junta = juntarSimulacoes([primeira, segunda]);

    expect(junta.respostas).toEqual({ NOME: 'Helena', INSTITUICAO_DE_ORIGEM: 'Escola' });
    expect(junta.grupos).toEqual({ FAMILIA: [] });
    expect(junta.paginasConcluidas).toEqual(['P']);
    expect(primeira.respostas).toEqual({ NOME: 'Helena' });
  });

  it('sem simulações, não há respostas nem envio', () => {
    expect(juntarSimulacoes([])).toMatchObject({ respostas: {}, envio: null });
  });

  it('a partida da inscrição é a junção das partidas dos formulários', () => {
    const carregados = DOIS_FORMULARIOS.map((f) => formularioCarregado(f, GRAVADA, null));

    expect(Object.keys(inicialDaInscricao(carregados).respostas ?? {})).toContain(
      'INSTITUICAO_DE_ORIGEM',
    );
  });
});

describe('tituloDoFormulario', () => {
  it('usa o título publicado e, sem ele, o nome genérico', () => {
    expect(tituloDoFormulario(FORMULARIO_ACADEMICO)).toBe('Dados acadêmicos');
    const semTitulo = {
      ...FORMULARIO_ACADEMICO,
      formulario: { ...FORMULARIO_ACADEMICO.formulario, titulo: null },
    };
    expect(tituloDoFormulario(semTitulo)).toBe('Formulário da inscrição');
  });
});
