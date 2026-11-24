import { afterEach, describe, expect, it, beforeAll } from 'vitest';
import {
  LISTA,
  Pagina,
  montarPagina,
  problema,
  recusaDeCampo,
  compilarPaginaUmaVez,
} from './fatos-candidato.testing';
import { campo, CRIACAO, ConducaoDaCriacao } from './fatos-candidato.criacao.testing';

describe('FatosCandidatoPage — criação do fato derivado', () => {
  beforeAll(compilarPaginaUmaVez);
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });
  const { entregar, criar, abrirDerivado } = new ConducaoDaCriacao(() => p);

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
        dominio: 'SIM_OU_NAO',
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

    it('a recusa 403 não aparece como toast e mostra a mensagem no drawer', async () => {
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

    it('o sucesso avisa, recarrega a lista e segue no drawer, na edição do fato criado', async () => {
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

  describe('com a gravação em curso', () => {
    const emCurso = async (): Promise<void> => {
      p = await montarPagina([]);
      await abrirDerivado();
      await criar();
    };

    it('bloqueia o formulário, avisa o leitor de tela e não deixa fechar por Cancelar, X nem Esc', async () => {
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
