import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AmbienteHttp,
  chamadaPost,
  falhaDe,
  prepararAmbienteHttp,
  problemaDe,
  problemJson,
} from './api-result.interceptor.testing';

const URL_DA_CHAMADA = '/api/selecao/editais';

describe('apiResultInterceptor: causas do problema', () => {
  let ambiente: AmbienteHttp;

  beforeEach(() => {
    ambiente = prepararAmbienteHttp();
  });

  afterEach(() => {
    ambiente.controller.verify();
  });

  function causasRecebidas(errors: readonly unknown[]): readonly object[] | undefined {
    const problema = { ...problemaDe(422, 'uniplus.validacao', 'Erro de validação'), errors };
    const simulada = problemJson(422, 'Unprocessable', problema);
    return falhaDe(ambiente, chamadaPost(URL_DA_CHAMADA), simulada).problem.errors;
  }

  it('causa sem a chave field chega como causa geral, sem a chave', () => {
    const causas = causasRecebidas([{ code: 'Edital.Bloqueado', message: 'Edital bloqueado.' }]);

    expect(causas).toEqual([{ code: 'Edital.Bloqueado', message: 'Edital bloqueado.' }]);
    expect('field' in (causas?.[0] ?? {})).toBe(false);
  });

  it('causa com field nulo chega como causa geral, sem a chave', () => {
    const causas = causasRecebidas([
      { field: null, code: 'Edital.Bloqueado', message: 'Bloqueado.' },
    ]);

    expect(causas).toEqual([{ code: 'Edital.Bloqueado', message: 'Bloqueado.' }]);
    expect('field' in (causas?.[0] ?? {})).toBe(false);
  });

  it('causa com field vazio preserva a raiz do documento', () => {
    const causas = causasRecebidas([
      { field: '', code: 'Documento.Invalido', message: 'Inválido.' },
    ]);

    expect(causas).toEqual([{ field: '', code: 'Documento.Invalido', message: 'Inválido.' }]);
  });

  it('lista mista mantém a ordem do fio', () => {
    const causas = causasRecebidas([
      { field: 'cpf', code: 'A', message: 'a' },
      { code: 'B', message: 'b' },
      { field: '', code: 'C', message: 'c' },
    ]);

    expect(causas).toEqual([
      { field: 'cpf', code: 'A', message: 'a' },
      { code: 'B', message: 'b' },
      { field: '', code: 'C', message: 'c' },
    ]);
  });

  it('lista só de causas gerais preenche errors', () => {
    const causas = causasRecebidas([{ code: 'B', message: 'b' }]);

    expect(causas).toHaveLength(1);
  });

  it('descarta causa com field de outro tipo', () => {
    const causas = causasRecebidas([
      { field: 7, code: 'A', message: 'a' },
      { field: 'cpf', code: 'B', message: 'b' },
    ]);

    expect(causas).toEqual([{ field: 'cpf', code: 'B', message: 'b' }]);
  });

  it('descarta item que não é objeto e causa sem code ou sem message', () => {
    const causas = causasRecebidas([
      'texto',
      null,
      { field: 'cpf', message: 'sem code' },
      { field: 'cpf', code: 'sem.message' },
      { field: 'cpf', code: 3, message: 'code numérico' },
      { code: 'Ok', message: 'ok' },
    ]);

    expect(causas).toEqual([{ code: 'Ok', message: 'ok' }]);
  });
});
