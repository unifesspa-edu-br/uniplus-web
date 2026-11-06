import { afterEach, describe, expect, it } from 'vitest';
import {
  CATEGORIAS,
  CATEGORIAS_URL,
  ESCRITA,
  Pagina,
  PROTECAO_PREENCHIDA,
  criado,
  diploma,
  montarPagina,
  orfao,
  rg,
  sucesso,
} from './tipos-documento.testing';

describe('TiposDocumentoPage — formulário', () => {
  let p: Pagina;
  afterEach(() => p.encerrar());

  const mensagem = (nome: string): string | undefined =>
    p.campo(nome).closest('.field')?.querySelector('.field__error')?.textContent?.trim();
  const submeter = async (): Promise<void> => {
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
    await p.propagar();
    await p.propagar();
  };
  const formato = (rotulo: string): HTMLInputElement => {
    const label = [...p.fixture.nativeElement.querySelectorAll('label.checkbox')].find(
      (l: HTMLElement) => l.textContent?.trim() === rotulo,
    );
    expect(label, rotulo).toBeTruthy();
    return (label as HTMLElement).querySelector('input') as HTMLInputElement;
  };
  const opcoesDaCategoria = (): HTMLOptionElement[] => [
    ...p.fixture.nativeElement.querySelectorAll('select[formcontrolname="categoria"] option'),
  ];

  it('identifica como obrigatórios, para tecnologias assistivas, todos os controles obrigatórios', async () => {
    p = await montarPagina([]);
    await p.abrirCadastro();
    for (const nome of [
      'codigo',
      'categoria',
      'nome',
      'classificacaoProtecao',
      'hipoteseLegal',
      'finalidadeTratamento',
    ]) {
      expect(p.campo(nome).getAttribute('aria-required'), nome).toBe('true');
    }
    expect(p.campo('descricao').hasAttribute('aria-required')).toBe(false);
  });

  it('bloqueia salvar com os obrigatórios vazios, marca os campos e leva o foco ao primeiro', async () => {
    p = await montarPagina([]);
    await p.acionarNovo();
    p.salvar().focus();
    p.salvar().click();
    await submeter();

    p.http.expectNone(ESCRITA);
    for (const nome of ['codigo', 'categoria', 'nome']) {
      expect(p.campo(nome).getAttribute('aria-invalid'), nome).toBe('true');
    }
    expect(mensagem('nome')).toBe('Campo obrigatório.');
    expect(document.activeElement).toBe(p.campo('codigo'));
  });

  describe('código', () => {
    it('é sugerido a partir do nome ao criar, em caixa alta sem acento', async () => {
      p = await montarPagina([]);
      await p.acionarNovo();
      p.preencher('nome', 'Laudo médico');
      expect(p.campo('codigo').value).toBe('LAUDO_MEDICO');
    });

    it('a edição manual do código não é sobrescrita pela sugestão', async () => {
      p = await montarPagina([]);
      await p.acionarNovo();
      p.preencher('nome', 'Laudo médico');
      p.preencher('codigo', 'LAUDO_MEDICO_PCD');
      p.preencher('nome', 'Laudo médico para PcD');
      expect(p.campo('codigo').value).toBe('LAUDO_MEDICO_PCD');
    });

    it('na edição, digitar o nome não altera o código já gravado', async () => {
      p = await montarPagina([rg]);
      await p.abrirEdicao(rg);
      p.preencher('nome', 'Registro Geral revisado');
      expect(p.campo('codigo').value).toBe('RG');
      expect(p.campo('codigo').readOnly).toBe(false);
    });

    it('nome que não produz código válido não deixa sugestão no campo', async () => {
      p = await montarPagina([]);
      await p.acionarNovo();
      p.preencher('nome', '21 de abril');
      expect(p.campo('codigo').value).toBe('');
    });

    it('fora do formato fechado é recusado no cliente, com a regra à vista e associada ao campo', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('codigo', '01');
      await p.enviarSemRequisicao();

      expect(mensagem('codigo')).toBe(
        'Use caixa alta, começando por letra, com letras, números e sublinhado.',
      );
      expect(p.campo('codigo').getAttribute('aria-invalid')).toBe('true');
      expect(p.campo('codigo').getAttribute('aria-describedby')).toBe(
        'cfg-tdoc-codigo-dica cfg-tdoc-codigo-erro',
      );
      expect(document.activeElement).toBe(p.campo('codigo'));
    });
  });

  describe('tipo equivalente', () => {
    it('igual ao próprio código é recusado no cliente, e o foco vai ao campo', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('codigo', 'RG');
      p.preencher('tipoEquivalente', 'RG');
      await p.enviarSemRequisicao();

      expect(mensagem('tipoEquivalente')).toBe(
        'O tipo equivalente não pode ser igual ao próprio código.',
      );
      expect(document.activeElement).toBe(p.campo('tipoEquivalente'));
    });

    it('a recusa aparece assim que o código passa a repetir o equivalente', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('tipoEquivalente', 'DECLARACAO_DE_RENDA');
      p.preencher('codigo', 'DECLARACAO_DE_RENDA');
      await p.propagar();
      expect(mensagem('tipoEquivalente')).toContain('não pode ser igual');

      p.preencher('codigo', 'DECLARACAO_RENDA');
      await p.propagar();
      expect(mensagem('tipoEquivalente')).toBeUndefined();
    });

    it('diferente do código não gera erro e o envio segue', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('codigo', 'RG');
      p.preencher('tipoEquivalente', 'CIN');
      const post = await p.enviar();
      expect(post.request.body).toMatchObject({ codigo: 'RG', tipoEquivalente: 'CIN' });
      post.flush(...criado());
      await p.recarregarCom([rg]);
    });
  });

  describe('tamanho máximo', () => {
    it.each(['0', '-5'])(
      '%s é recusado no cliente com a regra do inteiro positivo',
      async (valor) => {
        p = await montarPagina([]);
        await p.abrirCadastro();
        p.preencher('tamanhoMaximoMb', valor);
        await p.enviarSemRequisicao();
        expect(mensagem('tamanhoMaximoMb')).toBe('Deve ser um inteiro positivo (≥ 1).');
        expect(document.activeElement).toBe(p.campo('tamanhoMaximoMb'));
      },
    );

    it('positivo ou vazio é aceito e viaja no comando', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('tamanhoMaximoMb', '10');
      const post = await p.enviar();
      expect(post.request.body.tamanhoMaximoMb).toBe(10);
      post.flush(...criado());
      await p.recarregarCom([rg]);
    });
  });

  it.each([
    ['codigo', 51, 'Informe no máximo 50 caracteres.'],
    ['nome', 201, 'Informe no máximo 200 caracteres.'],
    ['descricao', 1001, 'Informe no máximo 1000 caracteres.'],
    ['tipoEquivalente', 51, 'Informe no máximo 50 caracteres.'],
    ['finalidadeTratamento', 501, 'Informe no máximo 500 caracteres.'],
  ] as const)(
    'o limite de %s (%i caracteres) é recusado no cliente',
    async (campo, tamanho, texto) => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher(campo, 'A'.repeat(tamanho));
      await p.enviarSemRequisicao();
      expect(mensagem(campo)).toBe(texto);
    },
  );

  it('o nome com menos de dois caracteres pede ao menos dois', async () => {
    p = await montarPagina([]);
    await p.abrirCadastro();
    p.preencher('nome', 'x');
    await p.enviarSemRequisicao();
    expect(mensagem('nome')).toBe('Informe ao menos 2 caracteres.');
  });

  describe('formatos aceitos', () => {
    it('serializa as caixas marcadas para "pdf,jpg,png"', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      for (const rotulo of ['PDF', 'JPEG', 'PNG']) formato(rotulo).click();
      const post = await p.enviar();
      expect(post.request.body.formatosAceitos).toBe('pdf,jpg,png');
      expect(post.request.body).toMatchObject(PROTECAO_PREENCHIDA);
      post.flush(...criado());
      await p.recarregarCom([rg]);
    });

    it('nenhum formato marcado vai como null', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      const post = await p.enviar();
      expect(post.request.body.formatosAceitos).toBeNull();
      post.flush(...criado());
      await p.recarregarCom([rg]);
    });

    it('ao abrir a edição, marca as caixas da string guardada', async () => {
      p = await montarPagina([rg]);
      await p.abrirEdicao(rg);
      const marcadas = ['PDF', 'JPEG', 'PNG', 'TIFF'].map((rotulo) => formato(rotulo).checked);
      expect(marcadas).toEqual([true, true, false, false]);
    });
  });

  it('o nome só com espaços viaja como null, para o servidor responder sobre a ausência', async () => {
    p = await montarPagina([]);
    await p.abrirCadastro();
    p.preencher('nome', '   ');
    p.preencher('codigo', 'DECL3');
    const post = await p.enviar();
    expect(post.request.body).toMatchObject({ codigo: 'DECL3', nome: null, categoria: 'RENDA' });
    post.flush(...criado());
    await p.recarregarCom([rg]);
  });

  describe('categoria', () => {
    it('oferece as categorias do cadastro com o nome do cadastro', async () => {
      p = await montarPagina([]);
      await p.acionarNovo();

      expect(opcoesDaCategoria()).toHaveLength(CATEGORIAS.length + 1);
      expect(
        opcoesDaCategoria()
          .find((o) => o.value === 'TITULACAO_EXPERIENCIA')
          ?.textContent?.trim(),
      ).toBe('Titulação e experiência');
    });

    it('cadastro numa categoria nova envia o código e conclui', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('categoria', 'DOCUMENTO_PROCESSUAL');
      const post = await p.enviar();
      expect(post.request.body.categoria).toBe('DOCUMENTO_PROCESSUAL');
      post.flush(...criado());
      await p.recarregarCom([{ ...diploma, categoria: 'DOCUMENTO_PROCESSUAL' }]);
      expect(p.fixture.nativeElement.textContent).toContain('Documento processual');
      expect(p.edicao.aberto()).toBe(false);
    });

    it('categoria criada no cadastro ganha opção e chip sem alteração de código', async () => {
      const militar = {
        ...CATEGORIAS[0],
        id: 'ca7e0000-0000-7000-8000-000000000011',
        codigo: 'DOCUMENTO_MILITAR',
        nome: 'Documento militar',
        ordem: 11,
      };
      p = await montarPagina([orfao], { categorias: [...CATEGORIAS, militar] });
      await p.acionarNovo();

      expect(opcoesDaCategoria().map((o) => o.value)).toContain('DOCUMENTO_MILITAR');
      expect(p.store.categoriaChips().map((c) => c.label)).toContain('Documento militar');
      expect(p.store.categoriaChips().map((c) => c.label)).not.toContain('Fora do cadastro');
    });

    it('editar um tipo de categoria removida preserva o código no select e explica', async () => {
      p = await montarPagina([orfao]);
      await p.abrirEdicao(orfao);

      const select = p.campo('categoria') as unknown as HTMLSelectElement;
      expect(select.value).toBe('DOCUMENTO_MILITAR');
      expect(opcoesDaCategoria().find((o) => o.value === 'DOCUMENTO_MILITAR')?.textContent).toBe(
        'DOCUMENTO_MILITAR',
      );
      expect(p.elemento('#cfg-td-categoria-dica').textContent).toContain(
        'não está mais no cadastro',
      );
    });

    it('enquanto o catálogo não chega, a opção do código atual não inventa rótulo', async () => {
      p = await montarPagina([diploma], { categorias: 'pendente' });
      await p.abrirEdicao(diploma);

      const opcao = opcoesDaCategoria().find((o) => o.value === 'TITULACAO_EXPERIENCIA');
      expect(opcao?.textContent).toBe('Carregando…');
      expect(p.campo('categoria').getAttribute('aria-busy')).toBe('true');
      expect(p.elemento('#cfg-td-categoria-dica').textContent).toContain(
        'Carregando as categorias',
      );
      p.atenderCategorias();
    });

    it('a recusa do catálogo aparece no formulário e a nova tentativa leva o foco ao campo', async () => {
      p = await montarPagina([], { categorias: 'falha' });
      await p.acionarNovo();

      expect(p.elemento('ui-drawer ui-alert').textContent).toContain('Categorias não carregadas');
      expect(p.elemento('#cfg-td-categoria-dica').textContent).toContain(
        'não puderam ser carregadas',
      );
      const tentar = p.elemento<HTMLButtonElement>('ui-drawer .list-state__retry button');
      tentar.focus();
      tentar.click();
      await p.propagar();
      expect(tentar.isConnected).toBe(true);
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      expect(document.activeElement).toBe(tentar);
      p.atenderCategorias();
      await p.propagar();
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('ui-drawer ui-alert')).toBeNull();
      expect(document.activeElement).toBe(p.campo('categoria'));
    });

    it('durante o salvamento o botão do aviso fica indisponível e não pede o catálogo', async () => {
      p = await montarPagina([], { categorias: 'falha' });
      await p.abrirCadastro();
      p.edicao.form.controls.categoria.setValue('RENDA');
      const post = await p.enviar();
      const tentar = p.elemento<HTMLButtonElement>('ui-drawer .list-state__retry button');

      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      tentar.click();
      await p.propagar();
      p.http.expectNone((r) => r.url === CATEGORIAS_URL);

      post.flush(...criado());
      await p.recarregarCom([rg]);
    });

    it('anuncia cada nova tentativa do catálogo, também a segunda falha seguida', async () => {
      p = await montarPagina([], { categorias: 'falha' });
      await p.acionarNovo();
      const tentar = p.elemento<HTMLButtonElement>('ui-drawer .list-state__retry button');
      const anuncio = (): string =>
        p.fixture.nativeElement.querySelectorAll('ui-drawer span.sr-only[role="status"]')[1]
          ?.textContent ?? '';

      for (let vez = 0; vez < 2; vez++) {
        tentar.click();
        await p.propagar();
        expect(anuncio()).toBe('Lendo categorias...');
        p.atenderCategorias('falha');
        await p.propagar();
        expect(anuncio()).toBe('Falha na leitura: categorias.');
        expect(document.activeElement).not.toBe(p.campo('categoria'));
      }
    });

    it('associa a dica e a mensagem de erro ao campo para leitor de tela', async () => {
      p = await montarPagina([]);
      await p.acionarNovo();
      expect(p.campo('categoria').getAttribute('aria-describedby')).toBe('cfg-td-categoria-dica');

      await p.enviarSemRequisicao();
      expect(p.campo('categoria').getAttribute('aria-invalid')).toBe('true');
      expect(p.campo('categoria').getAttribute('aria-describedby')).toBe(
        'cfg-td-categoria-dica cfg-td-categoria-erro',
      );
      expect(p.elemento('#cfg-td-categoria-erro').textContent?.trim()).toBe('Campo obrigatório.');
    });
  });

  describe('proteção de dados', () => {
    it('esvazia a hipótese legal que não cabe na nova classificação', async () => {
      p = await montarPagina([]);
      await p.acionarNovo();
      p.preencher('classificacaoProtecao', 'PESSOAL');
      await p.propagar();
      p.preencher('hipoteseLegal', 'INTERESSE_LEGITIMO');
      expect(p.edicao.form.controls.hipoteseLegal.value).toBe('INTERESSE_LEGITIMO');

      p.preencher('classificacaoProtecao', 'SENSIVEL');
      await p.propagar();
      expect(p.edicao.form.controls.hipoteseLegal.value).toBe('');
    });

    it('ao abrir a edição mantém a hipótese do servidor; só esvazia a que a pessoa tornou incompatível', async () => {
      const antigo = {
        ...rg,
        classificacaoProtecao: 'SENSIVEL',
        hipoteseLegal: 'INTERESSE_LEGITIMO',
      };
      p = await montarPagina([antigo]);
      await p.abrirEdicao(antigo);
      await p.propagar();
      expect(p.edicao.form.controls.hipoteseLegal.value).toBe('INTERESSE_LEGITIMO');

      p.preencher('classificacaoProtecao', 'PESSOAL');
      await p.propagar();
      p.preencher('hipoteseLegal', 'PREVENCAO_A_FRAUDE');
      await p.propagar();
      expect(p.edicao.form.controls.hipoteseLegal.value).toBe('');
    });

    it('avisa que o tipo aprovado volta a pendente ao mudar a classificação, e não ao mudar o nome', async () => {
      p = await montarPagina([rg]);
      await p.abrirEdicao(rg);
      p.preencher('nome', 'Registro Geral revisado');
      await p.propagar();
      expect(p.edicao.avisaNovaAprovacao()).toBe(false);

      p.preencher('classificacaoProtecao', 'SENSIVEL');
      await p.propagar();
      expect(p.edicao.avisaNovaAprovacao()).toBe(true);
      expect(p.elemento('cfg-aviso-de-nova-aprovacao').textContent).toContain(
        'O item volta a pendente',
      );
    });
  });

  it('o sucesso do criar fecha o drawer, envia a chave, anuncia e recarrega a lista', async () => {
    p = await montarPagina([]);
    await p.abrirCadastro();
    const post = await p.enviar();
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toMatchObject({ nome: 'Declaração de renda', categoria: 'RENDA' });
    post.flush(...criado());
    await p.recarregarCom([rg]);

    expect(p.edicao.aberto()).toBe(false);
    expect(p.sucessos).toHaveBeenCalledWith('Tipo de documento criado');
    expect(p.statusDaPagina()).toBe('Tipo de documento criado.');
  });

  it('a edição envia o código reeditável junto do id e anuncia o desfecho', async () => {
    p = await montarPagina([rg]);
    await p.abrirEdicao(rg);
    p.preencher('nome', 'Registro Geral revisado');
    const put = await p.enviar(`${ESCRITA}/${rg.id}`);

    expect(put.request.method).toBe('PUT');
    expect(put.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(put.request.body).toMatchObject({
      id: rg.id,
      codigo: 'RG',
      nome: 'Registro Geral revisado',
    });
    put.flush(...sucesso());
    await p.recarregarCom([rg]);
    expect(p.sucessos).toHaveBeenCalledWith('Tipo de documento atualizado');
    expect(p.statusDaPagina()).toBe('Tipo de documento atualizado.');
  });
});
