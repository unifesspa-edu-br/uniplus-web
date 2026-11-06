import { of, Subject } from 'rxjs';
import {
  ApiResult,
  VENDOR_MIME_TOKEN,
  errorResult,
  mockProblemDetails,
  okResult,
} from '@uniplus/shared-core/http';
import type { CidadeResumoDto } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  LISTA,
  Pagina,
  belemGeo,
  criado,
  instituto,
  marabaGeo,
  montarPagina,
  problema,
  reitoria,
  sucesso,
} from './unidades.testing';

const ESPERA_DO_DEBOUNCE_MS = 360;
const esperar = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('UnidadesPage — buscas do formulário', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.http.verify());

  const campoDaCidade = (): HTMLInputElement => p.elemento('#cfg-unidade-cidade-busca');
  const campoDaSuperior = (): HTMLInputElement =>
    p.elemento('cfg-unidade-superior-campo input[type="search"]');
  const digitar = async (campo: HTMLInputElement, texto: string, espera = true): Promise<void> => {
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await p.propagar();
    if (espera) {
      await esperar(ESPERA_DO_DEBOUNCE_MS);
      await p.propagar();
    }
  };
  const opcoesDeCidade = (): string[] =>
    [...p.fixture.nativeElement.querySelectorAll('.localidade-opcoes button')].map(
      (b) => (b as HTMLElement).textContent?.trim() ?? '',
    );
  const texto = (): string => p.fixture.nativeElement.textContent;

  describe('cidade', () => {
    it('só busca a partir de 3 letras, com o termo aparado e a janela de 20', async () => {
      await p.abrirCadastro();

      await digitar(campoDaCidade(), 'Ma');
      expect(p.geo.listarCidades).not.toHaveBeenCalled();

      await digitar(campoDaCidade(), ' Marabá ');
      expect(p.geo.listarCidades).toHaveBeenCalledWith({ q: 'Marabá', limit: 20 });
    });

    it('a cidade escolhida entra no comando com o trio inteiro', async () => {
      p.geo.listarCidades.mockReturnValue(of(okResult([marabaGeo, belemGeo])));
      await p.abrirCadastro();
      await digitar(campoDaCidade(), 'Mar');
      expect(opcoesDeCidade()).toEqual(['Marabá — PA', 'Belém — PA']);

      p.elemento<HTMLButtonElement>('.localidade-opcoes button').click();
      await p.propagar();
      expect(campoDaCidade().value).toBe('Marabá — PA');
      expect(campoDaCidade().readOnly).toBe(true);

      const post = await p.enviar();
      expect(post.request.body).toMatchObject({
        cidadeCodigoIbge: '1504208',
        cidadeNome: 'Marabá',
        cidadeUf: 'PA',
      });
      post.flush(...criado());
      await p.recarregarCom([reitoria]);
    });

    it('sem cidade escolhida, o trio vai nulo', async () => {
      await p.abrirCadastro();

      const post = await p.enviar();
      expect(post.request.body).toMatchObject({
        cidadeCodigoIbge: null,
        cidadeNome: null,
        cidadeUf: null,
      });
      post.flush(...criado());
      await p.recarregarCom([reitoria]);
    });

    it('descarta as opções do termo anterior assim que o campo muda', async () => {
      p.geo.listarCidades.mockReturnValue(of(okResult([marabaGeo])));
      await p.abrirCadastro();
      await digitar(campoDaCidade(), 'Marab');
      expect(opcoesDeCidade()).toEqual(['Marabá — PA']);

      await digitar(campoDaCidade(), 'Belém', false);

      expect(opcoesDeCidade()).toEqual([]);
      expect(texto()).not.toContain('Nenhuma cidade encontrada');
    });

    it('a busca em voo de um termo abandonado não substitui a do termo atual', async () => {
      const respostaMaraba = new Subject<ApiResult<readonly CidadeResumoDto[]>>();
      const respostaBelem = new Subject<ApiResult<readonly CidadeResumoDto[]>>();
      p.geo.listarCidades.mockImplementation((filtro: { q: string }) =>
        filtro.q === 'Marabá' ? respostaMaraba : respostaBelem,
      );
      await p.abrirCadastro();
      await digitar(campoDaCidade(), 'Marabá');
      await digitar(campoDaCidade(), 'Belém');

      respostaMaraba.next(okResult([marabaGeo]));
      respostaBelem.next(okResult([belemGeo]));
      await p.propagar();

      expect(opcoesDeCidade()).toEqual(['Belém — PA']);
    });

    it('anuncia "Consultando" durante a busca e só diz "Nenhuma cidade" depois da resposta vazia', async () => {
      const resposta = new Subject<ApiResult<readonly CidadeResumoDto[]>>();
      p.geo.listarCidades.mockReturnValue(resposta);
      await p.abrirCadastro();

      await digitar(campoDaCidade(), 'Xyzxyz', false);
      await esperar(ESPERA_DO_DEBOUNCE_MS - 100);
      expect(texto()).not.toContain('Nenhuma cidade encontrada');

      await esperar(150);
      await p.propagar();
      expect(texto()).toContain('Consultando a API Geo');
      expect(campoDaCidade().getAttribute('aria-busy')).toBe('true');
      expect(texto()).not.toContain('Nenhuma cidade encontrada');

      resposta.next(okResult([]));
      await p.propagar();
      expect(texto()).toContain('Nenhuma cidade encontrada');
      expect(texto()).not.toContain('Consultando a API Geo');
    });

    it('rebuscar o termo que já devolveu resultado não afirma "Nenhuma cidade"', async () => {
      p.geo.listarCidades.mockReturnValue(of(okResult([marabaGeo])));
      await p.abrirCadastro();

      await digitar(campoDaCidade(), 'Marabá');

      expect(texto()).not.toContain('Nenhuma cidade encontrada');
      expect(opcoesDeCidade()).toHaveLength(1);
    });

    it('a falha 5xx da busca aparece no campo, associada, e avisa por toast', async () => {
      p.geo.listarCidades.mockReturnValue(
        of(
          errorResult(
            mockProblemDetails({ status: 503, type: 'server-error', title: 'Geo indisponível' }),
          ),
        ),
      );
      await p.abrirCadastro();

      await digitar(campoDaCidade(), 'Marabá');

      expect(p.elemento('#cfg-unidade-cidade-busca-erro').textContent).toContain(
        'Geo indisponível',
      );
      expect(campoDaCidade().getAttribute('aria-describedby')).toContain(
        'cfg-unidade-cidade-busca-erro',
      );
      expect(p.erros).toHaveBeenCalledTimes(1);
    });

    it('a falha 4xx da busca aparece no campo sem toast, e a de um termo abandonado some', async () => {
      p.geo.listarCidades.mockReturnValueOnce(
        of(
          errorResult(
            mockProblemDetails({ status: 400, type: 'validation-error', title: 'Termo inválido' }),
          ),
        ),
      );
      await p.abrirCadastro();
      await digitar(campoDaCidade(), 'Marab');
      expect(texto()).toContain('Termo inválido');
      expect(p.erros).not.toHaveBeenCalled();

      await digitar(campoDaCidade(), 'Belém', false);
      expect(texto()).not.toContain('Termo inválido');
    });

    it('a falha da busca oferece "Tentar novamente", indisponível durante a espera, e devolve o foco ao campo', async () => {
      const retorno = new Subject<ApiResult<readonly CidadeResumoDto[]>>();
      p.geo.listarCidades
        .mockReturnValueOnce(
          of(errorResult(mockProblemDetails({ status: 400, type: 'x', title: 'Geo recusou' }))),
        )
        .mockReturnValueOnce(retorno);
      await p.abrirCadastro();
      await digitar(campoDaCidade(), 'Marabá');

      const tentar = p.elemento<HTMLButtonElement>('#cfg-unidade-cidade-busca-erro button');
      tentar.focus();
      tentar.click();
      await p.propagar();
      expect(p.geo.listarCidades).toHaveBeenCalledTimes(2);
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      expect(tentar.getAttribute('aria-busy')).toBe('true');
      tentar.click();
      await p.propagar();
      expect(p.geo.listarCidades).toHaveBeenCalledTimes(2);

      retorno.next(okResult([marabaGeo]));
      await p.propagar();
      await p.propagar();
      expect(opcoesDeCidade()).toEqual(['Marabá — PA']);
      expect(p.fixture.nativeElement.querySelector('#cfg-unidade-cidade-busca-erro')).toBeNull();
      expect(document.activeElement).toBe(campoDaCidade());
    });

    it('"Trocar cidade" reabre a busca limpa; reabrir a edição descarta o resíduo da tentativa anterior', async () => {
      p.geo.listarCidades.mockReturnValue(of(okResult([belemGeo])));
      await p.abrirEdicao(reitoria);
      expect(campoDaCidade().value).toBe('Marabá — PA');

      p.elemento<HTMLButtonElement>('cfg-unidade-cidade-campo .input-group button').click();
      await p.propagar();
      expect(campoDaCidade().value).toBe('');
      await digitar(campoDaCidade(), 'Belém');
      expect(opcoesDeCidade()).toEqual(['Belém — PA']);

      p.edicao.fechar();
      await p.propagar();
      await p.abrirEdicao(reitoria);
      expect(campoDaCidade().value).toBe('Marabá — PA');
      p.elemento<HTMLButtonElement>('cfg-unidade-cidade-campo .input-group button').click();
      await p.propagar();
      expect(opcoesDeCidade()).toEqual([]);
      expect(campoDaCidade().value).toBe('');
    });

    it('trocar a cidade na edição envia o novo trio', async () => {
      p.geo.listarCidades.mockReturnValue(of(okResult([belemGeo])));
      await p.abrirEdicao(reitoria);
      p.elemento<HTMLButtonElement>('cfg-unidade-cidade-campo .input-group button').click();
      await p.propagar();
      await digitar(campoDaCidade(), 'Belém');
      p.elemento<HTMLButtonElement>('.localidade-opcoes button').click();
      await p.propagar();

      const put = await p.enviar(`${ESCRITA}/${reitoria.id}`);
      expect(put.request.body).toMatchObject({
        cidadeCodigoIbge: '1501402',
        cidadeNome: 'Belém',
        cidadeUf: 'PA',
      });
      put.flush(...sucesso());
      await p.recarregarCom([reitoria]);
    });
  });

  describe('recusa da referência de cidade', () => {
    const recusaDaCidade = (corpo: object = {}) =>
      problema(422, {
        code: 'uniplus.cidade_referencia.codigo_ibge_formato_invalido',
        title: 'Cidade inválida',
        ...corpo,
      });

    it('sem errors[], aparece junto ao campo, associada e focada, sem o alerta geral', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDaCidade());
      await p.propagar();
      await p.propagar();

      expect(p.elemento('#cfg-unidade-cidade-erro').textContent).toContain('Cidade inválida');
      expect(campoDaCidade().getAttribute('aria-invalid')).toBe('true');
      expect(campoDaCidade().getAttribute('aria-describedby')).toContain('cfg-unidade-cidade-erro');
      expect(document.activeElement).toBe(campoDaCidade());
      expect(p.fixture.nativeElement.querySelector('ui-drawer ui-alert.alert--danger')).toBeNull();
      expect(p.edicao.erro()).toBeNull();
    });

    it('com errors[], o campo de cidade recusado leva a mensagem do servidor', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(
        ...recusaDaCidade({
          errors: [
            {
              field: 'cidadeCodigoIbge',
              code: 'uniplus.cidade_referencia.codigo_ibge_formato_invalido',
              message: 'Código IBGE inexistente.',
            },
          ],
        }),
      );
      await p.propagar();

      expect(p.elemento('#cfg-unidade-cidade-erro').textContent).toContain(
        'Código IBGE inexistente.',
      );
    });

    const recusarCidade = async (): Promise<void> => {
      p.geo.listarCidades.mockReturnValue(of(okResult([marabaGeo])));
      await p.abrirCadastro();
      await digitar(campoDaCidade(), 'Mar');
      p.elemento<HTMLButtonElement>('.localidade-opcoes button').click();
      await p.propagar();
      (await p.enviar()).flush(...recusaDaCidade());
      await p.propagar();
      expect(p.edicao.erroDaCidade()).toBe('Cidade inválida');
    };

    it('"Trocar cidade" retira a recusa', async () => {
      await recusarCidade();

      p.elemento<HTMLButtonElement>('cfg-unidade-cidade-campo .input-group button').click();
      await p.propagar();
      expect(p.edicao.erroDaCidade()).toBeNull();
      expect(p.fixture.nativeElement.querySelector('#cfg-unidade-cidade-erro')).toBeNull();
    });

    it('o novo envio, que falha por outro motivo, retira a recusa da cidade', async () => {
      await recusarCidade();

      (await p.enviar()).flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();

      expect(p.edicao.erroDaCidade()).toBeNull();
      expect(p.fixture.nativeElement.querySelector('#cfg-unidade-cidade-erro')).toBeNull();
    });

    it('o novo envio barrado localmente retira a recusa da cidade', async () => {
      await recusarCidade();

      p.preencher('nome', '');
      p.edicao.salvar();
      await p.propagar();

      p.http.expectNone(ESCRITA);
      expect(p.edicao.erroDaCidade()).toBeNull();
      expect(p.fixture.nativeElement.querySelector('#cfg-unidade-cidade-erro')).toBeNull();
    });
  });

  describe('unidade superior', () => {
    it('a abertura consulta limit=100 sem q, e a busca digitada vai ao servidor depois do debounce', async () => {
      await p.abrirCadastro();
      await digitar(campoDaSuperior(), 'fora', false);
      p.http.expectNone((r) => r.url === LISTA);
      await esperar(ESPERA_DO_DEBOUNCE_MS);
      await p.propagar();

      const busca = p.http.expectOne((r) => r.url === LISTA && r.params.get('q') === 'fora');
      expect(busca.request.params.get('limit')).toBe('100');
      expect(busca.request.context.get(VENDOR_MIME_TOKEN)).toEqual({
        resource: 'unidade',
        version: 1,
      });
      busca.flush([{ ...instituto, id: 'u-99', sigla: 'FORA', nome: 'Fora da página' }]);
      await p.propagar();
      expect(p.superior.opcoes().map((u) => u.sigla)).toEqual(['FORA']);
      const opcoes = [...p.fixture.nativeElement.querySelectorAll('#cfg-unidade-superior option')];
      expect(opcoes.map((o) => (o as HTMLElement).textContent?.trim())).toContain(
        'FORA — Fora da página',
      );
    });

    it('reabrir o formulário não reusa a busca da abertura anterior', async () => {
      await p.abrirCadastro();
      await digitar(campoDaSuperior(), 'reitoria');
      p.http.expectOne((r) => r.params.get('q') === 'reitoria').flush([reitoria]);
      await p.propagar();

      p.edicao.fechar();
      await p.propagar();
      p.novo().click();
      await p.propagar();

      expect(campoDaSuperior().value).toBe('');
      const reabertura = p.http.expectOne((r) => r.url === LISTA);
      expect(reabertura.request.params.has('q')).toBe(false);
      reabertura.flush([reitoria]);
      await p.propagar();
    });

    it('na edição, a própria unidade não pode ser a superior', async () => {
      await p.abrirEdicao(reitoria);

      const propria = p.elemento<HTMLOptionElement>(
        `#cfg-unidade-superior option[value="${reitoria.id}"]`,
      );
      expect(propria.disabled).toBe(true);
    });

    it('a busca limita o termo a 256 caracteres, o que a API aceita', async () => {
      await p.abrirCadastro();

      expect(campoDaSuperior().maxLength).toBe(256);
    });

    it('a falha da carga avisa com "Tentar novamente", que fica indisponível durante a espera e devolve o foco ao select', async () => {
      p.elemento<HTMLButtonElement>('#cfg-unidades-novo').click();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
      await p.propagar();

      expect(p.erros).toHaveBeenCalledTimes(1);
      const aviso = p.elemento('cfg-unidade-superior-campo [role="alert"]');
      expect(aviso.textContent).toContain('Não foi possível carregar as unidades');
      const tentar = aviso.querySelector('button') as HTMLButtonElement;
      tentar.focus();
      tentar.click();
      await p.propagar();
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      expect(tentar.getAttribute('aria-busy')).toBe('true');
      tentar.click();
      await p.propagar();

      p.http.expectOne((r) => r.url === LISTA).flush([reitoria]);
      await p.propagar();
      await p.propagar();
      expect(p.superior.comErro()).toBe(false);
      expect(document.activeElement).toBe(p.elemento('#cfg-unidade-superior'));
    });

    it('a falha 4xx da carga aparece sem toast', async () => {
      p.elemento<HTMLButtonElement>('#cfg-unidades-novo').click();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(403, { code: 'uniplus.auth.forbidden' }));
      await p.propagar();

      expect(p.elemento('cfg-unidade-superior-campo [role="alert"]')).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
    });
  });

  describe('comando de atualização', () => {
    it('não leva o início da vigência, que é somente leitura na edição', async () => {
      await p.abrirEdicao(reitoria);
      expect(p.campo('vigenciaInicio').readOnly).toBe(true);

      const put = await p.enviar(`${ESCRITA}/${reitoria.id}`);

      expect('vigenciaInicio' in (put.request.body as object)).toBe(false);
      expect(put.request.body).toMatchObject({
        id: reitoria.id,
        sigla: 'REIT',
        tipo: reitoria.tipo,
      });
      put.flush(...sucesso());
      await p.recarregarCom([reitoria]);
    });

    it('o comando de criação leva o corpo inteiro, aparado, com a chave de idempotência', async () => {
      await p.abrirCadastro();
      p.preencher('nome', '  Núcleo de Tecnologia  ');
      const superior = p.elemento<HTMLSelectElement>('#cfg-unidade-superior');
      superior.value = reitoria.id;
      superior.dispatchEvent(new Event('change'));
      p.campo('unidadeAcademica').click();

      const post = await p.enviar();

      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(post.request.body).toMatchObject({
        nome: 'Núcleo de Tecnologia',
        alias: null,
        slug: 'ntec',
        sigla: 'NTEC',
        codigo: '500',
        unidadeSuperiorId: reitoria.id,
        unidadeAcademica: true,
        vigenciaFim: null,
      });
      post.flush(...criado());
      await p.recarregarCom([reitoria]);
    });
  });
});
