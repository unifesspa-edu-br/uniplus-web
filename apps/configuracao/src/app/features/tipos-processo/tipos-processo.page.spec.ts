import { afterEach, describe, expect, it } from 'vitest';
import {
  LISTA,
  PERMISSAO_DE_CONSULTAR,
  Pagina,
  criado,
  montarPagina,
  problema,
  sisu,
  sucesso,
  vestibular,
} from './tipos-processo.testing';

describe('TiposProcessoPage', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  describe('leitura', () => {
    it('lê a listagem de manutenção, sem restringir a ativos', async () => {
      p = await montarPagina([]);
      p.store.recarregar();
      await p.propagar();
      const req = p.http.expectOne((r) => r.url === LISTA && r.method === 'GET');
      expect(req.request.params.get('limit')).toBe('50');
      expect(req.request.params.has('apenasAtivos')).toBe(false);
      req.flush([]);
      await p.propagar();
    });

    it('expõe legenda acessível descrevendo a tabela', async () => {
      p = await montarPagina([sisu]);
      const caption = p.elemento('table > caption');
      expect(caption.classList.contains('sr-only')).toBe(true);
      expect(caption.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Tipos de processo seletivo, com código, descrição e situação de uso',
      );
    });

    it('mostra a situação de cada tipo', async () => {
      p = await montarPagina();
      const texto = p.fixture.nativeElement.textContent as string;
      for (const esperado of ['SiSU', 'SISU', 'Ativo', 'Desativado', 'Vestibular tradicional']) {
        expect(texto).toContain(esperado);
      }
      expect(p.store.tipos()).toHaveLength(2);
    });

    it('filtra por código ou nome apenas na página carregada', async () => {
      p = await montarPagina();
      p.store.termoBusca.set('  tradicional  ');
      expect(p.store.tiposFiltrados()).toEqual([vestibular]);
      p.store.termoBusca.set('sisu');
      expect(p.store.tiposFiltrados()).toEqual([sisu]);
    });

    it('"Limpar filtros" esvazia a busca quando ela não encontra nada', async () => {
      p = await montarPagina();
      p.store.termoBusca.set('inexistente');
      await p.propagar();
      expect(p.fixture.nativeElement.textContent).toContain('Nenhum tipo de processo encontrado');
      const limpar = [...p.fixture.nativeElement.querySelectorAll('button')].find((b) =>
        (b as HTMLElement).textContent?.includes('Limpar filtros'),
      ) as HTMLButtonElement;
      limpar.click();
      await p.propagar();
      expect(p.store.termoBusca()).toBe('');
      expect(p.store.tiposFiltrados()).toHaveLength(2);
    });

    it('preserva a página e seus cursores quando a navegação falha e permite tentar novamente', async () => {
      p = await montarPagina([]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush([sisu], { headers: { Link: '</api/itens?cursor=abc&direction=next>; rel="next"' } });
      await p.propagar();
      p.store.proximaPagina();
      await p.propagar();
      const requisicao = p.http.expectOne((r) => r.url === LISTA && r.method === 'GET');
      expect(requisicao.request.params.get('cursor')).toBe('abc');
      expect(requisicao.request.params.get('direction')).toBe('next');
      expect(requisicao.request.params.has('limit')).toBe(false);
      requisicao.flush(
        { title: 'Falha', status: 503 },
        { status: 503, statusText: 'Indisponível' },
      );
      await p.propagar();
      expect(p.store.tipos()).toEqual([sisu]);
      expect(p.store.proximo()).not.toBeNull();
      p.store.tentarNovamente();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.params.get('cursor') === 'abc')
        .flush([vestibular]);
      await p.propagar();
      expect(p.store.tipos()).toEqual([vestibular]);
    });
  });

  describe('estado vazio e permissão', () => {
    it('convida a cadastrar só a quem pode manter', async () => {
      p = await montarPagina([]);
      expect(p.fixture.nativeElement.textContent).toContain('Cadastre o primeiro tipo de processo');
    });

    it('não manda cadastrar quem não pode manter', async () => {
      p = await montarPagina([], [PERMISSAO_DE_CONSULTAR]);
      const texto = p.fixture.nativeElement.textContent as string;
      expect(texto).toContain('Nenhum tipo de processo cadastrado');
      expect(texto).not.toContain('Cadastre o primeiro');
    });

    it('sem a permissão de manter, a lista segue visível mas não oferece escrever', async () => {
      p = await montarPagina([sisu, vestibular], [PERMISSAO_DE_CONSULTAR]);
      const raiz = p.fixture.nativeElement as HTMLElement;
      expect(raiz.textContent).toContain('SiSU');
      expect(raiz.querySelector('#cfg-tipos-processo-novo')).toBeNull();
      expect(raiz.querySelectorAll('td.table-responsive__actions ui-icon-button')).toHaveLength(0);
    });

    it('com a permissão de manter, oferece editar e desativar ao ativo, e reativar ao desativado', async () => {
      p = await montarPagina();
      expect(p.editar(sisu)).toBeTruthy();
      expect(p.desativar(sisu)).toBeTruthy();
      expect(p.reativar(vestibular)).toBeTruthy();
      expect(
        p.fixture.nativeElement.querySelector(
          '[aria-label="Editar tipo de processo VESTIBULAR_TRAD"]',
        ),
      ).toBeNull();
    });

    it('o aviso de código imutável é visível mesmo com a lista vazia', async () => {
      p = await montarPagina([]);
      expect(p.fixture.nativeElement.textContent).toContain('Código imutável após criação');
    });
  });

  describe('escritas', () => {
    it('cria com código, nome e descrição, com chave de idempotência', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('codigo', 'ENEM');
      p.preencher('nome', 'ENEM');
      p.preencher('descricao', 'Ingresso via nota do ENEM.');
      const post = await p.enviar();

      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(post.request.body).toEqual({
        codigo: 'ENEM',
        nome: 'ENEM',
        descricao: 'Ingresso via nota do ENEM.',
      });
      post.flush(...criado());
      await p.recarregarCom([sisu]);
      expect(p.edicao.aberto()).toBe(false);
    });

    it('sugere o código a partir do nome na criação e não o altera na edição', async () => {
      p = await montarPagina();
      await p.abrirCadastro();
      expect(p.campo('codigo').value).toBe('PROCESSO_SELETIVO');
      p.elemento<HTMLButtonElement>('.form-drawer__footer button').click();
      await p.propagar();

      await p.abrirEdicao(sisu);
      p.preencher('nome', 'Outro nome');
      expect(p.campo('codigo').value).toBe('SISU');
    });

    it('desativa após a confirmação, sem Idempotency-Key, e recarrega a lista', async () => {
      p = await montarPagina();
      const req = await p.confirmarDesativacao(sisu);
      expect(req.request.method).toBe('DELETE');
      req.flush(...sucesso());
      await p.recarregarCom([{ ...sisu, ativo: false }, vestibular]);
      expect(p.edicao.confirmando()).toBe(false);
      expect(p.statusDaPagina()).toContain('Tipo de processo SISU desativado.');
    });

    it('reativa após a confirmação, com Idempotency-Key, e recarrega a lista', async () => {
      p = await montarPagina();
      const req = await p.confirmarReativacao(vestibular);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Idempotency-Key')).toBeTruthy();
      req.flush(...sucesso());
      await p.recarregarCom([sisu, { ...vestibular, ativo: true }]);
      expect(p.edicao.confirmandoReativacao()).toBe(false);
      expect(p.statusDaPagina()).toContain('Tipo de processo VESTIBULAR_TRAD reativado.');
    });

    it('não anuncia o desfecho na página enquanto o diálogo está aberto', async () => {
      p = await montarPagina();
      const req = await p.confirmarDesativacao(sisu);
      req.flush(...problema(422, { code: 'uniplus.configuracao.tipo_processo.ja_desativado' }));
      await p.propagar();
      expect(p.statusDaPagina()).toBe('');
    });
  });
});
