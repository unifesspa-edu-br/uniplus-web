import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ERRO_INTERNO,
  PROCESSANDO,
  Pagina,
  criado,
  montarPagina,
  oferta,
  problema,
  recusaDeCampos,
} from './ofertas-curso.testing';

const CAUSA_GERAL = {
  code: 'uniplus.configuracao.oferta_curso.bloqueada',
  message: 'A oferta está bloqueada.',
};

describe('OfertasCursoPage — causa geral na recusa ao salvar', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.encerrar());

  const chaveDe = (req: { request: { headers: { get(n: string): string | null } } }) =>
    req.request.headers.get('Idempotency-Key');
  const alertaDoDrawer = (): HTMLElement => p.elemento('ui-drawer ui-alert[variant="danger"]');

  it('o conflito de processamento com causa geral mostra a causa e mantém a chave para repetir', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(
      ...problema(409, { code: PROCESSANDO, title: 'Em processamento', errors: [CAUSA_GERAL] }),
    );
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain('A oferta está bloqueada.');
    expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
    const segunda = await p.enviar();
    expect(chaveDe(segunda)).toBe(chave);
    segunda.flush(...criado());
    await p.recarregarCom([oferta]);
  });

  it('a falha 5xx com causa geral mostra a causa, avisa por toast e mantém a chave', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(...problema(500, { code: ERRO_INTERNO, errors: [CAUSA_GERAL] }));
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain('A oferta está bloqueada.');
    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(chaveDe(await p.enviar())).toBe(chave);
  });

  it('a recusa de campo com causa geral marca o campo, mostra a causa no alerta e renova a chave', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    const [corpo, opcoes] = recusaDeCampos({
      field: 'eMecCodigo',
      code: 'e_mec_codigo_tamanho',
      message: 'Código longo.',
    });
    const comCausaGeral = {
      ...JSON.parse(corpo),
      errors: [...JSON.parse(corpo).errors, CAUSA_GERAL],
    };
    primeira.flush(JSON.stringify(comCausaGeral), opcoes);
    await p.propagar();

    expect(p.campo('eMecCodigo').getAttribute('aria-invalid')).toBe('true');
    expect(alertaDoDrawer().textContent).toContain('A oferta está bloqueada.');
    expect(p.erros).not.toHaveBeenCalled();
    expect(chaveDe(await p.enviar())).not.toBe(chave);
  });

  it('a recusa do vínculo, que o código aponta ao campo, também mostra a causa geral', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    primeira.flush(
      ...problema(422, {
        code: 'uniplus.configuracao.oferta_curso.curso_inexistente_ou_removido',
        title: 'Curso removido.',
        errors: [CAUSA_GERAL],
      }),
    );
    await p.propagar();

    expect(p.elemento('#cfg-oferta-curso-id').getAttribute('aria-invalid')).toBe('true');
    expect(alertaDoDrawer().textContent).toContain('A oferta está bloqueada.');
  });
});
