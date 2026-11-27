import { describe, expect, it } from 'vitest';
import { SituacaoInscricaoCodigo } from '@uniplus/shared-data/selecao';

import {
  confirmacaoDaGravacao,
  corpoDaAvaliacao,
  corpoDaGravacao,
  mesmoConteudoGravado,
  type OfertasEscolhidas,
} from './corpo-da-inscricao';
import { FORMULARIO_DE_INSCRICAO_MOCK } from './inscricao-do-candidato.testing';
import { inscricao } from './inscricao-do-candidato.page.testing';

const SEM_OFERTAS: OfertasEscolhidas = { ofertaCursoId: null, ofertaCursoSegundaOpcaoId: null };

describe('corpoDaAvaliacao: as respostas como o servidor as mescla ao gravado', () => {
  it('leva as respostas da tela e as ofertas escolhidas', () => {
    const ofertas = { ofertaCursoId: 'oferta-1', ofertaCursoSegundaOpcaoId: 'oferta-2' };

    const corpo = corpoDaAvaliacao(inscricao(), { respostas: { NOME: 'Fernanda' } }, ofertas);

    expect(corpo).toEqual({ respostas: { NOME: 'Fernanda' }, grupos: {}, ...ofertas });
  });

  it('a resposta gravada que o candidato apagou vai como nula', () => {
    const gravada = inscricao({ respostas: { NOME: 'Fernanda', TELEFONE: '(94) 99999-0000' } });

    const corpo = corpoDaAvaliacao(gravada, { respostas: { NOME: 'Fernanda' } }, SEM_OFERTAS);

    expect(corpo.respostas).toEqual({ NOME: 'Fernanda', TELEFONE: null });
  });

  it('a simulação sem respostas apaga todas as gravadas', () => {
    const gravada = inscricao({ respostas: { NOME: 'Fernanda' } });

    expect(corpoDaAvaliacao(gravada, {}, SEM_OFERTAS).respostas).toEqual({ NOME: null });
  });

  it('o nome social só vai quando o candidato escolhe usá-lo', () => {
    const respostas = { NOME_SOCIAL: 'Fernanda', DESEJA_NOME_SOCIAL: true };

    const corpo = corpoDaAvaliacao(inscricao(), { respostas }, SEM_OFERTAS);

    expect(corpo.respostas).toEqual(respostas);
  });

  it('com a recusa do nome social, a resposta vai nula', () => {
    const respostas = { NOME_SOCIAL: 'Fernanda', DESEJA_NOME_SOCIAL: false };

    const corpo = corpoDaAvaliacao(inscricao(), { respostas }, SEM_OFERTAS);

    expect(corpo.respostas).toEqual({ NOME_SOCIAL: null, DESEJA_NOME_SOCIAL: false });
  });

  it('sem a escolha de usar o nome social, a resposta vai nula', () => {
    const corpo = corpoDaAvaliacao(
      inscricao(),
      { respostas: { NOME_SOCIAL: 'Fernanda' } },
      SEM_OFERTAS,
    );

    expect(corpo.respostas).toEqual({ NOME_SOCIAL: null });
  });

  it('sem o fato do nome social na tela, nenhuma resposta dele é criada', () => {
    const corpo = corpoDaAvaliacao(inscricao(), { respostas: { NOME: 'Fernanda' } }, SEM_OFERTAS);

    expect(corpo.respostas).not.toHaveProperty('NOME_SOCIAL');
  });
});

describe('corpoDaAvaliacao: as ocorrências dos grupos', () => {
  const ocorrencia = { id: 'ocorrencia-1', respostas: { CURSO: 'Direito' } };

  it('leva as ocorrências do grupo da tela com o id e as respostas de cada uma', () => {
    const grupos = { FORMACAO: [ocorrencia, { id: 'ocorrencia-2' }] };

    const corpo = corpoDaAvaliacao(inscricao(), { grupos }, SEM_OFERTAS);

    expect(corpo.grupos).toEqual({
      FORMACAO: [ocorrencia, { id: 'ocorrencia-2', respostas: {} }],
    });
  });

  it('o grupo da tela sem ocorrências vai como lista vazia', () => {
    const corpo = corpoDaAvaliacao(inscricao(), { grupos: { FORMACAO: null } }, SEM_OFERTAS);

    expect(corpo.grupos).toEqual({ FORMACAO: [] });
  });

  it('o grupo gravado que o candidato removeu vai como lista vazia', () => {
    const gravada = inscricao({ grupos: { FORMACAO: [ocorrencia] } });

    const corpo = corpoDaAvaliacao(gravada, { grupos: { OUTRO: [ocorrencia] } }, SEM_OFERTAS);

    expect(corpo.grupos).toEqual({ OUTRO: [ocorrencia], FORMACAO: [] });
  });

  it('o grupo gravado que a tela mantém não é esvaziado', () => {
    const gravada = inscricao({ grupos: { FORMACAO: [ocorrencia] } });

    const corpo = corpoDaAvaliacao(gravada, { grupos: { FORMACAO: [ocorrencia] } }, SEM_OFERTAS);

    expect(corpo.grupos).toEqual({ FORMACAO: [ocorrencia] });
  });
});

describe('corpoDaGravacao: o corpo do salvar e do envio', () => {
  const termos = FORMULARIO_DE_INSCRICAO_MOCK.formulario.termos;
  const formularios = [FORMULARIO_DE_INSCRICAO_MOCK];
  const aceitos = (...codigos: string[]) => new Map([['INSCRICAO', codigos]]);
  const corpo = corpoDaAvaliacao(inscricao(), {}, SEM_OFERTAS);

  it('leva o aceite com o código do formulário, a versão e o hash que ele publica', () => {
    const request = corpoDaGravacao(corpo, aceitos('VERACIDADE'), formularios);

    expect(request.aceites).toEqual([
      {
        formularioCodigo: 'INSCRICAO',
        codigo: 'VERACIDADE',
        versaoId: termos[0].versaoId,
        hashVersao: termos[0].conteudo.hashVersao,
      },
    ]);
  });

  it('o termo que o formulário não publica não vira aceite', () => {
    expect(corpoDaGravacao(corpo, aceitos('DESCONHECIDO'), formularios).aceites).toEqual([]);
  });

  it('sem curso escolhido, a oferta vai nula e não ausente', () => {
    const semOferta = { ...corpo, ofertaCursoId: undefined };

    expect(corpoDaGravacao(semOferta, aceitos(), formularios).ofertaCursoId).toBeNull();
  });

  it('mantém as respostas e os grupos do corpo da avaliação', () => {
    const comRespostas = corpoDaAvaliacao(
      inscricao(),
      { respostas: { NOME: 'Fernanda' } },
      {
        ofertaCursoId: 'oferta-1',
        ofertaCursoSegundaOpcaoId: null,
      },
    );

    expect(corpoDaGravacao(comRespostas, aceitos(), formularios)).toMatchObject(comRespostas);
  });
});

describe('mesmoConteudoGravado: o que só o candidato grava', () => {
  it('é o mesmo quando só muda o que o envio de documento muda', () => {
    const a = inscricao({ respostas: { NOME: 'Fernanda' }, eTag: '"1"' });
    const b = inscricao({ respostas: { NOME: 'Fernanda' }, eTag: '"2"' });

    expect(mesmoConteudoGravado(a, b)).toBe(true);
  });

  it.each([
    ['as respostas', { respostas: { NOME: 'Outra' } }],
    [
      'a situação',
      { situacao: { codigo: SituacaoInscricaoCodigo.ENVIADA, rotulo: 'Situação de teste' } },
    ],
    ['a oferta de curso', { ofertaCursoId: 'oferta-1' }],
    [
      'os aceites',
      {
        aceites: [
          { formularioCodigo: 'INSCRICAO', codigo: 'VERACIDADE', versaoId: 'v1', hashVersao: 'h1' },
        ],
      },
    ],
  ])('muda quando muda %s', (_, mudanca) => {
    const a = inscricao({ respostas: { NOME: 'Fernanda' } });

    expect(mesmoConteudoGravado(a, inscricao({ ...a, ...mudanca }))).toBe(false);
  });
});

describe('confirmacaoDaGravacao: o que o leitor de tela ouve', () => {
  it('o rascunho gravado é confirmado como salvo', () => {
    expect(confirmacaoDaGravacao(inscricao())).toBe('Rascunho salvo.');
  });

  it('a inscrição enviada é confirmada com o número', () => {
    const enviada = inscricao({
      situacao: { codigo: SituacaoInscricaoCodigo.ENVIADA, rotulo: 'Situação de teste' },
      numeroInscricao: '2027-000001',
    });

    expect(confirmacaoDaGravacao(enviada)).toBe('Inscrição enviada. Número 2027-000001.');
  });

  it('a inscrição enviada sem número ainda é confirmada', () => {
    expect(
      confirmacaoDaGravacao(
        inscricao({
          situacao: { codigo: SituacaoInscricaoCodigo.ENVIADA, rotulo: 'Situação de teste' },
        }),
      ),
    ).toBe('Inscrição enviada.');
  });
});
