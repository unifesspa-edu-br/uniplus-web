import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  Pagina,
  corpoDaFalha,
  criado,
  decreto,
  montarPagina,
  portaria,
  problema,
  recusaDeCampo,
  verificarErroDeMunicipioObrigatorio,
} from './base-legal-bonus-regional.testing';

const PROCESSANDO = { code: 'uniplus.idempotency.processing_conflict', title: 'Em processamento' };
const CORPO_DIVERGENTE = {
  code: 'uniplus.idempotency.body_mismatch',
  title: 'Corpo divergente da chave',
};
const NAO_ENCONTRADA = {
  code: 'uniplus.configuracao.base_legal_bonus_regional.nao_encontrado',
  title: 'Base legal de bônus regional não encontrada',
};
const MENSAGEM_DE_LIMITE = /tamanho permitido|no máximo \d+ caracteres/;

describe('BaseLegalBonusRegionalPage — recusas e validação', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina([portaria, decreto]);
  });
  afterEach(() => p.http.verify());

  const chaveDe = (req: { request: { headers: { get(n: string): string | null } } }) =>
    req.request.headers.get('Idempotency-Key');
  const alertaDoDrawer = (): HTMLElement => p.elemento('ui-drawer ui-alert');
  const mensagemDe = (nome: string): string | undefined =>
    p.campo(nome).closest('.field')?.querySelector('.field__error')?.textContent?.trim();
  const tentarEnviar = async (): Promise<void> => {
    p.salvar().focus();
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
    await p.propagar();
    await p.propagar();
  };

  describe('formulário', () => {
    it('identifica como obrigatórios para tecnologias assistivas o tipo, a identificação, a descrição e os municípios', async () => {
      await p.abrirCadastro();

      for (const controle of [
        p.campo('tipoInstrumento'),
        p.campo('identificacao'),
        p.campo('descricao'),
        p.buscaDeMunicipio(),
      ]) {
        expect(controle.getAttribute('aria-required')).toBe('true');
      }
    });

    it('mostra o aviso de limite em cada campo de texto acima do que o servidor aceita', async () => {
      await p.abrirCadastro();
      p.preencher('identificacao', 'x'.repeat(501));
      p.preencher('descricao', 'x'.repeat(2001));
      await tentarEnviar();

      p.http.expectNone(ESCRITA);
      expect(mensagemDe('identificacao')).toMatch(MENSAGEM_DE_LIMITE);
      expect(mensagemDe('descricao')).toMatch(MENSAGEM_DE_LIMITE);
    });

    it('aceita exatamente o limite de cada campo de texto', async () => {
      await p.abrirCadastro();
      p.preencher('identificacao', 'x'.repeat(500));
      p.preencher('descricao', 'x'.repeat(2000));
      const post = await p.enviar();

      expect(post.request.body).toMatchObject({
        identificacao: 'x'.repeat(500),
        descricao: 'x'.repeat(2000),
      });
      post.flush(...criado());
      await p.recarregarCom([portaria]);
    });

    it.each([
      ['identificacao', '   '],
      ['descricao', '   '],
    ])(
      '%s só com espaços é recusada como obrigatória antes de ir ao servidor',
      async (nome, valor) => {
        await p.abrirCadastro();
        p.preencher(nome, valor);
        await tentarEnviar();

        p.http.expectNone(ESCRITA);
        expect(mensagemDe(nome)).toBe('Campo obrigatório.');
      },
    );

    it.each(['identificacao', 'descricao'])(
      '%s curta demais, depois de aparada, é recusada com o mínimo exigido',
      async (nome) => {
        await p.abrirCadastro();
        p.preencher(nome, '  ab  ');
        await tentarEnviar();

        p.http.expectNone(ESCRITA);
        expect(mensagemDe(nome)).toBe('Informe ao menos 3 caracteres.');
      },
    );

    it('o tipo de instrumento é obrigatório', async () => {
      await p.abrirCadastro();
      p.preencher('tipoInstrumento', '');
      await tentarEnviar();

      p.http.expectNone(ESCRITA);
      expect(mensagemDe('tipoInstrumento')).toBe('Campo obrigatório.');
    });

    it('envio barrado localmente leva o foco ao primeiro campo inválido', async () => {
      await p.abrirCadastro();
      p.preencher('identificacao', '');
      p.preencher('descricao', '');
      await tentarEnviar();

      p.http.expectNone(ESCRITA);
      expect(document.activeElement).toBe(p.campo('identificacao'));
      expect(p.campo('identificacao').getAttribute('aria-invalid')).toBe('true');
      expect(p.campo('descricao').getAttribute('aria-invalid')).toBe('true');
    });

    const verificarEnvioSemMunicipio = async () => {
      await p.abrirCadastro();
      p.elemento<HTMLButtonElement>('button[aria-label="Remover Marabá"]').click();
      await p.propagar();
      await tentarEnviar();

      p.http.expectNone(ESCRITA);
      verificarErroDeMunicipioObrigatorio(p);
    };

    it(
      'sem nenhum município, o envio é barrado, a falta é apontada e o foco vai à busca',
      verificarEnvioSemMunicipio,
    );

    const verificarFormularioReaberto = () => {
      expect(p.campo('descricao').getAttribute('aria-invalid')).toBeNull();
      expect(p.fixture.nativeElement.querySelector('ui-drawer ui-alert')).toBeNull();
      expect(p.fixture.nativeElement.querySelector('.cfg-municipio-selecionados')).toBeNull();
      expect(p.elemento('cfg-campo-de-municipios').textContent).toContain(
        'Nenhum município adicionado ainda.',
      );
    };

    const verificarReabertura = async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo('descricao', 'Descrição recusada.'));
      await p.propagar();
      p.edicao.fechar();
      await p.propagar();

      p.edicao.abrirCadastro();
      await p.propagar();
      verificarFormularioReaberto();
    };

    it('reabrir o formulário não herda a recusa nem o foco da vez anterior', verificarReabertura);
  });

  describe('ao salvar', () => {
    const verificarRecusaDoCampo = async (campo: string) => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo(campo, 'Valor recusado.'));
      await p.propagar();
      await p.propagar();

      const controle = p.campo(campo);
      expect(controle.getAttribute('aria-invalid')).toBe('true');
      expect(controle.closest('.field')?.classList.contains('is-error')).toBe(true);
      expect(mensagemDe(campo)).toBe('Valor recusado.');
      expect(controle.getAttribute('aria-describedby')).toContain('-erro');
      expect(document.activeElement).toBe(controle);
      expect(p.elemento('ui-drawer [role="status"]').textContent).toContain('Revise os campos');
      expect(p.erros).not.toHaveBeenCalled();
    };

    it.each(['tipoInstrumento', 'identificacao', 'descricao'] as const)(
      'mostra a recusa de %s no campo e o foca',
      verificarRecusaDoCampo,
    );

    const conferirRecusaDosMunicipios = () => {
      expect(p.elemento('#cfg-blbr-municipios-erro').textContent?.trim()).toBe(
        'Município inválido.',
      );
      expect(p.buscaDeMunicipio().getAttribute('aria-invalid')).toBe('true');
      expect(p.buscaDeMunicipio().getAttribute('aria-describedby')).toContain(
        'cfg-blbr-municipios-erro',
      );
      expect(document.activeElement).toBe(p.buscaDeMunicipio());
      expect(p.erros).not.toHaveBeenCalled();
    };

    const verificarRecusaDosMunicipios = async (campo: string) => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo(campo, 'Município inválido.'));
      await p.propagar();
      await p.propagar();

      conferirRecusaDosMunicipios();
    };

    it.each(['municipios', 'municipios[0]'])(
      'a recusa de %s aparece junto da busca de município, que é marcada e focada',
      verificarRecusaDosMunicipios,
    );

    const escolherOutroMunicipio = () => {
      p.escolherMunicipios(
        { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
        { codigoIbge: '1503606', nome: 'Itupiranga', uf: 'PA' },
      );
    };

    const verificarCorrecaoDosMunicipios = async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo('municipios', 'Município inválido.'));
      await p.propagar();

      escolherOutroMunicipio();
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('#cfg-blbr-municipios-erro')).toBeNull();
    };

    it('a recusa dos municípios some ao escolher outro município', verificarCorrecaoDosMunicipios);

    it('a recusa dos municípios some no reenvio, mesmo que ele falhe por outro motivo', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo('municipios', 'Município inválido.'));
      await p.propagar();
      expect(p.fixture.nativeElement.querySelector('#cfg-blbr-municipios-erro')).not.toBeNull();

      (await p.enviar()).flush(...problema(500, corpoDaFalha(500)));
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('#cfg-blbr-municipios-erro')).toBeNull();
    });

    const corrigirIdentificacaoRecusada = async () => {
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(...recusaDeCampo('identificacao', 'Identificação longa.'));
      await p.propagar();
      await p.propagar();
      p.preencher('identificacao', 'Portaria revisada');
      return chave;
    };

    const verificarReenvioCorrigido = async () => {
      await p.abrirCadastro();
      const chave = await corrigirIdentificacaoRecusada();

      const segunda = await p.enviar();
      expect(chaveDe(segunda)).not.toBe(chave);
      segunda.flush(...criado());
      await p.recarregarCom([portaria]);

      expect(p.edicao.aberto()).toBe(false);
      expect(document.activeElement).toBe(p.novo());
    };

    it(
      'reenviar depois de recusa corrigida emite o POST com chave nova, fecha e devolve o foco',
      verificarReenvioCorrigido,
    );

    it('a recusa de um campo não impede reenviar sem alterá-lo, pois só a validação local barra', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo('descricao', 'Descrição recusada.'));
      await p.propagar();
      await p.propagar();

      const segunda = await p.enviar();
      expect(segunda.request.method).toBe('POST');
      segunda.flush(...criado());
      await p.recarregarCom([portaria]);
    });

    const recusarDescricao = async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo('descricao', 'Descrição recusada.'));
      await p.propagar();
      await p.propagar();
    };

    const verificarEmissoesNoReenvio = async () => {
      await recusarDescricao();
      let emissoes = 0;
      const inscricoes = [
        p.edicao.form.valueChanges.subscribe(() => emissoes++),
        p.edicao.form.controls.descricao.valueChanges.subscribe(() => emissoes++),
      ];

      const segunda = await p.enviar();
      inscricoes.forEach((inscricao) => inscricao.unsubscribe());
      expect(emissoes).toBe(0);
      segunda.flush(...criado());
      await p.recarregarCom([portaria]);
    };

    it(
      'descartar a recusa do servidor no reenvio não emite valueChanges',
      verificarEmissoesNoReenvio,
    );

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
      await p.recarregarCom([portaria]);
    });

    it('corpo divergente da chave vai ao alerta e renova a chave', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(...problema(422, CORPO_DIVERGENTE));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain('Corpo divergente da chave');
      expect(chaveDe(await p.enviar())).not.toBe(chave);
    });

    it('422 sem campo mapeável vai ao alerta com a orientação de revisar', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo('desconhecido', 'Sem campo.'));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain('Não foi possível mapear os erros');
    });

    it('base legal não encontrada na edição vai ao alerta, sem toast', async () => {
      await p.abrirEdicao(portaria);
      (await p.enviar(`${ESCRITA}/${portaria.id}`)).flush(...problema(404, NAO_ENCONTRADA));
      await p.propagar();

      expect(alertaDoDrawer().textContent).toContain(NAO_ENCONTRADA.title);
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('falta de permissão vai ao alerta, sem toast', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...problema(403, corpoDaFalha(403)));
      await p.propagar();

      expect(alertaDoDrawer()).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('falha 5xx vai ao alerta, avisa por toast e mantém a chave para o reenvio', async () => {
      await p.abrirCadastro();
      const primeira = await p.enviar();
      const chave = chaveDe(primeira);
      primeira.flush(...problema(500, corpoDaFalha(500)));
      await p.propagar();

      expect(alertaDoDrawer()).toBeTruthy();
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(chaveDe(await p.enviar())).toBe(chave);
    });

    it('um novo envio, ainda que barrado pela validação, retira a recusa anterior da tela', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...problema(500, corpoDaFalha(500)));
      await p.propagar();
      expect(alertaDoDrawer()).toBeTruthy();

      p.preencher('identificacao', '');
      await tentarEnviar();

      expect(p.fixture.nativeElement.querySelector('ui-drawer ui-alert')).toBeNull();
      p.http.expectNone(ESCRITA);
    });
  });
});
