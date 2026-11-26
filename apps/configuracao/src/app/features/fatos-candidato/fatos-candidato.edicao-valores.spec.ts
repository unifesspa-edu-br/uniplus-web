import { afterEach, describe, expect, it, beforeAll } from 'vitest';
import {
  Pagina,
  montarPagina,
  problema,
  recusaDeCampo,
  sucesso,
  urlDoFato,
  compilarPaginaUmaVez,
} from './fatos-candidato.testing';
import {
  comValoresDeclarados,
  comValores,
  corRaca,
  emManutencao,
} from './fatos-candidato.fixtures';
import {
  campo,
  DESCRITIVO,
  botaoDoValor,
  ConducaoDoDescritivo,
} from './fatos-candidato.edicao.testing';

describe('FatosCandidatoPage — edição do fato: escrita em curso e valores', () => {
  beforeAll(compilarPaginaUmaVez);
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });
  const { salvarDescritivo, putDoFato } = new ConducaoDoDescritivo(() => p);

  describe('com a escrita em curso', () => {
    it('fechar a edição depois da recarga, com a linha fora da lista, leva o foco ao título', async () => {
      p = await montarPagina([corRaca]);
      await p.abrirEdicao(corRaca);
      await salvarDescritivo();
      putDoFato().flush(...sucesso());
      await p.propagar();
      p.http.expectOne(urlDoFato(corRaca)).flush(emManutencao(structuredClone(corRaca)));
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
      p.http.expectOne(urlDoFato(corRaca)).flush(emManutencao(structuredClone(corRaca)));
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

    it('bloqueia os campos, o botão e o fechar do drawer', async () => {
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
      p.pedidoDaLista().flush([corRaca].map(emManutencao));
      await p.propagar();
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
    const recusaDeFormato = () =>
      recusaDeCampo(
        'Codigo',
        'Formato recusado.',
        'uniplus.configuracao.fato_valor_dominio.codigo_formato_invalido',
      );

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

    it('mostra a recusa de formato no código do novo valor', async () => {
      p = await montarPagina([todos]);
      await p.abrirEdicao(todos);
      await acrescentarValor('OUTRA', 'Outra');
      p.http.expectOne(urlDosValores).flush(...recusaDeFormato());
      await p.propagar();
      expect(p.elemento(`${NOVO} ${campo('codigo')}`).getAttribute('aria-invalid')).toBe('true');
      expect(p.texto(NOVO)).toContain('Formato recusado.');
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

    it('desativar envia o pedido e leva o foco de volta ao botão da linha, rotulado "Reativar"', async () => {
      p = await montarPagina([todos]);
      await p.abrirEdicao(todos);

      await p.acionar(p.elemento(botaoDoValor('PRETA', 'acao')));
      const delete_ = p.http.expectOne(
        (r) => r.method === 'DELETE' && r.url === `${urlDosValores}/PRETA`,
      );
      delete_.flush(...sucesso());
      await p.recarregarOFato(
        comValoresDeclarados(
          todos,
          todos.definicao.valores.declarados.map((v) =>
            v.codigo === 'PRETA' ? { ...v, ativo: false } : v,
          ),
        ),
      );

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

      recarga.flush(emManutencao(structuredClone(todos)));
      p.pedidoDaLista().flush([todos].map(emManutencao));
      await p.propagar();
      expect(
        p.elemento<HTMLButtonElement>(botaoDoValor('BRANCA', 'subir')).matches(':disabled'),
      ).toBe(false);
    });
  });
});
