import { afterEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  Pagina,
  criado,
  montarPagina,
  problema,
  recusaDeCampo,
  rg,
  sucesso,
} from './tipos-documento.testing';

const PROCESSANDO = { code: 'uniplus.idempotency.processing_conflict', title: 'Em processamento' };
const DUPLICADO = {
  code: 'uniplus.configuracao.tipo_documento.codigo_ja_existe',
  title: 'Já existe um tipo de documento ativo com este código',
};
const CONCORRENCIA = {
  code: 'uniplus.configuracao.tipo_documento.conflito_de_concorrencia',
  title: 'Conflito de concorrência',
};
const NAO_ENCONTRADO = {
  code: 'uniplus.configuracao.tipo_documento.nao_encontrado',
  title: 'Tipo de documento não encontrado',
};

describe('TiposDocumentoPage — recusas do servidor ao salvar', () => {
  let p: Pagina;
  afterEach(() => p.encerrar());

  const chaveDe = (req: { request: { headers: { get(n: string): string | null } } }) =>
    req.request.headers.get('Idempotency-Key');
  const alerta = (): HTMLElement => p.elemento('ui-drawer ui-alert');

  it.each([
    ['codigo', 'codigo', 'uniplus.configuracao.tipo_documento.codigo_formato_invalido'],
    ['nome', 'nome', 'uniplus.configuracao.tipo_documento.nome_tamanho'],
    ['categoria', 'categoria', 'uniplus.configuracao.tipo_documento.categoria_nao_encontrada'],
    ['nome', 'nome', 'uniplus.configuracao.tipo_documento.nome_obrigatorio'],
    ['categoria', 'categoria', 'uniplus.configuracao.tipo_documento.categoria_obrigatoria'],
    ['codigo', 'codigo', 'uniplus.configuracao.tipo_documento.codigo_obrigatorio'],
    [
      'hipoteseLegal',
      'hipoteseLegal',
      'uniplus.configuracao.tipo_documento.hipotese_legal_incompativel_com_classificacao',
    ],
    ['descricao', 'descricao', 'uniplus.configuracao.tipo_documento.descricao_tamanho'],
    [
      'tamanhoMaximoMb',
      'tamanhoMaximoMb',
      'uniplus.configuracao.tipo_documento.tamanho_maximo_invalido',
    ],
    [
      'classificacaoProtecao',
      'classificacaoProtecao',
      'uniplus.configuracao.tipo_documento.classificacao_protecao_invalida',
    ],
    [
      'hipoteseLegal',
      'hipoteseLegal',
      'uniplus.configuracao.tipo_documento.hipotese_legal_invalida',
    ],
    [
      'finalidadeTratamento',
      'finalidadeTratamento',
      'uniplus.configuracao.tipo_documento.finalidade_tratamento_tamanho',
    ],
  ] as const)('mostra a recusa de %s no campo e o foca', async (campo, nome, codigo) => {
    p = await montarPagina([]);
    await p.abrirCadastro();
    (await p.enviar()).flush(...recusaDeCampo(campo, 'Valor recusado.', codigo));
    await p.propagar();
    await p.propagar();

    const controle = p.campo(nome);
    expect(controle.getAttribute('aria-invalid')).toBe('true');
    expect(controle.closest('.field')?.classList.contains('is-error')).toBe(true);
    expect(controle.closest('.field')?.querySelector('.field__error')?.textContent?.trim()).toBe(
      'Valor recusado.',
    );
    expect(document.activeElement).toBe(controle);
    expect(p.elemento('ui-drawer [role="status"]').textContent).toContain('Revise os campos');
    expect(p.erros).not.toHaveBeenCalled();
  });

  it.each([
    'uniplus.configuracao.tipo_documento.tipo_equivalente_igual_codigo',
    'uniplus.configuracao.tipo_documento.tipo_equivalente_tamanho',
  ])('a recusa do tipo equivalente (%s) aparece no campo e o foca', async (codigo) => {
    p = await montarPagina([]);
    await p.abrirCadastro();
    (await p.enviar()).flush(...recusaDeCampo('tipoEquivalente', 'Equivalente recusado.', codigo));
    await p.propagar();
    await p.propagar();
    expect(p.campo('tipoEquivalente').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(p.campo('tipoEquivalente'));
  });

  it('o código duplicado (409) vai ao campo, renova a chave e mantém o formulário aberto', async () => {
    p = await montarPagina([rg]);
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(...problema(409, DUPLICADO));
    await p.propagar();
    await p.propagar();

    expect(p.edicao.aberto()).toBe(true);
    expect(p.campo('codigo').getAttribute('aria-invalid')).toBe('true');
    expect(
      p.campo('codigo').closest('.field')?.querySelector('.field__error')?.textContent,
    ).toContain('Já existe um tipo de documento ativo com este código');
    expect(document.activeElement).toBe(p.campo('codigo'));
    expect(p.erros).not.toHaveBeenCalled();

    p.preencher('codigo', 'DECL_RENDA');
    const segunda = await p.enviar();
    expect(chaveDe(segunda)).not.toBe(chave);
    segunda.flush(...criado());
    await p.recarregarCom([rg]);
  });

  it('recusa em outro campo não impede o reenvio depois de corrigir só aquele', async () => {
    p = await montarPagina([]);
    await p.abrirCadastro();
    (await p.enviar()).flush(...recusaDeCampo('nome', 'Nome recusado.'));
    await p.propagar();
    await p.propagar();
    expect(p.campo('nome').getAttribute('aria-invalid')).toBe('true');

    p.preencher('descricao', 'Outra descrição');
    const segunda = await p.enviar();
    expect(segunda.request.body).toMatchObject({ descricao: 'Outra descrição' });
    segunda.flush(...criado());
    await p.recarregarCom([rg]);
    expect(p.edicao.aberto()).toBe(false);
  });

  it('a recusa seguida de sucesso fecha o formulário e devolve o foco a "Novo tipo"', async () => {
    p = await montarPagina([]);
    await p.abrirCadastro();
    (await p.enviar()).flush(...recusaDeCampo('nome', 'Nome longo.'));
    await p.propagar();
    await p.propagar();
    p.preencher('nome', 'Nome revisado');
    (await p.enviar()).flush(...criado());
    await p.recarregarCom([rg]);

    expect(p.edicao.aberto()).toBe(false);
    expect(document.activeElement).toBe(p.novo());
  });

  it('o conflito de processamento mantém a chave e vai ao alerta, sem marcar campo', async () => {
    p = await montarPagina([]);
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(...problema(409, PROCESSANDO));
    await p.propagar();

    expect(alerta().textContent).toContain('Em processamento');
    expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
    expect(p.erros).not.toHaveBeenCalled();
    const segunda = await p.enviar();
    expect(chaveDe(segunda)).toBe(chave);
    segunda.flush(...criado());
    await p.recarregarCom([rg]);
  });

  it('o corpo divergente da chave vai ao alerta e renova a chave', async () => {
    p = await montarPagina([]);
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(
      ...problema(422, { code: 'uniplus.idempotency.body_mismatch', title: 'Corpo divergente' }),
    );
    await p.propagar();

    expect(alerta().textContent).toContain('Corpo divergente');
    const segunda = await p.enviar();
    expect(chaveDe(segunda)).not.toBe(chave);
    segunda.flush(...criado());
    await p.recarregarCom([rg]);
  });

  it('o 422 sem campo mapeável vai ao alerta com a orientação de revisar', async () => {
    p = await montarPagina([]);
    await p.abrirCadastro();
    (await p.enviar()).flush(...recusaDeCampo('desconhecido', 'Sem campo.'));
    await p.propagar();

    expect(alerta().textContent).toContain('Não foi possível mapear os erros de validação');
    expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
  });

  it('o 5xx mostra o alerta, avisa por toast e a nova tentativa repete a mesma chave', async () => {
    p = await montarPagina([]);
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(...problema(503, { title: 'Serviço indisponível' }));
    await p.propagar();

    expect(alerta().textContent).toContain('Serviço indisponível');
    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(p.edicao.aberto()).toBe(true);
    const segunda = await p.enviar();
    expect(chaveDe(segunda)).toBe(chave);
    segunda.flush(...criado());
    await p.recarregarCom([rg]);
  });

  it('o 404 na edição vai ao alerta, sem campo marcado e sem toast', async () => {
    p = await montarPagina([rg]);
    await p.abrirEdicao(rg);
    (await p.enviar(`${ESCRITA}/${rg.id}`)).flush(...problema(404, NAO_ENCONTRADO));
    await p.propagar();

    expect(alerta().textContent).toContain('Tipo de documento não encontrado');
    expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
    expect(p.erros).not.toHaveBeenCalled();
  });

  it('o 403 vai ao alerta sem toast', async () => {
    p = await montarPagina([rg]);
    await p.abrirEdicao(rg);
    (await p.enviar(`${ESCRITA}/${rg.id}`)).flush(...problema(403, { title: 'Acesso negado' }));
    await p.propagar();

    expect(alerta().textContent).toContain('Acesso negado');
    expect(p.erros).not.toHaveBeenCalled();
    expect(p.edicao.aberto()).toBe(true);
  });

  it('a edição bem-sucedida depois de recusa devolve o foco ao botão Editar da linha', async () => {
    p = await montarPagina([rg]);
    await p.abrirEdicao(rg);
    (await p.enviar(`${ESCRITA}/${rg.id}`)).flush(...recusaDeCampo('nome', 'Nome longo.'));
    await p.propagar();
    await p.propagar();
    p.preencher('nome', 'Registro revisado');
    (await p.enviar(`${ESCRITA}/${rg.id}`)).flush(...sucesso());
    await p.recarregarCom([rg]);

    expect(document.activeElement).toBe(p.editar(rg));
  });
  it('reenviar depois da recusa de um campo não emite valor nem estado de nenhum controle', async () => {
    p = await montarPagina([]);
    await p.abrirCadastro();
    (await p.enviar()).flush(...recusaDeCampo('nome', 'Nome recusado.'));
    await p.propagar();
    await p.propagar();
    expect(p.edicao.form.controls.nome.hasError('backend')).toBe(true);

    let emissoes = 0;
    const contar = () => (emissoes += 1);
    const inscricoes = [
      p.edicao.form.valueChanges.subscribe(contar),
      p.edicao.form.statusChanges.subscribe(contar),
      p.edicao.form.controls.nome.valueChanges.subscribe(contar),
      p.edicao.form.controls.nome.statusChanges.subscribe(contar),
    ];
    const segunda = await p.enviar();
    inscricoes.forEach((i) => i.unsubscribe());

    expect(emissoes).toBe(0);
    expect(p.edicao.form.controls.nome.hasError('backend')).toBe(false);
    segunda.flush(...criado());
    await p.recarregarCom([rg]);
  });

  it('o conflito de concorrência vai ao alerta, sem campo marcado, e o reenvio usa chave nova', async () => {
    p = await montarPagina([rg]);
    await p.abrirEdicao(rg);
    const primeira = await p.enviar(`${ESCRITA}/${rg.id}`);
    const chave = chaveDe(primeira);
    primeira.flush(...problema(409, CONCORRENCIA));
    await p.propagar();

    expect(alerta().textContent).toContain('Conflito de concorrência');
    expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
    expect(p.erros).not.toHaveBeenCalled();
    expect(p.edicao.aberto()).toBe(true);
    const segunda = await p.enviar(`${ESCRITA}/${rg.id}`);
    expect(chaveDe(segunda)).not.toBe(chave);
    segunda.flush(...sucesso());
    await p.recarregarCom([rg]);
  });
});
