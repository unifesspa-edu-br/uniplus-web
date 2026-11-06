import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CODIGO_JA_EXISTE,
  ESCRITA,
  PROCESSANDO,
  Pagina,
  criado,
  engCiv,
  montarPagina,
  problema,
  recusaDeCampo,
  sucesso,
} from './cursos.testing';

describe('CursosPage — recusas ao salvar', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.encerrar());

  const chaveDe = (req: { request: { headers: { get(n: string): string | null } } }) =>
    req.request.headers.get('Idempotency-Key');
  const alertaDoDrawer = (): HTMLElement => p.elemento('ui-drawer ui-alert[variant="danger"]');

  it.each([
    ['Codigo', 'codigo', null],
    ['Nome', 'nome', null],
    ['Grau', 'grau', null],
    ['NivelEnsino', 'nivelEnsino', null],
    ['GrupoAreaEnem', 'grupoAreaEnem', 'cfg-curso-grupo-erro'],
  ] as const)(
    'mostra a recusa de %s no campo, associada e focada, sem toast',
    async (campo, nome, idDoErro) => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo(campo, 'Valor recusado.'));
      await p.propagar();
      await p.propagar();

      const controle = p.elemento<HTMLElement>(`[formcontrolname="${nome}"]`);
      expect(controle.getAttribute('aria-invalid')).toBe('true');
      expect(controle.closest('.field')?.classList.contains('is-error')).toBe(true);
      expect(controle.closest('.field')?.querySelector('.field__error')?.textContent?.trim()).toBe(
        'Valor recusado.',
      );
      if (idDoErro !== null) {
        expect(controle.getAttribute('aria-describedby')?.split(' ')).toContain(idDoErro);
      }
      expect(document.activeElement).toBe(controle);
      expect(p.elemento('ui-drawer [role="status"]').textContent).toContain('Revise os campos');
      expect(p.erros).not.toHaveBeenCalled();
    },
  );

  it('recusa seguida de sucesso: o reenvio usa chave nova, fecha e devolve o foco', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(...recusaDeCampo('Nome', 'Nome longo.'));
    await p.propagar();
    await p.propagar();
    p.preencher('nome', 'Nome revisado');

    const segunda = await p.enviar();
    expect(chaveDe(segunda)).not.toBe(chave);
    segunda.flush(...criado());
    await p.recarregarCom([engCiv]);

    expect(p.edicao.aberto()).toBe(false);
    expect(document.activeElement).toBe(p.novo());
  });

  it('código já existente marca o campo, renova a chave e não avisa por toast', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(
      ...problema(409, { code: CODIGO_JA_EXISTE, title: 'Já existe um curso com este código' }),
    );
    await p.propagar();
    await p.propagar();

    const codigo = p.campo('codigo');
    expect(codigo.getAttribute('aria-invalid')).toBe('true');
    expect(codigo.closest('.field')?.querySelector('.field__error')?.textContent).toContain(
      'Já existe',
    );
    expect(document.activeElement).toBe(codigo);
    expect(p.edicao.erro()).toBeNull();
    expect(p.erros).not.toHaveBeenCalled();
    p.preencher('codigo', 'OUTRO');
    expect(chaveDe(await p.enviar())).not.toBe(chave);
  });

  it('conflito de processamento mantém a chave e mostra a mensagem no alerta, sem marcar campo', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(...problema(409, { code: PROCESSANDO, title: 'Em processamento' }));
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain('Em processamento');
    expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
    expect(p.erros).not.toHaveBeenCalled();
    const segunda = await p.enviar();
    expect(chaveDe(segunda)).toBe(chave);
    segunda.flush(...criado());
    await p.recarregarCom([engCiv]);
  });

  it('corpo divergente da chave vai ao alerta e renova a chave', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(
      ...problema(422, { code: 'uniplus.idempotency.body_mismatch', title: 'Corpo divergente' }),
    );
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain('Corpo divergente');
    expect(chaveDe(await p.enviar())).not.toBe(chave);
  });

  it('curso não encontrado na edição vai ao alerta, sem toast', async () => {
    await p.abrirEdicao(engCiv);
    (await p.enviar(`${ESCRITA}/${engCiv.id}`)).flush(
      ...problema(404, { code: 'uniplus.configuracao.curso.nao_encontrado' }),
    );
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain('Falha');
    expect(p.erros).not.toHaveBeenCalled();
  });

  it('falha 5xx vai ao alerta, avisa por toast e mantém a chave para o reenvio', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain('Falha');
    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(chaveDe(await p.enviar())).toBe(chave);
  });

  it('o sucesso avisa por toast com o texto de cada modo', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(...criado());
    await p.recarregarCom([engCiv]);
    expect(p.sucessos).toHaveBeenLastCalledWith('Curso criado');
    expect(p.statusDaPagina()).toBe('Curso criado.');

    await p.abrirEdicao(engCiv);
    p.preencher('nome', 'Engenharia Civil revisada');
    (await p.enviar(`${ESCRITA}/${engCiv.id}`)).flush(...sucesso());
    await p.recarregarCom([engCiv]);
    expect(p.sucessos).toHaveBeenLastCalledWith('Curso atualizado');
    expect(p.statusDaPagina()).toBe('Curso atualizado.');
  });

  it('um novo envio, ainda que barrado pela validação, retira a recusa anterior da tela', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();
    expect(p.elemento('ui-drawer').textContent).toContain('Não foi possível salvar');

    p.preencher('codigo', '');
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
    await p.propagar();

    expect(p.elemento('ui-drawer').textContent).not.toContain('Não foi possível salvar');
    p.http.expectNone(ESCRITA);
  });

  it('envio barrado localmente leva o foco ao primeiro campo inválido', async () => {
    await p.abrirCadastro();
    p.preencher('nome', '');
    p.preencher('grau', '');
    p.salvar().focus();
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
    await p.propagar();
    await p.propagar();

    p.http.expectNone(ESCRITA);
    expect(document.activeElement).toBe(p.campo('nome'));
    expect(p.campo('nome').getAttribute('aria-invalid')).toBe('true');
  });

  it('a recusa do servidor some ao reenviar: só a validação local barra', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(...recusaDeCampo('Nome', 'Nome longo.'));
    await p.propagar();
    expect(p.campo('nome').getAttribute('aria-invalid')).toBe('true');

    const segunda = await p.enviar();
    expect(segunda.request.method).toBe('POST');
    segunda.flush(...criado());
    await p.recarregarCom([engCiv]);
  });
});
