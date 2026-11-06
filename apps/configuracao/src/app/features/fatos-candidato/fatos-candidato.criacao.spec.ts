import type { TestRequest } from '@angular/common/http/testing';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LISTA,
  Pagina,
  criado,
  montarPagina,
  problema,
  quilombola,
  recusaDeCampo,
  trabalha,
} from './fatos-candidato.testing';

const campo = (nome: string): string => `[formcontrolname="${nome}"]`;
const CRIACAO = '#cfg-fato-criacao';

const PREENCHIMENTO_DO_DERIVADO: Record<string, string> = {
  nome: 'Perfil socioeconômico',
  descricao: 'Perfil que define a reserva de vagas.',
  codigo: 'PERFIL',
  dominio: 'BOOLEANO',
  pontoResolucao: 'INSCRICAO',
  classificacaoProtecao: 'PESSOAL',
  finalidadeTratamento: 'Classificar a reserva de vagas.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
};

describe('FatosCandidatoPage — criação do fato', () => {
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });

  const preencher = (valores: Record<string, string>): void => {
    for (const [nome, valor] of Object.entries(valores)) p.digitar(campo(nome), valor);
  };
  const escolherTipo = async (tipo: string): Promise<void> => {
    await p.acionar(p.elemento(`input[type="radio"][value="${tipo}"]`));
    p.atenderApoios();
    await p.propagar();
  };
  /** O fato criado segue no drawer, agora em edição: a lista e o próprio fato são relidos. */
  const entregar = async (pedido: TestRequest): Promise<void> => {
    pedido.flush(...criado());
    await p.propagar();
    p.pedidoDaLista().flush([]);
    p.atenderPendencias();
    p.http.expectOne(`${LISTA}/novo-id`).flush({ ...trabalha, id: 'novo-id', codigo: 'PERFIL' });
    await p.propagar();
  };
  const criar = async (): Promise<void> => {
    p.submeter(CRIACAO);
    await p.propagar();
  };
  const abrirDerivado = async (): Promise<void> => {
    await p.abrirCriacao();
    await escolherTipo('DERIVADO');
    preencher(PREENCHIMENTO_DO_DERIVADO);
    await p.propagar();
  };

  it('"Novo fato" abre o drawer de criação com as três opções num só grupo de rádio', async () => {
    p = await montarPagina([]);

    await p.abrirCriacao();

    expect(p.drawerDoFato().open).toBe(true);
    const radios = [
      ...p.raiz().querySelectorAll<HTMLInputElement>('input[type="radio"][formcontrolname="tipo"]'),
    ];
    expect(radios.map((r) => r.value)).toEqual(['DECLARADO', 'DERIVADO', 'AGREGADO']);
    expect(radios.map((r) => r.name)).toEqual(['tipo', 'tipo', 'tipo']);
    expect(p.edicao.modo()).toBe('criar');
  });

  it('sem a lista de fases, avisa e oferece tentar de novo em vez de um campo vazio', async () => {
    p = await montarPagina([]);
    await p.acionar(p.novo());
    for (const req of p.http.match((r) => r.url.endsWith('/fases-canonicas'))) {
      req.flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    }
    await p.propagar();

    expect(p.texto()).toContain('Fases não carregadas');
    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(p.elemento<HTMLSelectElement>('#cfg-fato-pontoResolucao').options).toHaveLength(1);

    const tentar = p.botaoPeloTexto('Tentar novamente') as HTMLButtonElement;
    await p.acionar(tentar);
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(tentar);
    p.atenderApoios();
    await p.propagar();
    await p.propagar();
    expect(p.texto()).not.toContain('Fases não carregadas');
    expect(document.activeElement).toBe(p.elemento('#cfg-fato-pontoResolucao'));
  });

  it('o catálogo só é pedido ao escolher o agregado', async () => {
    p = await montarPagina([]);
    await p.abrirCriacao();
    p.http.expectNone((r) => r.url.endsWith('/api/configuracao/fatos-candidato'));

    await p.acionar(p.elemento('input[type="radio"][value="AGREGADO"]'));

    p.http.expectOne((r) => r.url.endsWith('/api/configuracao/fatos-candidato')).flush([]);
    await p.propagar();
  });

  it('sem o catálogo de fatos, o aviso fica durante a nova tentativa e o foco vai ao fato de membro quando dá certo', async () => {
    p = await montarPagina([]);
    await p.abrirCriacao();
    await p.acionar(p.elemento('input[type="radio"][value="AGREGADO"]'));
    p.http
      .expectOne((r) => r.url.endsWith('/api/configuracao/fatos-candidato'))
      .flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();
    expect(p.texto()).toContain('Fatos de membro não carregados');

    const tentar = p.botaoPeloTexto('Tentar novamente') as HTMLButtonElement;
    await p.acionar(tentar);
    expect(tentar.isConnected).toBe(true);
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(tentar.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(tentar);

    p.http.expectOne((r) => r.url.endsWith('/api/configuracao/fatos-candidato')).flush([]);
    await p.propagar();
    await p.propagar();

    expect(p.texto()).not.toContain('Fatos de membro não carregados');
    expect(document.activeElement).toBe(p.elemento('#cfg-fato-fatoDeMembro'));
  });

  it('anuncia cada nova tentativa de ler as fases e o catálogo, também a segunda falha seguida', async () => {
    p = await montarPagina([]);
    await p.acionar(p.novo());
    const fasesFalham = async (): Promise<void> => {
      for (const req of p.http.match((r) => r.url.endsWith('/fases-canonicas'))) {
        req.flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
      }
      await p.propagar();
    };
    const anuncio = (): string =>
      p.elemento('cfg-fato-criacao').querySelectorAll(':scope > span.sr-only[role="status"]')[1]
        ?.textContent ?? '';
    await fasesFalham();

    for (let vez = 0; vez < 2; vez++) {
      await p.acionar(p.botaoPeloTexto('Tentar novamente') as HTMLButtonElement);
      expect(anuncio()).toBe('Lendo fases...');
      await fasesFalham();
      expect(anuncio()).toBe('Falha na leitura: fases.');
    }

    await p.acionar(p.elemento('input[type="radio"][value="AGREGADO"]'));
    const catalogoFalha = async (): Promise<void> => {
      p.http
        .expectOne((r) => r.url.endsWith('/api/configuracao/fatos-candidato'))
        .flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
    };
    await catalogoFalha();
    for (let vez = 0; vez < 2; vez++) {
      const botoes = [...p.elemento('cfg-fato-criacao').querySelectorAll('button')].filter((b) =>
        b.textContent?.includes('Tentar novamente'),
      );
      await p.acionar(botoes.at(-1) as HTMLButtonElement);
      expect(anuncio()).toBe('Lendo catálogo de fatos...');
      await catalogoFalha();
      expect(anuncio()).toBe('Falha na leitura: catálogo de fatos.');
    }
  });

  describe('o fato derivado', () => {
    it('vai à API sem cardinalidade, com o código em caixa alta e a chave de idempotência', async () => {
      p = await montarPagina([]);
      await abrirDerivado();

      await criar();

      const pedido = p.http.expectOne(`${LISTA}/derivados`);
      expect(pedido.request.method).toBe('POST');
      expect(pedido.request.headers.has('Idempotency-Key')).toBe(true);
      expect(pedido.request.body).not.toHaveProperty('cardinalidade');
      expect(pedido.request.body).toMatchObject({
        codigo: 'PERFIL',
        nome: 'Perfil socioeconômico',
        dominio: 'BOOLEANO',
        componenteExibicao: null,
      });
      await entregar(pedido);
    });

    it('envia o componente de exibição escolhido, e a recusa dele chega ao campo', async () => {
      p = await montarPagina([]);
      await abrirDerivado();
      p.digitar(campo('componenteExibicao'), 'MOEDA');

      await criar();

      const pedido = p.http.expectOne(`${LISTA}/derivados`);
      expect(pedido.request.body).toMatchObject({ componenteExibicao: 'MOEDA' });
      pedido.flush(...recusaDeCampo('ComponenteExibicao', 'Componente de exibição inválido.'));
      await p.propagar();

      expect(p.texto('#cfg-fato-componente-erro')).toBe('Componente de exibição inválido.');
      const select = p.elemento(campo('componenteExibicao'));
      expect(select.getAttribute('aria-invalid')).toBe('true');
      expect(select.getAttribute('aria-describedby')).toBe('cfg-fato-componente-erro');
      expect(p.sucessos).not.toHaveBeenCalled();
    });

    it('a recusa de validação marca o campo dela; o próximo envio é outro comando', async () => {
      p = await montarPagina([]);
      await abrirDerivado();
      await criar();
      const primeira = p.http.expectOne(`${LISTA}/derivados`);
      const chaveDaPrimeira = primeira.request.headers.get('Idempotency-Key');

      primeira.flush(...recusaDeCampo('PontoResolucao', 'Fase fora do catálogo.'));
      await p.propagar();

      expect(p.texto('#cfg-fato-pontoResolucao-erro')).toBe('Fase fora do catálogo.');
      p.digitar('#cfg-fato-pontoResolucao', 'INSCRICAO');
      await criar();
      const segunda = p.http.expectOne(`${LISTA}/derivados`);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chaveDaPrimeira);
      await entregar(segunda);
    });

    it('o código repetido (409) marca o campo do código, mantém o drawer e troca a chave', async () => {
      p = await montarPagina([]);
      await abrirDerivado();
      await criar();
      const primeira = p.http.expectOne(`${LISTA}/derivados`);
      const chave = primeira.request.headers.get('Idempotency-Key');

      primeira.flush(
        ...problema(409, {
          code: 'uniplus.configuracao.fato_candidato.codigo_ja_existe',
          title: 'O código já existe.',
        }),
      );
      await p.propagar();

      expect(p.texto('#cfg-fato-codigo-erro')).not.toBe('');
      expect(p.elemento(campo('codigo')).getAttribute('aria-invalid')).toBe('true');
      expect(p.drawerDoFato().open).toBe(true);
      expect(document.activeElement).toBe(p.elemento(campo('codigo')));
      await criar();
      const segunda = p.http.expectOne(`${LISTA}/derivados`);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      await entregar(segunda);
    });

    it('a falha do servidor (5xx) avisa por toast, deixa o rascunho e devolve o foco ao botão', async () => {
      p = await montarPagina([]);
      await abrirDerivado();
      await criar();

      p.http
        .expectOne(`${LISTA}/derivados`)
        .flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();

      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(p.drawerDoFato().open).toBe(true);
      expect((p.elemento(campo('nome')) as HTMLInputElement).value).toBe('Perfil socioeconômico');
      expect(p.texto()).toContain('Não foi possível criar o fato');
    });

    it('a recusa 403 não vira toast e mostra a mensagem no drawer', async () => {
      p = await montarPagina([]);
      await abrirDerivado();
      await criar();

      p.http
        .expectOne(`${LISTA}/derivados`)
        .flush(...problema(403, { code: 'uniplus.auth.forbidden' }));
      await p.propagar();

      expect(p.erros).not.toHaveBeenCalled();
      expect(p.texto()).toContain('Não foi possível criar o fato');
    });

    it('o botão de criar sai da tela com o sucesso: o foco vai ao início da edição quando o fato carrega', async () => {
      p = await montarPagina([]);
      await abrirDerivado();
      p.elemento('button[type="submit"][form="cfg-fato-criacao"]').focus();
      await criar();

      await entregar(p.http.expectOne(`${LISTA}/derivados`));
      await p.propagar();

      expect(document.activeElement).toBe(p.elemento('#cfg-fato-edicao-inicio'));
    });

    it('o sucesso avisa, recarrega a lista e segue no drawer, agora na edição do fato criado', async () => {
      p = await montarPagina([]);
      await abrirDerivado();
      await criar();

      await entregar(p.http.expectOne(`${LISTA}/derivados`));

      expect(p.sucessos).toHaveBeenCalledTimes(1);
      expect(p.edicao.modo()).toBe('editar');
      expect(p.drawerDoFato().open).toBe(true);
      expect(p.editor.leitura.id()).toBe('novo-id');
    });
  });

  it('o clique no botão habilitado envia o formulário, sem ser barrado', async () => {
    p = await montarPagina([]);
    await abrirDerivado();

    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    p.elemento('button[type="submit"][form="cfg-fato-criacao"]').dispatchEvent(clique);
    await p.propagar();

    expect(clique.defaultPrevented).toBe(false);
    await entregar(p.http.expectOne(`${LISTA}/derivados`));
  });

  describe('a descrição e os limites', () => {
    it('a descrição é obrigatória: em branco não envia, anuncia a obrigatoriedade e leva o foco ao campo', async () => {
      p = await montarPagina([]);
      await p.abrirCriacao();
      await escolherTipo('DERIVADO');
      preencher({ nome: 'Perfil socioeconômico', codigo: 'PERFIL', descricao: '  ' });

      await criar();

      p.http.expectNone(`${LISTA}/derivados`);
      const textarea = p.elemento(campo('descricao'));
      expect(p.texto('#cfg-fato-descricao-erro')).not.toBe('');
      expect(textarea.getAttribute('aria-required')).toBe('true');
      expect(textarea.getAttribute('aria-invalid')).toBe('true');
      expect(textarea.getAttribute('aria-describedby')).toBe('cfg-fato-descricao-erro');
    });

    it('o envio bloqueado leva o foco ao primeiro campo inválido', async () => {
      p = await montarPagina([]);
      await p.abrirCriacao();
      await escolherTipo('DERIVADO');
      preencher({ codigo: 'PERFIL' });

      await criar();

      p.http.expectNone(`${LISTA}/derivados`);
      expect(document.activeElement).toBe(p.elemento(campo('nome')));
    });

    it('limita nome, descrição e finalidade ao tamanho aceito pela API', async () => {
      p = await montarPagina([]);
      await p.abrirCriacao();
      await escolherTipo('DERIVADO');
      const excedente = (n: number): string => 'a'.repeat(n + 1);
      preencher({
        ...PREENCHIMENTO_DO_DERIVADO,
        nome: excedente(200),
        descricao: excedente(1000),
        finalidadeTratamento: excedente(500),
      });

      await criar();

      p.http.expectNone(`${LISTA}/derivados`);
      for (const nome of ['nome', 'descricao', 'finalidadeTratamento']) {
        expect(p.elemento(campo(nome)).getAttribute('aria-invalid'), nome).toBe('true');
      }
    });
  });

  it('o agregado vai à API com o fato de membro, sem tipo de dado nem escopo, e a recusa do membro chega ao campo', async () => {
    p = await montarPagina([]);
    await p.abrirCriacao();
    await p.acionar(p.elemento('input[type="radio"][value="AGREGADO"]'));
    p.http
      .expectOne((r) => r.url.endsWith('/api/configuracao/fatos-candidato'))
      .flush([
        {
          ...quilombola,
          codigo: 'MEMBRO_TRABALHA',
          nome: 'Membro trabalha',
          binding: 'CAMPO_FORMULARIO:MEMBRO_TRABALHA',
          escopo: 'MEMBRO_GRUPO',
        },
      ]);
    p.atenderApoios();
    await p.propagar();
    preencher({
      nome: 'Família com quem trabalha',
      descricao: 'Há alguém da família que trabalha.',
      codigo: 'FAMILIA_TRABALHA',
      fatoDeMembro: 'MEMBRO_TRABALHA',
      pontoResolucao: 'INSCRICAO',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Avaliar a renda familiar.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    });

    await criar();

    const pedido = p.http.expectOne(`${LISTA}/agregados`);
    expect(pedido.request.body).toEqual({
      codigo: 'FAMILIA_TRABALHA',
      nome: 'Família com quem trabalha',
      descricao: 'Há alguém da família que trabalha.',
      componenteExibicao: null,
      fatoDeMembro: 'MEMBRO_TRABALHA',
      pontoResolucao: 'INSCRICAO',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Avaliar a renda familiar.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    });
    expect(pedido.request.headers.has('Idempotency-Key')).toBe(true);
    pedido.flush(...recusaDeCampo('fatoDeMembro', 'O fato está desativado.'));
    await p.propagar();

    expect(p.texto('#cfg-fato-fatoDeMembro-erro')).toBe('O fato está desativado.');
  });

  it('o declarado vai à API com a cardinalidade, e só os domínios com lista levam a fonte de valores', async () => {
    p = await montarPagina([]);
    await p.abrirCriacao();
    await escolherTipo('DECLARADO');
    preencher({ ...PREENCHIMENTO_DO_DERIVADO, dominio: 'CATEGORICO' });
    await p.propagar();
    expect(p.existe(campo('fonteValores'))).toBe(true);
    p.digitar(campo('fonteValores'), 'GLOBAL');

    await criar();

    const pedido = p.http.expectOne(LISTA);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toMatchObject({
      cardinalidade: 'ESCALAR',
      dominio: 'CATEGORICO',
      fonteValores: 'GLOBAL',
      formato: null,
    });
    await entregar(pedido);
  });

  describe('com a gravação em curso', () => {
    const emCurso = async (): Promise<void> => {
      p = await montarPagina([]);
      await abrirDerivado();
      await criar();
    };

    it('trava o formulário, avisa o leitor de tela e não deixa fechar por Cancelar, X nem Esc', async () => {
      await emCurso();

      expect(p.elemento<HTMLFieldSetElement>('.form-drawer__campos').matches(':disabled')).toBe(
        true,
      );
      expect((p.botaoPeloTexto('Cancelar') as HTMLButtonElement).matches(':disabled')).toBe(true);
      const enviar = p.elemento('button[type="submit"][form="cfg-fato-criacao"]');
      expect(enviar.getAttribute('aria-disabled')).toBe('true');
      expect(enviar.getAttribute('aria-busy')).toBe('true');
      expect(enviar.textContent).toContain('Criando...');
      expect(p.texto('cfg-fato-criacao .sr-only[role="status"]')).toBe(
        'Criando fato do candidato.',
      );
      p.drawerDoFato().dispatchEvent(new Event('cancel', { cancelable: true }));
      await p.propagar();
      expect(p.drawerDoFato().open).toBe(true);
      expect(
        p
          .drawerDoFato()
          .querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
          ?.matches(':disabled'),
      ).toBe(true);

      await entregar(p.http.expectOne(`${LISTA}/derivados`));
    });

    it('um segundo clique ou Enter durante a gravação não envia de novo, e o foco fica no botão', async () => {
      await emCurso();
      const enviar = p.elemento<HTMLButtonElement>(
        'button[type="submit"][form="cfg-fato-criacao"]',
      );

      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      enviar.dispatchEvent(clique);
      p.submeter(CRIACAO);
      await p.propagar();

      expect(clique.defaultPrevented).toBe(true);
      const enviados = p.http.match(`${LISTA}/derivados`);
      expect(enviados).toHaveLength(1);
      expect(document.activeElement).toBe(enviar);

      await entregar(enviados[0]);
    });
  });
});
