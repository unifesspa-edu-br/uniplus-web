import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Pagina, montarPagina, problema } from './precedencias-fase.testing';

const CODIGO = 'uniplus.configuracao.precedencia_fase';
const CAUSA_GERAL = { code: `${CODIGO}.bloqueada`, message: 'O grafo está bloqueado.' };

describe('PrecedenciasFasePage — causa geral na recusa ao salvar', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.http.verify());

  it('a recusa que o código aponta a um campo mostra também a causa geral no alerta', async () => {
    await p.abrirCadastro('RESULTADO_FINAL', 'INSCRICAO');
    (await p.enviar()).flush(
      ...problema(409, {
        code: `${CODIGO}.aresta_duplicada`,
        title: 'Já existe a aresta.',
        errors: [CAUSA_GERAL],
      }),
    );
    await p.propagar();

    expect(p.campo('sucessoraCodigo').getAttribute('aria-invalid')).toBe('true');
    expect(p.elemento('ui-drawer ui-alert').textContent).toContain('O grafo está bloqueado.');
  });
});
