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

const todos = comValores();
const URL_FATO = urlDoFato(todos);
const botao = (codigo: string, acao: string): string => `#cfg-fato-valor-${codigo}-${acao}`;
const formDo = (codigo: string): string => `#cfg-fato-valor-${codigo}-form`;
const campoDoValor = (codigo: string, campo: string): string =>
  `${formDo(codigo)} [formcontrolname="${campo}"]`;

describe('FatosCandidatoPage — correção e ordem dos valores', () => {
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });

  const abrir = async (fato = todos): Promise<void> => {
    p = await montarPagina([fato]);
    await p.abrirEdicao(fato);
  };
  const cliqueNo = (codigo: string, acao: string) => p.acionar(p.elemento(botao(codigo, acao)));
  const corrigir = async (codigo: string, descricao: string, orientacao = ''): Promise<void> => {
    await cliqueNo(codigo, 'editar');
    p.digitar(campoDoValor(codigo, 'descricao'), descricao);
    p.digitar(campoDoValor(codigo, 'orientacao'), orientacao);
    p.submeter(formDo(codigo));
    await p.propagar();
  };
  const cancelarEdicao = (): Promise<void> =>
    p.acionar(
      [...p.drawerDoFato().querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent?.trim().startsWith('Cancelar'),
      ) as HTMLButtonElement,
    );
  const desabilitado = (seletor: string): boolean =>
    p.elemento<HTMLButtonElement>(seletor).matches(':disabled');

  describe('corrigir a descrição e a orientação', () => {
    it('envia sem as pontas, com chave, e a recusa de campo vai ao campo da linha', async () => {
      await abrir();
      await corrigir('PRETA', '  Preta (autodeclarada)  ', '   ');

      const put = p.http.expectOne(`${URL_FATO}/valores/PRETA`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.headers.has('Idempotency-Key')).toBe(true);
      expect(put.request.body).toEqual({ descricao: 'Preta (autodeclarada)', orientacao: null });
      put.flush(...recusaDeCampo('Descricao', 'Descrição acima do limite.'));
      await p.propagar();

      expect(p.texto('#cfg-fato-valor-PRETA-descricao-erro')).toContain(
        'Descrição acima do limite.',
      );
      expect(document.activeElement).toBe(p.elemento(campoDoValor('PRETA', 'descricao')));
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('abrir a edição leva o foco ao campo da descrição', async () => {
      await abrir();
      await cliqueNo('PRETA', 'editar');

      expect(document.activeElement).toBe(p.elemento('#cfg-fato-valor-PRETA-descricao'));
    });

    it('a descrição só com espaços no fato declarado é barrada como vazia, sem enviar', async () => {
      await abrir();
      await cliqueNo('PRETA', 'editar');
      p.digitar(campoDoValor('PRETA', 'descricao'), '   ');
      p.submeter(formDo('PRETA'));
      await p.propagar();

      p.http.expectNone(`${URL_FATO}/valores/PRETA`);
      expect(p.texto('#cfg-fato-valor-PRETA-descricao-erro')).toContain('Campo obrigatório.');
      expect(document.activeElement).toBe(p.elemento(campoDoValor('PRETA', 'descricao')));
    });

    it('limita descrição e orientação do valor ao tamanho aceito', async () => {
      await abrir();
      await cliqueNo('PRETA', 'editar');
      p.digitar(campoDoValor('PRETA', 'descricao'), 'd'.repeat(501));
      p.digitar(campoDoValor('PRETA', 'orientacao'), 'o'.repeat(501));
      p.submeter(formDo('PRETA'));
      await p.propagar();

      p.http.expectNone(`${URL_FATO}/valores/PRETA`);
      expect(p.elemento(campoDoValor('PRETA', 'descricao')).getAttribute('aria-invalid')).toBe(
        'true',
      );
      expect(p.elemento(campoDoValor('PRETA', 'orientacao')).getAttribute('aria-invalid')).toBe(
        'true',
      );
    });

    it('cancelar a edição limpa o erro da tentativa anterior e devolve o foco ao Editar', async () => {
      await abrir();
      await corrigir('PRETA', 'Preta 2');
      p.http.expectOne(`${URL_FATO}/valores/PRETA`).flush(
        ...problema(409, {
          code: 'uniplus.configuracao.fato_candidato.codigo_ja_existe',
          title: 'Repetido.',
        }),
      );
      await p.propagar();
      expect(p.texto()).toContain('Não foi possível salvar');

      await cancelarEdicao();

      expect(p.texto()).not.toContain('Não foi possível salvar');
      expect(p.existe(formDo('PRETA'))).toBe(false);
      expect(document.activeElement).toBe(p.elemento(botao('PRETA', 'editar')));
    });

    it('com um valor em edição, Desativar, Reativar, os outros Editar e o mover ficam bloqueados', async () => {
      await abrir();
      await cliqueNo('PRETA', 'editar');

      for (const acao of p.raiz().querySelectorAll<HTMLButtonElement>('[id$="-acao"]')) {
        expect(acao.matches(':disabled'), acao.id).toBe(true);
        acao.click();
      }
      expect(desabilitado(botao('BRANCA', 'editar'))).toBe(true);
      expect(desabilitado(botao('BRANCA', 'subir'))).toBe(true);
      p.http.expectNone((r) => r.url.includes('/valores/BRANCA'));
    });
  });

  describe('subir e descer', () => {
    it('envia a lista completa, desativados inclusive, com o valor trocado de lugar', async () => {
      await abrir();
      expect(desabilitado(botao('PRETA', 'subir'))).toBe(true);
      expect(desabilitado(botao('BRANCA', 'descer'))).toBe(true);

      await cliqueNo('BRANCA', 'subir');
      const put = p.http.expectOne(`${URL_FATO}/ordem-dos-valores`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.headers.has('Idempotency-Key')).toBe(true);
      expect(put.request.body).toEqual({ codigos: ['PRETA', 'BRANCA', 'PARDA'] });
      put.flush(...sucesso());
      await p.recarregarOFato(todos);
    });

    it('o botão cita o valor no nome acessível, e o foco segue o valor depois da recarga', async () => {
      await abrir();
      expect(p.elemento(botao('BRANCA', 'subir')).textContent).toContain('Subir o valor BRANCA');

      await cliqueNo('PARDA', 'descer');
      p.http.expectOne(`${URL_FATO}/ordem-dos-valores`).flush(...sucesso());
      await p.recarregarOFato({
        ...todos,
        valores: [todos.valores[0], todos.valores[2], todos.valores[1]],
      });

      expect(document.activeElement?.id).toBe('cfg-fato-valor-PARDA-subir');
    });

    it('a ordem seguinte parte da lista nova, não da que estava na tela', async () => {
      await abrir();
      await cliqueNo('BRANCA', 'subir');
      p.http.expectOne(`${URL_FATO}/ordem-dos-valores`).flush(...sucesso());
      await p.propagar();
      const recarga = p.http.expectOne(URL_FATO);
      expect(desabilitado(botao('BRANCA', 'subir'))).toBe(true);
      p.elemento<HTMLButtonElement>(botao('BRANCA', 'subir')).click();
      p.http.expectNone(`${URL_FATO}/ordem-dos-valores`);

      recarga.flush({ ...todos, valores: [todos.valores[0], todos.valores[2], todos.valores[1]] });
      p.pedidoDaLista().flush([todos]);
      await p.propagar();
      p.atenderPendencias();

      expect(desabilitado(botao('BRANCA', 'subir'))).toBe(false);
    });
  });

  describe('os valores que não se mantêm', () => {
    it.each([
      ['de sistema', { sistema: true }],
      ['do agregado, que os herda', { binding: 'AGREGACAO_GRUPO:GRUPO.CAMPO' }],
    ])('o fato %s mostra os valores sem Editar, Subir nem Descer', async (_nome, variacao) => {
      await abrir({ ...todos, ...variacao });

      expect(p.texto()).toContain('BRANCA');
      for (const texto of ['Editar', 'Subir', 'Descer'])
        expect(p.texto('dialog[aria-label="Fato do candidato"] table')).not.toContain(texto);
    });
  });

  describe('os 409 da escrita do valor', () => {
    it('a perda de concorrência recarrega o fato, fecha a edição e devolve o foco ao Editar', async () => {
      await abrir();
      await cliqueNo('PRETA', 'editar');
      p.submeter(formDo('PRETA'));
      await p.propagar();

      p.http
        .expectOne(`${URL_FATO}/valores/PRETA`)
        .flush(...problema(409, { code: 'uniplus.concorrencia.conflito' }));
      await p.propagar();
      expect(p.texto()).toContain('Outra pessoa alterou este fato');
      expect(p.existe(formDo('PRETA'))).toBe(false);
      await p.recarregarOFato(todos, false);

      expect(document.activeElement).toBe(p.elemento(botao('PRETA', 'editar')));
    });

    it('o conflito de concorrência do fato tem o mesmo desfecho', async () => {
      await abrir();
      await cliqueNo('BRANCA', 'subir');
      p.http.expectOne(`${URL_FATO}/ordem-dos-valores`).flush(
        ...problema(409, {
          code: 'uniplus.configuracao.fato_candidato.conflito_de_concorrencia',
        }),
      );
      await p.propagar();

      expect(p.texto()).toContain('Outra pessoa alterou este fato');
      await p.recarregarOFato(todos, false);
    });

    it('o 409 de idempotência em processamento mostra a mensagem da API, sem recarregar nem falar em outra pessoa', async () => {
      await abrir();
      await cliqueNo('BRANCA', 'subir');

      p.http.expectOne(`${URL_FATO}/ordem-dos-valores`).flush(
        ...problema(409, {
          code: 'uniplus.idempotency.processing_conflict',
          title: 'Em processamento.',
        }),
      );
      await p.propagar();

      expect(p.texto()).not.toContain('Outra pessoa alterou');
      expect(p.texto()).toContain('Não foi possível salvar');
      p.http.expectNone(URL_FATO);
    });

    it('um 409 que não é de concorrência mantém a edição aberta, sem recarregar', async () => {
      await abrir();
      await cliqueNo('PRETA', 'editar');
      p.submeter(formDo('PRETA'));
      await p.propagar();

      p.http
        .expectOne(`${URL_FATO}/valores/PRETA`)
        .flush(...problema(409, { code: 'uniplus.configuracao.fato_candidato.codigo_ja_existe' }));
      await p.propagar();

      expect(p.texto()).not.toContain('Outra pessoa alterou');
      expect(p.existe(formDo('PRETA'))).toBe(true);
      p.http.expectNone(URL_FATO);
    });
  });

  describe('as chaves de idempotência da correção', () => {
    it('repete na mesma tentativa e muda com o corpo e com o alvo, depois de um 5xx', async () => {
      await abrir();
      const falhar = async (codigo: string): Promise<string | null> => {
        const req = p.http.expectOne(`${URL_FATO}/valores/${codigo}`);
        const chave = req.request.headers.get('Idempotency-Key');
        req.flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
        await p.propagar();
        return chave;
      };
      await corrigir('PRETA', 'Preta 1');
      const primeira = await falhar('PRETA');

      p.submeter(formDo('PRETA'));
      await p.propagar();
      expect(await falhar('PRETA')).toBe(primeira);

      p.digitar(campoDoValor('PRETA', 'descricao'), 'Preta 2');
      p.submeter(formDo('PRETA'));
      await p.propagar();
      const outroCorpo = await falhar('PRETA');
      expect(outroCorpo).not.toBe(primeira);

      await cancelarEdicao();
      await corrigir('BRANCA', 'Preta 2');
      expect(await falhar('BRANCA')).not.toBe(outroCorpo);
    });
  });

  describe('o bloqueio durante a escrita', () => {
    it('trava os campos e os botões da linha, e o segundo clique não envia', async () => {
      await abrir();
      await corrigir('PRETA', 'Preta 2');

      expect(
        p.elemento<HTMLFieldSetElement>(`${formDo('PRETA')} fieldset`).matches(':disabled'),
      ).toBe(true);
      const enviar = p.elemento<HTMLButtonElement>(
        'button[type="submit"][form="cfg-fato-valor-PRETA-form"]',
      );
      expect(enviar.getAttribute('aria-busy')).toBe('true');
      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      enviar.dispatchEvent(clique);
      expect(clique.defaultPrevented).toBe(true);
      expect(desabilitado(botao('BRANCA', 'subir'))).toBe(true);
      const enviados = p.http.match(`${URL_FATO}/valores/PRETA`);
      expect(enviados).toHaveLength(1);
      enviados[0].flush(...sucesso());
      await p.recarregarOFato(todos);
    });

    it('a recarga que termina em erro de transporte libera o bloqueio', async () => {
      await abrir();
      await cliqueNo('BRANCA', 'subir');
      p.http.expectOne(`${URL_FATO}/ordem-dos-valores`).flush(...sucesso());
      await p.propagar();
      expect(p.editor.bloqueado()).toBe(true);

      p.http.expectOne(URL_FATO).error(new ProgressEvent('error'));
      await p.propagar();

      expect(p.editor.bloqueado()).toBe(false);
      p.pedidoDaLista().flush([corRaca]);
      await p.propagar();
    });

    it('trocar de fato fecha a edição do valor do anterior', async () => {
      const outro = { ...todos, id: 'outro-fato', codigo: 'OUTRO', nome: 'Outro' };
      p = await montarPagina([todos, outro]);
      await p.abrirEdicao(todos);
      await cliqueNo('PRETA', 'editar');
      expect(p.existe(formDo('PRETA'))).toBe(true);

      p.edicao.abrirEdicao(outro.id);
      await p.propagar();
      p.http.expectOne(urlDoFato(outro)).flush(structuredClone(outro));
      p.atenderApoios();
      await p.propagar();

      expect(p.existe(formDo('PRETA'))).toBe(false);
    });
  });

  it('a falha do servidor (5xx) ao mover avisa por toast e libera o bloqueio', async () => {
    await abrir();
    await cliqueNo('BRANCA', 'subir');

    p.http
      .expectOne(`${URL_FATO}/ordem-dos-valores`)
      .flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(p.editor.bloqueado()).toBe(false);
  });
});
