import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockProblemDetails } from './api-result.testing';
import { ProblemI18nService } from './problem-i18n.service';

describe('ProblemI18nService', () => {
  let service: ProblemI18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProblemI18nService);
  });

  it('sem override registrado, repete title e detail emitidos pelo backend', () => {
    const problem = mockProblemDetails({
      title: 'Edital não encontrado',
      detail: 'Nenhum edital ativo com o id informado',
      code: 'uniplus.selecao.edital.nao_encontrado',
    });

    expect(service.resolve(problem)).toEqual({
      title: 'Edital não encontrado',
      detail: 'Nenhum edital ativo com o id informado',
    });
  });

  it('aplica override com strings literais para title e detail', () => {
    service.register('uniplus.selecao.edital.nao_encontrado', {
      title: 'Esse edital não está mais disponível',
      detail: 'Confira a listagem pública para ver os processos abertos.',
    });

    const message = service.resolve(
      mockProblemDetails({ code: 'uniplus.selecao.edital.nao_encontrado' }),
    );

    expect(message.title).toBe('Esse edital não está mais disponível');
    expect(message.detail).toBe('Confira a listagem pública para ver os processos abertos.');
  });

  it('aplica override com função recebendo o ProblemDetails original', () => {
    service.register('uniplus.contract.versao_nao_suportada', {
      title: (problem) => `Versão ${problem.available_versions?.join(',') ?? '?'} é a única suportada`,
    });

    const message = service.resolve(
      mockProblemDetails({
        code: 'uniplus.contract.versao_nao_suportada',
        status: 406,
        available_versions: [1],
      }),
    );

    expect(message.title).toBe('Versão 1 é a única suportada');
  });

  it('traduz o catálogo desatualizado em qualquer tela, sem registro', () => {
    const message = service.resolve(
      mockProblemDetails({
        code: 'uniplus.autorizacao.catalogo.desatualizado',
        status: 503,
        title: 'Catalog out of date',
      }),
    );

    expect(message).toEqual({
      title: 'O sistema está sendo atualizado.',
      detail: 'Tente novamente em instantes.',
    });
  });

  it('traduz o vínculo com fato que aguarda a proteção de dados em qualquer tela, sem registro', () => {
    const message = service.resolve(
      mockProblemDetails({ code: 'uniplus.vinculo_catalogo.fato_com_protecao_pendente', status: 422 }),
    );

    expect(message.title).toContain('aguarda a aprovação da proteção de dados');
    expect(message.detail).toContain('Retire-o do formulário, da regra ou da condição');
  });

  it('o override registrado prevalece sobre a tradução padrão', () => {
    service.register('uniplus.vinculo_catalogo.fato_com_protecao_pendente', { title: 'Texto da tela' });

    expect(
      service.resolve(mockProblemDetails({ code: 'uniplus.vinculo_catalogo.fato_com_protecao_pendente' })).title,
    ).toBe('Texto da tela');
  });

  it('encaixa action quando override declarado', () => {
    service.register('uniplus.idempotency.body_mismatch', {
      title: 'A requisição mudou, gere uma nova chave',
      action: { route: '/editais', label: 'Voltar para a lista' },
    });

    const message = service.resolve(
      mockProblemDetails({ code: 'uniplus.idempotency.body_mismatch' }),
    );

    expect(message.action).toEqual({ route: '/editais', label: 'Voltar para a lista' });
  });

  it('unregister remove override previamente registrado', () => {
    service.register('uniplus.test.fake', { title: 'Override antigo' });
    service.unregister('uniplus.test.fake');

    const message = service.resolve(
      mockProblemDetails({ code: 'uniplus.test.fake', title: 'Original do backend' }),
    );

    expect(message.title).toBe('Original do backend');
  });
});
