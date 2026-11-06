import { afterEach, describe, expect, it } from 'vitest';
import {
  Pagina,
  comValores,
  corRaca,
  montarPagina,
  problema,
  recusaDeCampo,
  sucesso,
  urlDoFato,
} from './fatos-candidato.testing';
import type { FatoCandidatoDto } from '@uniplus/shared-data/configuracao';

const campo = (nome: string): string => `[formcontrolname="${nome}"]`;
const DESCRITIVO = '#cfg-fato-descritivo';
const botaoDoValor = (codigo: string, acao: string): string => `#cfg-fato-valor-${codigo}-${acao}`;

describe('FatosCandidatoPage — edição do fato: nome, descrição e componente', () => {
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });

  const salvarDescritivo = async (): Promise<void> => {
    p.submeter(DESCRITIVO);
    await p.propagar();
  };
  const putDoFato = () =>
    p.http.expectOne((r) => r.method === 'PUT' && r.url === urlDoFato(corRaca));

  it('a edição é integral e o componente vazio vai como nulo', async () => {
    const fato = { ...corRaca, componenteExibicao: 'MOEDA' };
    p = await montarPagina([fato]);
    await p.abrirEdicao(fato);
    const select = p.elemento<HTMLSelectElement>(campo('componenteExibicao'));
    expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
      'Padrão (pelo tipo do dado)',
      'Moeda',
      'Situação',
    ]);
    expect(select.value).toBe('MOEDA');

    await salvarDescritivo();
    const mantido = putDoFato();
    expect(mantido.request.headers.has('Idempotency-Key')).toBe(true);
    expect(mantido.request.body).toEqual({
      nome: 'Cor ou raça',
      descricao: 'Cor ou raça autodeclarada.',
      componenteExibicao: 'MOEDA',
    });
    mantido.flush(...sucesso());
    await p.recarregarOFato(fato);
    expect(p.sucessos).toHaveBeenCalledTimes(1);

    p.digitar(`${DESCRITIVO} ${campo('componenteExibicao')}`, '');
    await salvarDescritivo();
    const limpo = putDoFato();
    expect(limpo.request.body).toMatchObject({ componenteExibicao: null });
    limpo.flush(...sucesso());
    await p.recarregarOFato(fato);
  });

  it('o clique no botão de salvar habilitado não é barrado e envia o formulário', async () => {
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca);
    const botao = p.botaoPeloTexto('Salvar nome, descrição e componente') as HTMLButtonElement;

    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    botao.dispatchEvent(clique);
    await p.propagar();

    expect(clique.defaultPrevented).toBe(false);
    p.submeter(DESCRITIVO);
    putDoFato().flush(...sucesso());
    await p.recarregarOFato(corRaca);
  });

  it('a descrição em branco não salva, é anunciada como obrigatória e leva o foco ao campo', async () => {
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca);
    p.digitar(`${DESCRITIVO} ${campo('descricao')}`, '   ');

    await salvarDescritivo();

    p.http.expectNone((r) => r.method === 'PUT');
    const area = p.elemento(`${DESCRITIVO} ${campo('descricao')}`);
    expect(area.getAttribute('aria-required')).toBe('true');
    expect(area.getAttribute('aria-invalid')).toBe('true');
    expect(p.texto(`#${area.getAttribute('aria-describedby')}`)).not.toBe('');
    expect(document.activeElement).toBe(area);
  });

  it('o fato sem descrição abre com o campo vazio e obrigatório, sem quebrar a validação', async () => {
    const semDescricao = { ...corRaca, descricao: null } as unknown as FatoCandidatoDto;
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca, semDescricao);

    const area = p.elemento<HTMLTextAreaElement>(`${DESCRITIVO} ${campo('descricao')}`);
    expect(area.value).toBe('');
    await salvarDescritivo();
    expect(area.getAttribute('aria-invalid')).toBe('true');
  });

  it('limita nome e descrição ao tamanho aceito pela API', async () => {
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca);
    p.digitar(`${DESCRITIVO} ${campo('nome')}`, 'a'.repeat(201));
    p.digitar(`${DESCRITIVO} ${campo('descricao')}`, 'a'.repeat(1001));

    await salvarDescritivo();

    p.http.expectNone((r) => r.method === 'PUT');
    expect(p.elemento(`${DESCRITIVO} ${campo('nome')}`).getAttribute('aria-invalid')).toBe('true');
    expect(p.elemento(`${DESCRITIVO} ${campo('descricao')}`).getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('a recusa de campo chega ao campo, com foco, e não vira toast', async () => {
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca);
    await salvarDescritivo();

    putDoFato().flush(...recusaDeCampo('nome', 'Nome já usado.'));
    await p.propagar();

    expect(p.texto('#cfg-fato-ed-nome-erro')).toBe('Nome já usado.');
    expect(p.elemento(`${DESCRITIVO} ${campo('nome')}`).getAttribute('aria-describedby')).toBe(
      'cfg-fato-ed-nome-erro',
    );
    expect(document.activeElement).toBe(p.elemento(`${DESCRITIVO} ${campo('nome')}`));
    expect(p.erros).not.toHaveBeenCalled();
  });

  it('a falha do servidor (5xx) avisa por toast e mantém a edição', async () => {
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca);
    await salvarDescritivo();

    putDoFato().flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(p.drawerDoFato().open).toBe(true);
  });

  it('o envio por Enter com a resposta 500 não duplica a escrita e devolve o foco', async () => {
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca);
    const nome = p.elemento<HTMLInputElement>(`${DESCRITIVO} ${campo('nome')}`);
    nome.focus();

    p.submeter(DESCRITIVO);
    p.submeter(DESCRITIVO);
    await p.propagar();
    const pedidos = p.http.match((r) => r.method === 'PUT' && r.url === urlDoFato(corRaca));
    expect(pedidos).toHaveLength(1);
    pedidos[0].flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(p.elemento(DESCRITIVO).contains(document.activeElement)).toBe(true);
  });

  it('o "Fechar" do rodapé fecha o drawer e devolve o foco ao Editar da linha', async () => {
    p = await montarPagina([corRaca]);
    await p.editar(corRaca).focus();
    await p.abrirEdicao(corRaca);

    await p.acionar(
      p.botaoPeloTexto('Fechar', p.elemento('.form-drawer__footer')) as HTMLButtonElement,
    );

    expect(p.drawerDoFato().open).toBe(false);
    expect(document.activeElement).toBe(p.editar(corRaca));
  });

  describe('a falha ao ler o fato', () => {
    const falharALeitura = async (): Promise<void> => {
      p = await montarPagina([corRaca]);
      await p.acionar(p.editar(corRaca));
      expect(p.texto()).toContain('Carregando o fato');
      p.http
        .expectOne(urlDoFato(corRaca))
        .flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
    };

    it('troca o formulário pelo alerta, avisa por toast e leva o foco ao alerta', async () => {
      await falharALeitura();

      expect(p.texto()).toContain('Não foi possível carregar o fato');
      expect(p.existe(DESCRITIVO)).toBe(false);
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(p.elemento('#cfg-fato-erro-de-carga'));
    });

    const tentarNovamente = (): HTMLButtonElement =>
      p.botaoPeloTexto('Tentar novamente', p.drawerDoFato()) as HTMLButtonElement;

    it('"Tentar novamente" relê o fato e, dando certo, devolve o formulário com o foco no início da edição', async () => {
      await falharALeitura();

      await p.acionar(tentarNovamente());
      p.http.expectOne(urlDoFato(corRaca)).flush(structuredClone(corRaca));
      p.atenderApoios();
      await p.propagar();

      expect(p.existe(DESCRITIVO)).toBe(true);
      expect(p.texto()).not.toContain('Não foi possível carregar o fato');
      expect(document.activeElement).toBe(p.elemento('#cfg-fato-edicao-inicio'));
    });

    it('a nova falha com a mesma recusa mantém o foco no botão, que segue na tela durante a espera', async () => {
      await falharALeitura();

      await p.acionar(tentarNovamente());
      expect(tentarNovamente().getAttribute('aria-disabled')).toBe('true');
      expect(document.activeElement).toBe(tentarNovamente());
      p.http
        .expectOne(urlDoFato(corRaca))
        .flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();

      expect(p.texto()).toContain('Não foi possível carregar o fato');
      expect(tentarNovamente().getAttribute('aria-disabled')).toBeNull();
      expect(document.activeElement).toBe(tentarNovamente());
    });

    it('a falha 4xx não vira toast', async () => {
      p = await montarPagina([corRaca]);
      await p.acionar(p.editar(corRaca));
      p.http
        .expectOne(urlDoFato(corRaca))
        .flush(...problema(404, { code: 'uniplus.configuracao.fato_candidato.nao_encontrado' }));
      await p.propagar();

      expect(p.erros).not.toHaveBeenCalled();
    });
  });

  describe('com a escrita em curso', () => {
    it('fechar a edição depois da recarga, com a linha fora da lista, leva o foco ao título', async () => {
      p = await montarPagina([corRaca]);
      await p.abrirEdicao(corRaca);
      await salvarDescritivo();
      putDoFato().flush(...sucesso());
      await p.propagar();
      p.http.expectOne(urlDoFato(corRaca)).flush(structuredClone(corRaca));
      p.pedidoDaLista().flush([]);
      p.atenderPendencias();
      await p.propagar();
      expect(p.edicao.gravando()).toBe(false);

      await p.acionar(p.botaoPeloTexto('Fechar', p.drawerDoFato()) as HTMLButtonElement);
      await p.propagar();

      expect(p.drawerDoFato().open).toBe(false);
      expect(document.activeElement).toBe(p.titulo());
    });

    it('salvar, a lista recarregando devagar e fechar: ao chegar sem a linha, o foco vai ao título', async () => {
      p = await montarPagina([corRaca]);
      await p.abrirEdicao(corRaca);
      await salvarDescritivo();
      putDoFato().flush(...sucesso());
      await p.propagar();
      p.http.expectOne(urlDoFato(corRaca)).flush(structuredClone(corRaca));
      p.atenderPendencias();
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);

      await p.acionar(p.botaoPeloTexto('Fechar', p.drawerDoFato()) as HTMLButtonElement);
      expect(p.drawerDoFato().open).toBe(false);
      p.pedidoDaLista().flush([]);
      p.atenderPendencias();
      await p.propagar();
      await p.propagar();

      expect(p.edicao.gravando()).toBe(false);
      expect(document.activeElement).toBe(p.titulo());
    });

    it('trava os campos, o botão e o fechar do drawer', async () => {
      p = await montarPagina([corRaca]);
      await p.abrirEdicao(corRaca);
      await salvarDescritivo();

      expect(p.elemento<HTMLFieldSetElement>(`${DESCRITIVO} fieldset`).matches(':disabled')).toBe(
        true,
      );
      const botao = p.botaoPeloTexto('Salvar nome, descrição e componente') as HTMLButtonElement;
      expect(botao.getAttribute('aria-busy')).toBe('true');
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      expect(
        (p.botaoPeloTexto('Fechar', p.drawerDoFato()) as HTMLButtonElement).matches(':disabled'),
      ).toBe(true);
      expect(
        p
          .drawerDoFato()
          .querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
          ?.matches(':disabled'),
      ).toBe(true);
      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      botao.dispatchEvent(clique);
      expect(clique.defaultPrevented).toBe(true);

      putDoFato().flush(...sucesso());
      await p.recarregarOFato(corRaca);
    });

    it('segue travada até a recarga do fato chegar e libera na falha de transporte da recarga', async () => {
      p = await montarPagina([corRaca]);
      await p.abrirEdicao(corRaca);
      await salvarDescritivo();
      putDoFato().flush(...sucesso());
      await p.propagar();
      const recarga = p.http.expectOne(urlDoFato(corRaca));

      expect(p.editor.bloqueado()).toBe(true);
      recarga.error(new ProgressEvent('error'));
      await p.propagar();

      expect(p.editor.bloqueado()).toBe(false);
      expect(p.texto()).toContain('Não foi possível carregar o fato');
      p.pedidoDaLista().flush([corRaca]);
      await p.propagar();
    });
  });

  describe('o fato de sistema', () => {
    const sistema = { ...corRaca, sistema: true, componenteExibicao: 'SITUACAO' };

    it('tem nome, descrição e componente editáveis, e o aviso cita os quatro itens', async () => {
      p = await montarPagina([sistema]);
      await p.abrirEdicao(sistema);

      expect(p.texto()).toContain(
        'Só o nome, a descrição, o componente de exibição e a proteção de dados podem ser alterados',
      );
      expect(p.elemento<HTMLSelectElement>(campo('componenteExibicao')).disabled).toBe(false);
      expect(p.elemento<HTMLTextAreaElement>(`${DESCRITIVO} ${campo('descricao')}`).readOnly).toBe(
        false,
      );
      expect(p.texto('.cfg-fato-definicao')).toContain('Situação');
    });

    it('mostra os valores só para leitura', async () => {
      p = await montarPagina([sistema]);
      await p.abrirEdicao(sistema);

      expect(p.texto()).toContain('PRETA');
      expect(p.texto()).not.toContain('Acrescentar valor');
      expect(p.existe('[id$="-acao"]')).toBe(false);
    });

    it('mostra o rótulo do padrão quando não há componente declarado', async () => {
      const padrao = { ...sistema, componenteExibicao: null };
      p = await montarPagina([padrao]);
      await p.abrirEdicao(padrao);

      expect(p.texto('.cfg-fato-definicao')).toContain(
        'Componente de exibiçãoPadrão (pelo tipo do dado)',
      );
    });
  });

  describe('valores do fato declarado', () => {
    const todos = comValores();
    const NOVO = '#cfg-fato-novo-valor';
    const acrescentarValor = async (
      codigo: string,
      descricao: string,
      orientacao = '',
    ): Promise<void> => {
      p.digitar(`${NOVO} ${campo('codigo')}`, codigo);
      p.digitar(`${NOVO} ${campo('descricao')}`, descricao);
      p.digitar(`${NOVO} ${campo('orientacao')}`, orientacao);
      p.submeter(NOVO);
      await p.propagar();
    };
    const urlDosValores = `${urlDoFato(todos)}/valores`;

    it('oferece acrescentar e desativar no fato do administrador', async () => {
      p = await montarPagina([todos]);
      await p.abrirEdicao(todos);

      expect(p.texto()).not.toContain('Fato de sistema');
      expect(p.texto()).toContain('Acrescentar valor');
      expect(p.existe(botaoDoValor('PRETA', 'acao'))).toBe(true);
    });

    it('o valor acrescentado leva a orientação sem as pontas, e em branco vai nula', async () => {
      p = await montarPagina([todos]);
      await p.abrirEdicao(todos);

      await acrescentarValor('MESTICA', 'Mestiça', '  Passa pela heteroidentificação.  ');
      const primeiro = p.http.expectOne(urlDosValores);
      expect(primeiro.request.headers.has('Idempotency-Key')).toBe(true);
      expect(primeiro.request.body).toMatchObject({
        codigo: 'MESTICA',
        orientacao: 'Passa pela heteroidentificação.',
      });
      primeiro.flush(...sucesso());
      await p.recarregarOFato(todos);

      await acrescentarValor('OUTRA', 'Outra', '   ');
      const segundo = p.http.expectOne(urlDosValores);
      expect(segundo.request.body).toMatchObject({ orientacao: null });
      segundo.flush(...sucesso());
      await p.recarregarOFato(todos);
    });

    it('limita código, descrição e orientação do valor novo ao tamanho aceito', async () => {
      p = await montarPagina([todos]);
      await p.abrirEdicao(todos);

      await acrescentarValor('A'.repeat(51), 'd'.repeat(501), 'o'.repeat(501));

      p.http.expectNone(urlDosValores);
      for (const nome of ['codigo', 'descricao', 'orientacao']) {
        expect(p.elemento(`${NOVO} ${campo(nome)}`).getAttribute('aria-invalid'), nome).toBe(
          'true',
        );
      }
    });

    it('o código do valor repetido (409) mostra a mensagem da API e não recarrega', async () => {
      p = await montarPagina([todos]);
      await p.abrirEdicao(todos);
      await acrescentarValor('PRETA', 'Preta');

      p.http.expectOne(urlDosValores).flush(
        ...problema(409, {
          code: 'uniplus.configuracao.fato_candidato.codigo_ja_existe',
          title: 'O código já existe.',
        }),
      );
      await p.propagar();

      expect(p.texto()).toContain('Não foi possível salvar');
      expect(p.texto()).not.toContain('Outra pessoa alterou');
      p.http.expectNone(urlDoFato(todos));
    });

    it('desativar envia o pedido e leva o foco de volta ao botão da linha, agora "Reativar"', async () => {
      p = await montarPagina([todos]);
      await p.abrirEdicao(todos);

      await p.acionar(p.elemento(botaoDoValor('PRETA', 'acao')));
      const delete_ = p.http.expectOne(
        (r) => r.method === 'DELETE' && r.url === `${urlDosValores}/PRETA`,
      );
      delete_.flush(...sucesso());
      await p.recarregarOFato({
        ...todos,
        valores: todos.valores.map((v) => (v.codigo === 'PRETA' ? { ...v, ativo: false } : v)),
      });

      expect(document.activeElement?.id).toBe('cfg-fato-valor-PRETA-acao');
      expect(document.activeElement?.textContent).toContain('Reativar');
    });

    it('o valor desativado se reativa com chave de idempotência, e o foco volta ao botão da linha', async () => {
      p = await montarPagina([todos]);
      await p.abrirEdicao(todos);
      const reativar = p.elemento(botaoDoValor('PARDA', 'acao'));
      expect(reativar.textContent).toContain('Reativar');

      await p.acionar(reativar);
      const post = p.http.expectOne(`${urlDosValores}/PARDA/ativacao`);
      expect(post.request.method).toBe('POST');
      expect(post.request.headers.has('Idempotency-Key')).toBe(true);
      post.flush(...sucesso());
      await p.recarregarOFato(todos);

      expect(document.activeElement?.id).toBe('cfg-fato-valor-PARDA-acao');
    });

    it('acrescentar e mover ficam bloqueados até o fato recarregado chegar', async () => {
      p = await montarPagina([todos]);
      await p.abrirEdicao(todos);
      await p.acionar(p.elemento(botaoDoValor('BRANCA', 'subir')));
      p.http.expectOne(`${urlDoFato(todos)}/ordem-dos-valores`).flush(...sucesso());
      await p.propagar();
      const recarga = p.http.expectOne(urlDoFato(todos));

      expect(
        p.elemento<HTMLButtonElement>(botaoDoValor('BRANCA', 'subir')).matches(':disabled'),
      ).toBe(true);
      expect(p.botaoPeloTexto('Acrescentar valor')?.getAttribute('aria-disabled')).toBe('true');
      p.submeter('#cfg-fato-novo-valor');
      p.http.expectNone(`${urlDoFato(todos)}/valores`);
      p.elemento<HTMLButtonElement>(botaoDoValor('BRANCA', 'subir')).click();
      p.http.expectNone(`${urlDoFato(todos)}/ordem-dos-valores`);

      recarga.flush(structuredClone(todos));
      p.pedidoDaLista().flush([todos]);
      await p.propagar();
      expect(
        p.elemento<HTMLButtonElement>(botaoDoValor('BRANCA', 'subir')).matches(':disabled'),
      ).toBe(false);
    });
  });
});
