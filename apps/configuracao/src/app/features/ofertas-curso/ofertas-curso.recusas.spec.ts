import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CORPO_DIVERGENTE,
  ERRO_INTERNO,
  ESCRITA,
  NAO_ENCONTRADA,
  PROCESSANDO,
  Pagina,
  criado,
  montarPagina,
  oferta,
  problema,
  recusaDeCampos,
  recusaDoDominio,
  sucesso,
} from './ofertas-curso.testing';

const CODIGO = 'uniplus.configuracao.oferta_curso.';

/** Cada recusa de validação que o servidor atribui a um campo: o código, o `field` e onde ela aparece. */
const RECUSAS_POR_CAMPO: readonly (readonly [string, string, string])[] = [
  ['programa_de_oferta_invalido', 'programaDeOferta', '[formcontrolname="programaDeOferta"]'],
  ['formato_pedagogico_invalido', 'formatoPedagogico', '[formcontrolname="formatoPedagogico"]'],
  ['regime_de_turno_obrigatorio', 'regimeDeTurno', '[formcontrolname="regimeDeTurno"]'],
  ['regime_de_turno_invalido', 'regimeDeTurno', '[formcontrolname="regimeDeTurno"]'],
  ['turno_invalido', 'turnos', 'fieldset.cfg-oferta-turnos input'],
  ['turnos_obrigatorios', 'turnos', 'fieldset.cfg-oferta-turnos input'],
  ['turno_repetido', 'turnos', 'fieldset.cfg-oferta-turnos input'],
  ['cardinalidade_turnos_incompativel_com_regime', 'turnos', 'fieldset.cfg-oferta-turnos input'],
  [
    'vagas_anuais_negativas',
    'vagasAnuaisAutorizadas',
    '[formcontrolname="vagasAnuaisAutorizadas"]',
  ],
  [
    'regime_de_funcionamento_obrigatorio',
    'regimeDeFuncionamento',
    '[formcontrolname="regimeDeFuncionamento"]',
  ],
  [
    'regime_de_funcionamento_invalido',
    'regimeDeFuncionamento',
    '[formcontrolname="regimeDeFuncionamento"]',
  ],
  [
    'regime_de_funcionamento_incompativel_com_regime_de_turno',
    'regimeDeFuncionamento',
    '[formcontrolname="regimeDeFuncionamento"]',
  ],
  ['e_mec_codigo_tamanho', 'eMecCodigo', '[formcontrolname="eMecCodigo"]'],
  ['codigo_sga_tamanho', 'codigoSga', '[formcontrolname="codigoSga"]'],
  ['ato_autorizacao_mec_tamanho', 'atoAutorizacaoMec', '[formcontrolname="atoAutorizacaoMec"]'],
  [
    'base_legal_obrigatoria_para_programa_nao_regular',
    'baseLegal',
    '[formcontrolname="baseLegal"]',
  ],
  ['base_legal_tamanho', 'baseLegal', '[formcontrolname="baseLegal"]'],
];

/** Recusas de vínculo, que o servidor emite só pelo código, sem `errors[]`. */
const RECUSAS_DE_VINCULO: readonly (readonly [string, string, string])[] = [
  ['curso_inexistente_ou_removido', 'cursoId', '#cfg-oferta-curso-id'],
  ['local_oferta_inexistente_ou_removido', 'localOfertaId', '#cfg-oferta-local-id'],
  ['unidade_ofertante_inexistente', 'unidadeOfertanteOrigemId', '#cfg-oferta-unidade-id'],
  ['unidade_ofertante_origem_obrigatoria', 'unidadeOfertanteOrigemId', '#cfg-oferta-unidade-id'],
];

describe('OfertasCursoPage — recusas ao salvar', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.encerrar());

  const chaveDe = (req: { request: { headers: { get(n: string): string | null } } }) =>
    req.request.headers.get('Idempotency-Key');
  const alertaDoDrawer = (): HTMLElement => p.elemento('ui-drawer ui-alert[variant="danger"]');

  it.each([
    ...RECUSAS_POR_CAMPO.map(([sufixo, campo, seletor]) => [sufixo, campo, seletor, true] as const),
    ...RECUSAS_DE_VINCULO.map(
      ([sufixo, campo, seletor]) => [sufixo, campo, seletor, false] as const,
    ),
  ])(
    'a recusa %s marca o campo %s, associada e focada, sem toast',
    async (sufixo, campo, seletor, comErros) => {
      await p.abrirCadastro();
      if (sufixo.startsWith('base_legal')) {
        p.preencher('programaDeOferta', 'PARFOR');
        await p.propagar();
        p.preencher('baseLegal', 'Convênio nº 1');
        await p.propagar();
      }
      (await p.enviar()).flush(
        ...(comErros
          ? recusaDeCampos({ field: campo, code: sufixo, message: 'Valor recusado.' })
          : recusaDoDominio(`${CODIGO}${sufixo}`, 'Valor recusado.')),
      );
      await p.propagar();
      await p.propagar();

      const controle = p.elemento<HTMLElement>(seletor);
      expect(controle.getAttribute('aria-invalid')).toBe('true');
      expect(controle.closest('.field')?.classList.contains('is-error')).toBe(true);
      expect(controle.closest('.field')?.querySelector('.field__error')?.textContent?.trim()).toBe(
        'Valor recusado.',
      );
      expect(controle.getAttribute('aria-describedby')?.split(' ')).toContain(
        `cfg-oferta-${campo}-erro`,
      );
      expect(document.activeElement).toBe(controle);
      expect(p.elemento('ui-drawer [role="status"]').textContent).toContain('Revise os campos');
      expect(p.edicao.erro()).toBeNull();
      expect(p.erros).not.toHaveBeenCalled();
    },
  );

  it('recusa seguida de sucesso: o reenvio usa chave nova, fecha e devolve o foco', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(
      ...recusaDeCampos({
        field: 'eMecCodigo',
        code: 'e_mec_codigo_tamanho',
        message: 'Código longo.',
      }),
    );
    await p.propagar();
    await p.propagar();
    p.preencher('eMecCodigo', '123');

    const segunda = await p.enviar();
    expect(chaveDe(segunda)).not.toBe(chave);
    segunda.flush(...criado());
    await p.recarregarCom([oferta]);

    expect(p.edicao.aberto()).toBe(false);
    expect(document.activeElement).toBe(p.novo());
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
    await p.recarregarCom([oferta]);
  });

  it('corpo divergente da chave vai ao alerta e renova a chave', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(...problema(422, { code: CORPO_DIVERGENTE, title: 'Corpo divergente' }));
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain('Corpo divergente');
    expect(chaveDe(await p.enviar())).not.toBe(chave);
  });

  it('oferta não encontrada na edição vai ao alerta, sem toast', async () => {
    await p.abrirEdicao();
    (await p.enviar(`${ESCRITA}/${oferta.id}`)).flush(...problema(404, { code: NAO_ENCONTRADA }));
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain('Falha');
    expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
    expect(p.erros).not.toHaveBeenCalled();
  });

  it('falha 5xx vai ao alerta, avisa por toast e mantém a chave para o reenvio', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(...problema(500, { code: ERRO_INTERNO }));
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain('Falha');
    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(chaveDe(await p.enviar())).toBe(chave);
  });

  it('o sucesso avisa por toast com o texto de cada modo', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(...criado());
    await p.recarregarCom([oferta]);
    expect(p.sucessos).toHaveBeenLastCalledWith('Oferta de curso criada');
    expect(p.statusDaPagina()).toBe('Oferta de curso criada.');

    await p.abrirEdicao();
    p.preencher('eMecCodigo', '999999');
    (await p.enviar(`${ESCRITA}/${oferta.id}`)).flush(...sucesso());
    await p.recarregarCom([oferta]);
    expect(p.sucessos).toHaveBeenLastCalledWith('Oferta de curso atualizada');
    expect(p.statusDaPagina()).toBe('Oferta de curso atualizada.');
  });

  it('um novo envio, ainda que barrado pela validação, retira a recusa anterior da tela', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(...problema(500, { code: ERRO_INTERNO }));
    await p.propagar();
    expect(p.elemento('ui-drawer').textContent).toContain('Não foi possível salvar');

    p.preencher('cursoId', '');
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
    await p.propagar();

    expect(p.elemento('ui-drawer').textContent).not.toContain('Não foi possível salvar');
    p.http.expectNone(ESCRITA);
  });

  it('envio barrado localmente leva o foco ao primeiro campo inválido', async () => {
    await p.abrirCadastro();
    p.preencher('localOfertaId', '');
    p.preencher('unidadeOfertanteOrigemId', '');
    p.salvar().focus();
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
    await p.propagar();
    await p.propagar();

    p.http.expectNone(ESCRITA);
    expect(document.activeElement).toBe(p.campo('localOfertaId'));
    expect(p.campo('localOfertaId').getAttribute('aria-invalid')).toBe('true');
  });

  it('a recusa do servidor some ao reenviar: só a validação local barra', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(
      ...recusaDeCampos({
        field: 'eMecCodigo',
        code: 'e_mec_codigo_tamanho',
        message: 'Código longo.',
      }),
    );
    await p.propagar();
    expect(p.campo('eMecCodigo').getAttribute('aria-invalid')).toBe('true');

    const segunda = await p.enviar();
    expect(segunda.request.method).toBe('POST');
    segunda.flush(...criado());
    await p.recarregarCom([oferta]);
  });

  it('descartar a recusa do servidor não reemite a mudança de valor dos campos', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(
      ...recusaDeCampos({
        field: 'eMecCodigo',
        code: 'e_mec_codigo_tamanho',
        message: 'Código longo.',
      }),
    );
    await p.propagar();

    let emissoes = 0;
    const assinatura = p.edicao.form.valueChanges.subscribe(() => emissoes++);
    const segunda = await p.enviar();
    assinatura.unsubscribe();

    expect(emissoes).toBe(0);
    segunda.flush(...criado());
    await p.recarregarCom([oferta]);
  });

  it('código desconhecido do domínio não marca campo: vai ao alerta', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(...recusaDoDominio(`${CODIGO}outra_regra`, 'Regra nova.'));
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain('Regra nova.');
    expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
  });

  it('a recusa sobrevive à edição de outro campo', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(
      ...recusaDeCampos({
        field: 'regimeDeFuncionamento',
        code: 'regime_de_funcionamento_invalido',
        message: 'Regime de funcionamento inválido.',
      }),
    );
    await p.propagar();
    const regime = p.campo('regimeDeFuncionamento');
    expect(regime.getAttribute('aria-invalid')).toBe('true');

    p.preencher('eMecCodigo', '999999');
    await p.propagar();

    expect(regime.getAttribute('aria-invalid')).toBe('true');
    expect(regime.closest('.field')?.querySelector('.field__error')?.textContent?.trim()).toBe(
      'Regime de funcionamento inválido.',
    );
    expect(p.campo('eMecCodigo').getAttribute('aria-invalid')).toBeNull();
  });

  it('duas recusas na mesma resposta marcam cada campo com a própria mensagem e focam o primeiro do formulário', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(
      ...recusaDeCampos(
        { field: 'codigoSga', code: 'codigo_sga_tamanho', message: 'SGA longo.' },
        { field: 'eMecCodigo', code: 'e_mec_codigo_tamanho', message: 'e-MEC longo.' },
      ),
    );
    await p.propagar();
    await p.propagar();

    const mensagem = (nome: string) =>
      p.campo(nome).closest('.field')?.querySelector('.field__error')?.textContent?.trim();
    expect(mensagem('eMecCodigo')).toBe('e-MEC longo.');
    expect(mensagem('codigoSga')).toBe('SGA longo.');
    expect(p.campo('eMecCodigo').getAttribute('aria-invalid')).toBe('true');
    expect(p.campo('codigoSga').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(p.campo('eMecCodigo'));
    expect(p.edicao.erro()).toBeNull();
    expect(p.erros).not.toHaveBeenCalled();
  });

  it('erro de validação de campo que a tela desconhece vai ao alerta', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(
      ...recusaDeCampos({
        field: 'campoNovo',
        code: 'campo_novo',
        message: 'Campo novo recusado.',
      }),
    );
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain('Campo novo recusado.');
    expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
  });
});
