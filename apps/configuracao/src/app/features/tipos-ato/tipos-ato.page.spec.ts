import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  LISTA,
  Pagina,
  aviso,
  criado,
  montarPagina,
  preliminar,
  problema,
  sucesso,
} from './tipos-ato.testing';

describe('TiposAtoPage', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina([preliminar, aviso]);
  });
  afterEach(() => p.http.verify());

  const linhaDe = (codigo: string): HTMLElement => {
    const linhas = [...p.fixture.nativeElement.querySelectorAll('tbody tr')] as HTMLElement[];
    const linha = linhas.find((item) => item.textContent?.includes(codigo));
    expect(linha, `linha de ${codigo}`).toBeTruthy();
    return linha as HTMLElement;
  };
  const celula = (linha: HTMLElement, rotulo: string): string =>
    (linha.querySelector(`[data-label="${rotulo}"]`)?.textContent ?? '').trim();

  /**
   * O padrão do servidor é só o que vale hoje, e numa tela de administração isso esconde tanto o
   * que terminou quanto o que ainda vai começar, inclusive a vigência futura recém-criada.
   */
  it('a listagem de administração pede a série completa por padrão', async () => {
    p.store.recarregar();
    await p.propagar();
    const req = p.http.expectOne((r) => r.url === LISTA);
    expect(req.request.params.get('limit')).toBe('100');
    expect(req.request.params.get('vigentes')).toBe('false');
    req.flush([preliminar]);
    await p.propagar();
  });

  it('mostra, por linha, se o ato determina a situação, se é avulso e se corrige outro ato', async () => {
    const errata = { ...aviso, codigo: 'ERRATA', exigeAtoCorrigido: true };
    p.store.recarregar();
    await p.recarregarCom([preliminar, errata]);

    const resultado = linhaDe('RESULTADO_PRELIMINAR_INSCRICAO');
    const outra = linhaDe('ERRATA');
    expect([celula(resultado, 'Resultado'), celula(resultado, 'Avulso')]).toEqual(['Sim', 'Não']);
    expect(celula(resultado, 'Corrige outro ato')).toBe('Não');
    expect([celula(outra, 'Resultado'), celula(outra, 'Avulso')]).toEqual(['Não', 'Sim']);
    expect(celula(outra, 'Corrige outro ato')).toBe('Sim');
  });

  it('apresenta a vigência em pt-BR, aberta ou encerrada', () => {
    expect(celula(linhaDe('RESULTADO_PRELIMINAR_INSCRICAO'), 'Vigência')).toBe('Desde 01/01/2026');
    expect(celula(linhaDe('AVISO'), 'Vigência')).toBe('De 01/01/2026 até antes de 30/06/2026');
  });

  it('descreve a tabela para tecnologias assistivas', () => {
    const legenda = p.elemento('table > caption');
    expect(legenda.classList.contains('sr-only')).toBe(true);
    expect(legenda.textContent?.replace(/\s+/gu, ' ').trim()).toBe(
      'Tipos de ato publicáveis, com vigência e o que cada um determina',
    );
  });

  it('o botão de criação fica no cabeçalho, com ícone e o texto padronizado, e não se duplica', () => {
    const botao = p.elemento('.panel-head .btn--primary');
    expect(botao.textContent?.replace(/\s+/gu, ' ').trim()).toBe('Novo tipo de ato');
    expect(botao.querySelector('i.pi-plus')).not.toBeNull();
    const criacao = [...p.fixture.nativeElement.querySelectorAll('.btn--primary')].filter(
      (b) => (b as HTMLElement).textContent?.replace(/\s+/gu, ' ').trim() === 'Novo tipo de ato',
    );
    expect(criacao).toHaveLength(1);
  });

  it('restringir às vigências em vigor declara vigentes=true e volta à primeira página', async () => {
    p.elemento<HTMLElement>('.panel label.checkbox').click();
    await p.propagar();

    const req = p.http.expectOne((r) => r.url === LISTA);
    expect(req.request.params.get('vigentes')).toBe('true');
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush([preliminar]);
    await p.propagar();
    expect(p.store.somenteEmVigor()).toBe(true);
  });

  it('a busca filtra por código ou nome sobre a página carregada', async () => {
    const busca = p.elemento<HTMLInputElement>('input[type="search"]');
    busca.value = 'aviso';
    busca.dispatchEvent(new Event('input'));
    await p.propagar();

    expect(p.fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(linhaDe('AVISO')).toBeTruthy();
  });

  describe('estado vazio', () => {
    it('explica a consequência de não haver tipo de ato', async () => {
      p.store.recarregar();
      await p.recarregarCom([]);
      expect(p.fixture.nativeElement.textContent).toContain(
        'nem o resultado contra o qual cabe recurso',
      );
      expect(p.fixture.nativeElement.textContent).toContain('Nenhum tipo de ato cadastrado');
    });

    /** Recorte vazio não é catálogo vazio: oferecer cadastro quando o filtro escondeu tudo convida à duplicata. */
    it('restringir às em vigor conta como filtro e "Limpar filtros" desfaz o recorte', async () => {
      p.elemento<HTMLElement>('.panel label.checkbox').click();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush([]);
      await p.propagar();

      expect(p.fixture.nativeElement.textContent).toContain('Nenhum tipo de ato encontrado');
      expect(p.fixture.nativeElement.textContent).not.toContain('Nenhum tipo de ato cadastrado');

      const limpar = [...p.fixture.nativeElement.querySelectorAll('button')].find((b) =>
        (b as HTMLElement).textContent?.includes('Limpar filtros'),
      ) as HTMLButtonElement;
      limpar.click();
      await p.propagar();
      expect(p.store.somenteEmVigor()).toBe(false);
      p.http.expectOne((r) => r.url === LISTA).flush([preliminar]);
      await p.propagar();
    });
  });

  describe('formulário', () => {
    it('identifica como obrigatórios o código, o nome, o início e os dois atributos de publicação', async () => {
      await p.abrirCadastro();
      for (const nome of ['codigo', 'nome', 'vigenciaInicio']) {
        expect(p.campo(nome).getAttribute('aria-required'), nome).toBe('true');
      }
      const grupos = p.fixture.nativeElement.querySelectorAll('fieldset[role="radiogroup"]');
      expect(grupos).toHaveLength(2);
      for (const grupo of grupos) expect(grupo.getAttribute('aria-required')).toBe('true');
    });

    it('Sim e Não do mesmo atributo formam um grupo de rádio nativo', async () => {
      await p.abrirCadastro();
      const nomes = [...p.fixture.nativeElement.querySelectorAll('input[type="radio"]')].map(
        (radio) => (radio as HTMLInputElement).name,
      );
      expect(nomes).toEqual([
        'publicavelComoAvulso',
        'publicavelComoAvulso',
        'exigeAtoCorrigido',
        'exigeAtoCorrigido',
      ]);
    });

    /** A janela é semiaberta: quem quer validade até 30/06 informa 30/06 e encurta a vigência em um dia sem perceber. */
    it('diz que a data de fim é o primeiro dia sem validade', async () => {
      await p.abrirCadastro();
      const texto = p.fixture.nativeElement.textContent;
      expect(texto).toContain('primeiro dia sem validade');
      expect(texto).toContain('a data informada já fica fora da vigência');
    });
  });

  describe('cadastro', () => {
    it('envia o POST com Idempotency-Key e o código em maiúsculas, anuncia e avisa o sucesso', async () => {
      await p.abrirCadastro();
      p.elemento<HTMLInputElement>('input[aria-describedby="ehResultado-ajuda"]').click();
      p.responder('exigeAtoCorrigido', true);
      const post = await p.enviar();

      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(post.request.body).toEqual({
        codigo: 'RESULTADO_PRELIMINAR_INSCRICAO',
        nome: 'Resultado preliminar da inscrição',
        congelaConfiguracao: false,
        unicoPorObjeto: false,
        efeitoIrreversivel: false,
        ehResultado: true,
        publicavelComoAvulso: false,
        exigeAtoCorrigido: true,
        vigenciaInicio: '2026-01-01',
        vigenciaFim: null,
        baseLegal: null,
      });
      post.flush(...criado());
      await p.recarregarCom([preliminar]);

      expect(p.edicao.aberto()).toBe(false);
      expect(p.sucessos).toHaveBeenCalledWith('Tipo de ato cadastrado');
      expect(p.statusDaPagina()).toBe('Tipo de ato cadastrado.');
    });

    it('declarar "não" conta como resposta e viaja como false', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      expect(post.request.body).toMatchObject({
        publicavelComoAvulso: false,
        exigeAtoCorrigido: false,
      });
      post.flush(...criado());
      await p.recarregarCom([preliminar]);
    });

    it.each(['publicavelComoAvulso', 'exigeAtoCorrigido'] as const)(
      'não envia sem declarar %s, mesmo com o outro atributo respondido, e leva o foco a ele',
      async (nome) => {
        await p.abrirCadastro();
        p.edicao.form.controls[nome].setValue(null);
        p.salvar().click();
        await p.propagar();
        await p.propagar();

        p.http.expectNone(ESCRITA);
        const primeiroRadio = (n: string) =>
          p.elemento<HTMLInputElement>(`input[type="radio"][formcontrolname="${n}"]`);
        const outro =
          nome === 'publicavelComoAvulso' ? 'exigeAtoCorrigido' : 'publicavelComoAvulso';
        const primeiro = primeiroRadio(nome);
        expect(primeiro.getAttribute('aria-invalid')).toBe('true');
        expect(primeiroRadio(outro).getAttribute('aria-invalid')).toBeNull();
        expect(document.activeElement).toBe(primeiro);
      },
    );
  });

  describe('edição', () => {
    it('o código é somente leitura e o PUT reapresenta id e código, sem Idempotency-Key', async () => {
      await p.abrirEdicao(preliminar);
      expect(p.campo('codigo').readOnly).toBe(true);
      expect(p.campo('codigo').value).toBe(preliminar.codigo);
      p.preencher('nome', 'Resultado preliminar das inscrições');
      const put = await p.enviar(`${ESCRITA}/${preliminar.id}`);

      expect(put.request.method).toBe('PUT');
      expect(put.request.headers.has('Idempotency-Key')).toBe(false);
      expect(put.request.body).toMatchObject({
        id: preliminar.id,
        codigo: preliminar.codigo,
        nome: 'Resultado preliminar das inscrições',
      });
      put.flush(...sucesso());
      await p.recarregarCom([preliminar]);
      expect(p.sucessos).toHaveBeenCalledWith('Tipo de ato atualizado');
      expect(p.statusDaPagina()).toBe('Tipo de ato atualizado.');
    });

    it('preserva os dois atributos lidos e os reenvia no PUT', async () => {
      const errata = { ...preliminar, publicavelComoAvulso: true, exigeAtoCorrigido: true };
      p.store.recarregar();
      await p.recarregarCom([errata]);
      await p.abrirEdicao(errata);
      p.preencher('nome', 'Errata');
      const put = await p.enviar(`${ESCRITA}/${errata.id}`);

      expect(put.request.body).toMatchObject({
        publicavelComoAvulso: true,
        exigeAtoCorrigido: true,
      });
      put.flush(...sucesso());
      await p.recarregarCom([errata]);
    });

    it('o cadastro seguinte abre em branco, sem herdar a edição', async () => {
      await p.abrirEdicao(preliminar);
      p.elemento<HTMLButtonElement>('.form-drawer__footer button').click();
      await p.propagar();
      p.novo().click();
      await p.propagar();

      expect(p.campo('codigo').value).toBe('');
      expect(p.campo('codigo').readOnly).toBe(false);
      expect(p.edicao.form.getRawValue()).toMatchObject({
        publicavelComoAvulso: null,
        exigeAtoCorrigido: null,
      });
    });
  });

  describe('remoção de vigência', () => {
    it('as ações de linha têm nome acessível distinto por vigência do mesmo código', async () => {
      const outraVigencia = {
        ...aviso,
        id: 'outra',
        vigenciaInicio: '2026-07-01',
        vigenciaFim: null,
      };
      p.store.recarregar();
      await p.recarregarCom([aviso, outraVigencia]);

      const nomes = [
        ...p.fixture.nativeElement.querySelectorAll('button[aria-label^="Remover vigência"]'),
      ].map((b) => (b as HTMLButtonElement).getAttribute('aria-label'));
      expect(nomes).toEqual([
        'Remover vigência do tipo de ato AVISO, vigência iniciada em 01/01/2026',
        'Remover vigência do tipo de ato AVISO, vigência iniciada em 01/07/2026',
      ]);
    });

    it('pede confirmação nomeando a vigência da linha, sem enviar nada', async () => {
      p.remover(preliminar).click();
      await p.propagar();

      const dialogo = p.elemento('cfg-confirmacao-de-remocao');
      expect(dialogo.textContent).toContain('Remover vigência');
      expect(dialogo.textContent).toContain(
        'RESULTADO_PRELIMINAR_INSCRICAO iniciada em 01/01/2026',
      );
      p.http.expectNone(`${ESCRITA}/${preliminar.id}`);
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(p.edicao.confirmando()).toBe(false);
    });

    it('remove após a confirmação, avisa e anuncia o desfecho na página', async () => {
      const del = await p.confirmarRemocao(preliminar);
      expect(del.request.method).toBe('DELETE');
      del.flush(...sucesso());
      await p.recarregarCom([aviso]);

      expect(p.edicao.confirmando()).toBe(false);
      expect(p.sucessos).toHaveBeenCalledWith(
        'Vigência removida',
        'RESULTADO_PRELIMINAR_INSCRICAO',
      );
      expect(p.statusDaPagina()).toBe(
        'Vigência RESULTADO_PRELIMINAR_INSCRICAO iniciada em 01/01/2026 removida.',
      );
    });
  });

  describe('paginação', () => {
    it('avisa quando a busca não alcança o catálogo inteiro', async () => {
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush([preliminar, aviso], {
          headers: { Link: `<${LISTA}?cursor=PROXIMA&direction=next>; rel="next"` },
        });
      await p.propagar();
      expect(p.fixture.nativeElement.textContent).not.toContain('a busca alcança só a que está');

      const busca = p.elemento<HTMLInputElement>('input[type="search"]');
      busca.value = 'inexistente';
      busca.dispatchEvent(new Event('input'));
      await p.propagar();

      expect(p.fixture.nativeElement.textContent).toContain(
        'a busca alcança só a que está carregada',
      );
      expect(p.fixture.nativeElement.textContent).toContain(
        'A busca alcança só a página carregada — ajuste o termo ou navegue pelas páginas.',
      );
    });

    it('segue pelo cursor e volta à primeira página ao recarregar', async () => {
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush([preliminar], {
          headers: { Link: `<${LISTA}?cursor=abc&direction=next>; rel="next"` },
        });
      await p.propagar();

      p.store.proximaPagina();
      await p.propagar();
      const proxima = p.http.expectOne((r) => r.params.get('cursor') === 'abc');
      expect(proxima.request.params.get('direction')).toBe('next');
      expect(proxima.request.params.get('vigentes')).toBe('false');
      proxima.flush([aviso]);
      await p.propagar();
      expect(p.store.atos()).toEqual([aviso]);

      p.store.recarregar();
      await p.propagar();
      const primeira = p.http.expectOne((r) => r.url === LISTA);
      expect(primeira.request.params.has('cursor')).toBe(false);
      primeira.flush([preliminar]);
      await p.propagar();
      expect(p.store.atos()).toEqual([preliminar]);
    });
    it.each([
      [400, 'uniplus.cursor.invalido', 'A paginação foi reiniciada porque a consulta mudou.'],
      [
        410,
        'uniplus.cursor.expirado',
        'A listagem ficou aberta tempo demais e a consulta expirou.',
      ],
    ] as const)(
      'cursor recusado (%s) recomeça do início, avisa e não mostra o alerta de falha',
      async (status, code, aviso) => {
        p.store.recarregar();
        await p.propagar();
        p.http
          .expectOne((r) => r.url === LISTA)
          .flush([preliminar], {
            headers: { Link: `<${LISTA}?cursor=abc&direction=next>; rel="next"` },
          });
        await p.propagar();
        p.store.proximaPagina();
        await p.propagar();
        p.http
          .expectOne((r) => r.params.get('cursor') === 'abc')
          .flush(...problema(status, { code }));
        await p.propagar();

        expect(p.store.mensagemDeErro()).toBeNull();
        expect(p.informacoes).toHaveBeenCalledWith(aviso, 'Recarregamos a listagem do começo.');
        const recarga = p.http.expectOne((r) => r.url === LISTA);
        expect(recarga.request.params.has('cursor')).toBe(false);
        recarga.flush([preliminar]);
        await p.propagar();
      },
    );

    it('volta à página anterior pelo cursor que a resposta indicou', async () => {
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush([preliminar], {
          headers: { Link: `<${LISTA}?cursor=ant&direction=prev>; rel="prev"` },
        });
      await p.propagar();

      p.store.paginaAnterior();
      await p.propagar();
      const anterior = p.http.expectOne((r) => r.params.get('cursor') === 'ant');
      expect(anterior.request.params.get('direction')).toBe('prev');
      anterior.flush([aviso]);
      await p.propagar();
      expect(p.store.atos()).toEqual([aviso]);
    });
  });
});
