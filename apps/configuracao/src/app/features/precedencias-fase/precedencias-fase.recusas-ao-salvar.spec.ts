import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ERRO_INTERNO,
  ESCRITA,
  NAO_ENCONTRADA,
  Pagina,
  TITULO_DA_LISTA,
  criado,
  inscricaoHomologacao,
  montarPagina,
  problema,
  recusaDeCampo,
} from './precedencias-fase.testing';

const CODIGO = 'uniplus.configuracao.precedencia_fase';
const PROCESSANDO = { code: 'uniplus.idempotency.processing_conflict', title: 'Em processamento' };
const DUPLICADA = {
  code: `${CODIGO}.aresta_duplicada`,
  title: 'Já existe uma aresta de precedência viva com este par de fases',
};

describe('PrecedenciasFasePage — recusas do servidor ao salvar', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.http.verify());

  const chaveDe = (req: { request: { headers: { get(n: string): string | null } } }) =>
    req.request.headers.get('Idempotency-Key');
  const alertaDoDrawer = (): HTMLElement => p.elemento('ui-drawer ui-alert');
  const erroDaSucessora = (): string | undefined =>
    p
      .campo('sucessoraCodigo')
      .closest('.field')
      ?.querySelector('.field__error')
      ?.textContent?.trim();

  it.each([
    ['sucessoraCodigo', `${CODIGO}.sucessora_codigo_formato_invalido`],
    ['antecessoraCodigo', `${CODIGO}.antecessora_codigo_formato_invalido`],
  ] as const)('mostra a recusa de %s no campo, associada e focada', async (nome, code) => {
    await p.abrirCadastro();
    (await p.enviar()).flush(...recusaDeCampo(nome, 'Valor recusado.', code));
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
    ['sucessora', `${CODIGO}.sucessora_fora_do_conjunto_canonico`, 'sucessoraCodigo'],
    ['antecessora', `${CODIGO}.antecessora_fora_do_conjunto_canonico`, 'antecessoraCodigo'],
  ] as const)(
    'fase %s fora do conjunto canônico marca o campo dela e o foca',
    async (_lado, code, nome) => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo(nome, 'Fase fora do conjunto', code));
      await p.propagar();
      await p.propagar();

      expect(p.campo(nome).getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(p.campo(nome));
      expect(p.edicao.erro()).toBeNull();
      expect(p.erros).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['aresta duplicada', DUPLICADA],
    [
      'autorreferência recusada pelo servidor',
      { code: `${CODIGO}.self_loop`, title: 'Uma fase não pode preceder a si mesma' },
    ],
  ])(
    '%s aparece na sucessora, com o foco, sem fechar o drawer nem avisar por toast',
    async (_nome, recusa) => {
      await p.abrirCadastro('INSCRICAO', 'HOMOLOGACAO_INSCRICOES');
      (await p.enviar()).flush(...problema(422, recusa));
      await p.propagar();
      await p.propagar();

      expect(erroDaSucessora()).toBe(recusa.title);
      expect(p.campo('sucessoraCodigo').getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(p.campo('sucessoraCodigo'));
      expect(p.edicao.aberto()).toBe(true);
      expect(p.erros).not.toHaveBeenCalled();
    },
  );

  it('corrigir a antecessora tira o erro do par e libera o reenvio com chave nova', async () => {
    await p.abrirCadastro('INSCRICAO', 'HOMOLOGACAO_INSCRICOES');
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(...problema(422, DUPLICADA));
    await p.propagar();
    await p.propagar();
    expect(erroDaSucessora()).toBe(DUPLICADA.title);

    p.selecionar('antecessoraCodigo', 'AVALIACAO');
    await p.propagar();
    expect(erroDaSucessora()).toBeUndefined();
    expect(p.campo('sucessoraCodigo').getAttribute('aria-invalid')).toBeNull();

    const segunda = await p.enviar();
    expect(chaveDe(segunda)).not.toBe(chave);
    segunda.flush(...criado());
    await p.recarregarCom([inscricaoHomologacao]);
    expect(p.edicao.aberto()).toBe(false);
  });

  it('a recusa de uma fase isolada sobrevive à troca da outra fase', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(
      ...recusaDeCampo(
        'sucessoraCodigo',
        'Fase fora do conjunto',
        `${CODIGO}.sucessora_fora_do_conjunto_canonico`,
      ),
    );
    await p.propagar();
    p.selecionar('antecessoraCodigo', 'INSCRICAO');
    await p.propagar();

    expect(p.campo('sucessoraCodigo').getAttribute('aria-invalid')).toBe('true');
  });

  it('ciclo detectado vai ao alerta do formulário, sem marcar campo nem avisar por toast', async () => {
    await p.abrirCadastro('RESULTADO_FINAL', 'INSCRICAO');
    (await p.enviar()).flush(
      ...problema(422, {
        code: `${CODIGO}.ciclo_detectado`,
        title: 'A aresta fecharia um ciclo no grafo de precedências',
      }),
    );
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain(
      'A aresta fecharia um ciclo no grafo de precedências',
    );
    expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
    expect(p.erros).not.toHaveBeenCalled();
  });

  it('recusa seguida de sucesso: o reenvio usa chave nova, fecha e devolve o foco', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(...recusaDeCampo('sucessoraCodigo', 'Sucessora recusada.'));
    await p.propagar();
    await p.propagar();
    p.selecionar('sucessoraCodigo', 'RESULTADO_FINAL');

    const segunda = await p.enviar();
    expect(chaveDe(segunda)).not.toBe(chave);
    segunda.flush(...criado());
    await p.recarregarCom([inscricaoHomologacao]);

    expect(p.edicao.aberto()).toBe(false);
    expect(document.activeElement).toBe(p.novo());
  });

  it('conflito de processamento mantém a chave e mostra a mensagem no alerta, sem marcar campo', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(...problema(409, PROCESSANDO));
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain('Em processamento');
    expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
    expect(p.erros).not.toHaveBeenCalled();
    const segunda = await p.enviar();
    expect(chaveDe(segunda)).toBe(chave);
    segunda.flush(...criado());
    await p.recarregarCom([inscricaoHomologacao]);
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

  it('aresta removida por outra pessoa vai ao alerta, recarrega a lista e não avisa por toast', async () => {
    await p.abrirEdicao(inscricaoHomologacao);
    (await p.enviar(`${ESCRITA}/${inscricaoHomologacao.id}`)).flush(
      ...problema(404, NAO_ENCONTRADA),
    );
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain(NAO_ENCONTRADA.title);
    expect(p.edicao.aberto()).toBe(true);
    expect(p.erros).not.toHaveBeenCalled();
    await p.recarregarCom([]);
    expect(p.fixture.nativeElement.textContent).toContain('Nenhuma aresta de precedência');
  });

  it('cancelar depois que a recarga tirou a linha leva o foco ao título da lista', async () => {
    await p.abrirEdicao(inscricaoHomologacao);
    (await p.enviar(`${ESCRITA}/${inscricaoHomologacao.id}`)).flush(
      ...problema(404, NAO_ENCONTRADA),
    );
    await p.recarregarCom([]);
    expect(p.edicao.aberto()).toBe(true);

    p.elemento<HTMLButtonElement>('ui-drawer .form-drawer__footer .btn--tertiary').click();
    await p.propagar();
    await p.propagar();

    expect(p.edicao.aberto()).toBe(false);
    expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
  });

  it('salvar durante a recarga não apaga a recusa nem envia', async () => {
    await p.abrirEdicao(inscricaoHomologacao);
    (await p.enviar(`${ESCRITA}/${inscricaoHomologacao.id}`)).flush(
      ...problema(404, NAO_ENCONTRADA),
    );
    await p.propagar();
    expect(p.edicao.gravando()).toBe(true);
    expect(p.salvar().getAttribute('aria-disabled')).toBe('true');
    expect(p.salvar().textContent).not.toContain('Salvando...');

    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    p.salvar().dispatchEvent(clique);
    p.edicao.salvar();
    await p.propagar();

    expect(clique.defaultPrevented).toBe(true);
    p.http.expectNone(`${ESCRITA}/${inscricaoHomologacao.id}`);
    expect(alertaDoDrawer().textContent).toContain(NAO_ENCONTRADA.title);
    await p.recarregarCom([]);
  });

  it('falha 5xx vai ao alerta, avisa por toast e mantém a chave para o reenvio', async () => {
    await p.abrirCadastro();
    const primeira = await p.enviar();
    const chave = chaveDe(primeira);
    primeira.flush(...problema(500, ERRO_INTERNO));
    await p.propagar();

    expect(alertaDoDrawer()).toBeTruthy();
    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(chaveDe(await p.enviar())).toBe(chave);
  });

  it('erro de validação sem campo conhecido vai ao alerta', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(...recusaDeCampo('outro', 'Recusa sem campo.'));
    await p.propagar();

    expect(alertaDoDrawer().textContent).toContain('Não foi possível mapear os erros');
  });

  it('um novo envio, ainda que barrado pela validação, retira a recusa anterior da tela', async () => {
    await p.abrirCadastro();
    (await p.enviar()).flush(...problema(500, ERRO_INTERNO));
    await p.propagar();
    expect(alertaDoDrawer()).toBeTruthy();

    p.selecionar('sucessoraCodigo', 'AVALIACAO');
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
    await p.propagar();

    expect(p.fixture.nativeElement.querySelector('ui-drawer ui-alert')).toBeNull();
    p.http.expectNone(ESCRITA);
  });

  it('autorreferência é barrada no formulário, sem requisição, com a mensagem na sucessora e o foco nela', async () => {
    await p.abrirCadastro('AVALIACAO', 'AVALIACAO');
    p.salvar().focus();
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
    await p.propagar();
    await p.propagar();

    p.http.expectNone(ESCRITA);
    expect(erroDaSucessora()).toBe('A fase sucessora não pode ser igual à antecessora.');
    expect(document.activeElement).toBe(p.campo('sucessoraCodigo'));
    expect(p.edicao.aberto()).toBe(true);
  });

  it('envio sem fases escolhidas leva o foco ao primeiro campo inválido', async () => {
    p.novo().focus();
    p.novo().click();
    await p.propagar();
    p.salvar().focus();
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
    await p.propagar();
    await p.propagar();

    p.http.expectNone(ESCRITA);
    expect(document.activeElement).toBe(p.campo('antecessoraCodigo'));
    expect(p.campo('antecessoraCodigo').getAttribute('aria-invalid')).toBe('true');
    expect(erroDaSucessora()).toBe('Campo obrigatório.');
  });
});
