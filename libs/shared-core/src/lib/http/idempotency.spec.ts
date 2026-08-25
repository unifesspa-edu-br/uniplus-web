import { HttpContext } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';
import {
  deveRotacionarIdempotencyKey,
  IDEMPOTENCY_KEY_TOKEN,
  IDEMPOTENCY_PROBLEM_CODES,
  idempotencyKey,
  isValidIdempotencyKey,
  withIdempotencyKey,
} from './idempotency';

const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('idempotencyKey.create', () => {
  it('gera uma string que satisfaz o formato canônico de UUID v7', () => {
    const key = idempotencyKey.create();
    expect(key).toMatch(UUID_V7_REGEX);
  });

  it('chamadas consecutivas retornam keys distintas', () => {
    const a = idempotencyKey.create();
    const b = idempotencyKey.create();
    expect(a).not.toBe(b);
  });
});

describe('withIdempotencyKey', () => {
  it('sem argumento, popula HttpContext com UUID v7 válido', () => {
    const ctx = withIdempotencyKey();
    const key = ctx.get(IDEMPOTENCY_KEY_TOKEN);
    expect(key).not.toBeNull();
    expect(key as string).toMatch(UUID_V7_REGEX);
  });

  it('com argumento, reusa a key fornecida sem regenerar', () => {
    const explicit = idempotencyKey.create();
    const spy = vi.spyOn(idempotencyKey, 'create');
    const ctx = withIdempotencyKey(explicit);
    expect(ctx.get(IDEMPOTENCY_KEY_TOKEN)).toBe(explicit);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it.each([
    ['vazia', ''],
    ['contém vírgula', 'edital,123'],
    ['contém ponto-e-vírgula', 'edital;123'],
    ['caractere fora de ASCII printable', 'editalé'],
    ['mais de 255 caracteres', 'a'.repeat(256)],
  ])('rejeita key inválida — %s', (_label, value) => {
    expect(() => withIdempotencyKey(value)).toThrow(/chave inválida/i);
  });

  it('IDEMPOTENCY_KEY_TOKEN tem default null para HttpContext sem declaração', () => {
    const empty = new HttpContext();
    expect(empty.get(IDEMPOTENCY_KEY_TOKEN)).toBeNull();
  });
});

describe('deveRotacionarIdempotencyKey', () => {
  it.each([
    ['422 de validação', 422, 'uniplus.configuracao.tipo_deficiencia.codigo_formato_invalido'],
    ['409 de conflito de domínio', 409, 'uniplus.configuracao.tipo_deficiencia.codigo_ja_existe'],
    ['corpo divergente para a mesma chave', 422, IDEMPOTENCY_PROBLEM_CODES.BODY_MISMATCH],
    ['404', 404, 'uniplus.configuracao.tipo_deficiencia.nao_encontrado'],
  ])('renova a chave — %s', (_rotulo, status, code) => {
    expect(deveRotacionarIdempotencyKey({ status, code })).toBe(true);
  });

  it('preserva a chave em conflito de processamento — o retry é do mesmo comando', () => {
    expect(
      deveRotacionarIdempotencyKey({
        status: 409,
        code: IDEMPOTENCY_PROBLEM_CODES.PROCESSING_CONFLICT,
      }),
    ).toBe(false);
  });

  it.each([
    ['5xx — nada foi gravado, retry seguro', 500],
    ['erro de rede sintetizado no cliente', 0],
  ])('preserva a chave — %s', (_rotulo, status) => {
    expect(deveRotacionarIdempotencyKey({ status, code: 'uniplus.client.network_error' })).toBe(
      false,
    );
  });
});

describe('isValidIdempotencyKey', () => {
  it('aceita UUID v7 (formato canônico do helper)', () => {
    expect(isValidIdempotencyKey(idempotencyKey.create())).toBe(true);
  });

  it('aceita string ASCII printable de 1 caractere', () => {
    expect(isValidIdempotencyKey('a')).toBe(true);
  });

  it('aceita string ASCII printable de 255 caracteres', () => {
    expect(isValidIdempotencyKey('a'.repeat(255))).toBe(true);
  });

  it.each([
    ['vazia', ''],
    ['256 caracteres', 'a'.repeat(256)],
    ['vírgula', 'a,b'],
    ['ponto-e-vírgula', 'a;b'],
    ['controle (NUL)', 'a\u0000b'],
    ['acentuada', 'açúcar'],
  ])('rejeita — %s', (_label, value) => {
    expect(isValidIdempotencyKey(value)).toBe(false);
  });
});
