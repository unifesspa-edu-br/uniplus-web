import { LoginErrorCode, classifyLoginError } from './login-error.model';

describe('classifyLoginError', () => {
  it('detecta UserLocked a partir de error_description típico do Keycloak', () => {
    const result = classifyLoginError({
      error: 'invalid_grant',
      error_description: 'Account is temporarily locked',
    });
    expect(result.code).toBe(LoginErrorCode.UserLocked);
    expect(result.message).toContain('temporariamente bloqueada');
  });

  it('detecta UserLocked para "too many attempts"', () => {
    const result = classifyLoginError('Too many login attempts');
    expect(result.code).toBe(LoginErrorCode.UserLocked);
  });

  it('detecta InvalidCredentials a partir de "Invalid user credentials"', () => {
    const result = classifyLoginError({
      error: 'invalid_grant',
      error_description: 'Invalid user credentials',
    });
    expect(result.code).toBe(LoginErrorCode.InvalidCredentials);
    expect(result.message).toContain('Usuário ou senha inválidos');
  });

  it('detecta KeycloakUnavailable para erros de rede', () => {
    const result = classifyLoginError(new Error('Failed to fetch'));
    expect(result.code).toBe(LoginErrorCode.KeycloakUnavailable);
  });

  it('detecta AccessDenied quando o usuário cancela o fluxo', () => {
    const result = classifyLoginError('access_denied');
    expect(result.code).toBe(LoginErrorCode.AccessDenied);
  });

  it('retorna Unknown com mensagem padrão quando não reconhece o erro', () => {
    const result = classifyLoginError({ error: 'foo', error_description: 'bar' });
    expect(result.code).toBe(LoginErrorCode.Unknown);
    expect(result.message).toContain('Não foi possível concluir o login');
    expect(result.rawDescription).toBe('bar');
  });

  it('lida com entradas vazias sem lançar', () => {
    const result = classifyLoginError(null);
    expect(result.code).toBe(LoginErrorCode.Unknown);
    expect(result.rawDescription).toBeUndefined();
  });
});
