import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ok, recusa } from '../testes';
import {
  GESTAO_DE_ACESSOS,
  PROTECAO_DE_DADOS,
  abrirReclassificacao,
  botao,
  caixaDe,
  concessao,
  documentos,
  presente,
  reclassificacao,
} from './reclassificacao.testing';

describe('ReclassificacaoDetalhePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  it('mostra o que mudou na permissão, sem repetir o eixo que não mudou', async () => {
    const { host } = await abrirReclassificacao(
      ok(
        reclassificacao({
          mudanca: {
            classificacaoAnterior: 'interno',
            classificacaoNova: 'sensivel',
            deUnidadeAnterior: true,
            deUnidadeNovo: true,
          },
        }),
      ),
    );

    expect(host.querySelector('h1')?.textContent).toContain('Operador de inscrições');
    expect(host.textContent).toContain('Classificação: de Interna para Dado sensível');
    expect(host.textContent).not.toContain('Escopo: de');
    expect(host.textContent).toContain('09/11/2026');
  });

  it('lista as versões em uso com as permissões e abre o documento só da que tem link', async () => {
    documentos.abrir.mockResolvedValue('aberta');
    const { fixture, host, assentar } = await abrirReclassificacao();

    expect(host.textContent).toContain('Versão 1');
    expect(host.textContent).toContain('selecao:processos:aprovar · Dado pessoal · Unidade');
    expect(botao(host, 'Abrir o documento da versão 2')).toBeUndefined();
    presente(botao(host, 'Abrir o documento da versão 1')).click();
    await assentar();

    expect(documentos.abrir).toHaveBeenCalledWith(
      '01960000-0000-7000-0000-0000000000d1',
      'v1',
      expect.any(Function),
    );
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('avisa quando o navegador bloqueia a abertura do documento', async () => {
    documentos.abrir.mockResolvedValue('bloqueada');
    const { host, assentar } = await abrirReclassificacao();

    presente(botao(host, 'Abrir o documento da versão 1')).click();
    await assentar();

    expect(host.textContent).toContain('O navegador bloqueou a abertura do documento.');
  });

  it('mostra a recusa do documento sem esconder a reclassificação', async () => {
    documentos.abrir.mockResolvedValue({ recusa: 'O documento ainda não foi verificado.' });
    const { host, assentar } = await abrirReclassificacao();

    presente(botao(host, 'Abrir o documento da versão 1')).click();
    await assentar();

    expect(host.textContent).toContain('O documento ainda não foi verificado.');
    expect(host.textContent).toContain('Concessões suspensas');
  });

  it('mostra cada concessão suspensa com o escopo e o estado de cada etapa', async () => {
    const { host } = await abrirReclassificacao(
      ok(
        reclassificacao({
          concessoes: [
            concessao({
              etapasExigidas: ['gestao_de_acessos', 'protecao_de_dados'],
              etapasDecididas: ['protecao_de_dados'],
            }),
            concessao({ concessaoId: 'c3', beneficiarioNome: 'Paulo Teste', unidadeId: null }),
          ],
        }),
      ),
    );

    const linhas = [...host.querySelectorAll('tbody tr')];
    expect(linhas).toHaveLength(2);
    expect(linhas[0]?.textContent).toContain('Betina Teste');
    expect(linhas[0]?.textContent).toContain('CEPS');
    expect(linhas[0]?.textContent).toContain('gestão de acessos: aguarda a decisão');
    expect(linhas[0]?.textContent).toContain('proteção de dados: decidida');
    expect(linhas[1]?.textContent).toContain('Instituição');
  });

  it('marca a concessão da própria pessoa e não deixa escolhê-la', async () => {
    const { host } = await abrirReclassificacao();

    expect(host.textContent).toContain('Sua concessão');
    expect(caixaDe(host, 'Diogo Teste')).toBeNull();
    expect(caixaDe(host, 'Betina Teste')).not.toBeNull();
  });

  it('não deixa escolher a concessão cuja etapa já foi decidida', async () => {
    const { host } = await abrirReclassificacao(
      ok(reclassificacao({ concessoes: [concessao({ etapasDecididas: ['gestao_de_acessos'] })] })),
    );

    expect(caixaDe(host, 'Betina Teste')).toBeNull();
  });

  it('quem só consulta vê as concessões sem caixa de escolha nem botão de decidir', async () => {
    const { host } = await abrirReclassificacao(ok(reclassificacao()), []);

    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(botao(host, 'Liberar as concessões')).toBeUndefined();
    expect(host.textContent).toContain('Você consulta esta reclassificação.');
  });

  it('diz que nenhuma concessão segue suspensa', async () => {
    const { host } = await abrirReclassificacao(ok(reclassificacao({ concessoes: [] })));

    expect(host.textContent).toContain(
      'Nenhuma concessão segue suspensa por esta reclassificação.',
    );
  });

  it('com a leitura falha, oferece tentar novamente', async () => {
    const { host } = await abrirReclassificacao(
      recusa('uniplus.internal.unexpected', 500, 'Erro interno'),
    );

    expect(botao(host, 'Tentar novamente')).toBeDefined();
    expect(host.textContent).not.toContain('Concessões suspensas');
  });

  it('sem permissão ou sem a reclassificação, mostra a recusa sem nova tentativa e volta à fila da etapa', async () => {
    const { host } = await abrirReclassificacao(
      recusa('uniplus.autorizacao.reclassificacao.nao_encontrada', 404),
      [PROTECAO_DE_DADOS],
    );

    expect(botao(host, 'Tentar novamente')).toBeUndefined();
    const volta = [...host.querySelectorAll('a')].find(
      (a) => a.textContent?.trim() === 'Voltar às reclassificações',
    );
    expect(volta?.getAttribute('href')).toBe('/acessos/reclassificacoes/protecao-de-dados');
  });

  it('traduz o catálogo desatualizado na leitura', async () => {
    const { host } = await abrirReclassificacao(
      recusa('uniplus.autorizacao.catalogo.desatualizado', 503, 'Catalog out of date'),
    );

    expect(host.textContent).toContain(
      'O sistema está sendo atualizado. Tente novamente em instantes.',
    );
  });

  it('com as duas permissões, volta à fila da gestão de acessos', async () => {
    const { host } = await abrirReclassificacao(ok(reclassificacao()), [
      GESTAO_DE_ACESSOS,
      PROTECAO_DE_DADOS,
    ]);

    expect(host.querySelector('.page-header__eyebrow a')?.getAttribute('href')).toBe(
      '/acessos/reclassificacoes/gestao-de-acessos',
    );
  });
});
