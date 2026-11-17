import { of, Subject } from 'rxjs';
import type { ApiResult } from '@uniplus/shared-core/http';
import type { CidadeResumoDto } from '@uniplus/shared-data/geo';
import {
  errorResult,
  ligarRelogioControlado,
  mockProblemDetails,
  okResult,
  passarOTempo,
} from '@uniplus/shared-testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATRASO_DA_BUSCA_EM_MS } from './unidades.store';
import {
  CenarioDaPaginaDeUnidades,
  ESCRITA,
  belemGeo,
  criado,
  marabaGeo,
  problema,
  reitoria,
  sucesso,
} from './unidades.testing';

describe('UnidadesPage — buscas do formulário', () => {
  let p: CenarioDaPaginaDeUnidades;

  beforeEach(async () => {
    ligarRelogioControlado();
    p = await CenarioDaPaginaDeUnidades.abrir();
  });
  afterEach(() => {
    vi.useRealTimers();
    p.http.verify();
  });

  const campoDaCidade = (): HTMLInputElement => p.elemento('#cfg-unidade-cidade-busca');
  const opcoesDeCidade = (): string[] =>
    [...p.fixture.nativeElement.querySelectorAll('.localidade-opcoes button')].map(
      (b) => (b as HTMLElement).textContent?.trim() ?? '',
    );
  const texto = (): string => p.fixture.nativeElement.textContent;

  describe('cidade', () => {
    it('só busca a partir de 3 letras, com o termo aparado e a janela de 20', async () => {
      await p.abrirCadastro();

      await p.digitarEAguardarBusca(campoDaCidade(), 'Ma');
      expect(p.geo.listarCidades).not.toHaveBeenCalled();

      await p.digitarEAguardarBusca(campoDaCidade(), ' Marabá ');
      expect(p.geo.listarCidades).toHaveBeenCalledWith({ q: 'Marabá', limit: 20 });
    });

    it('a cidade escolhida entra no comando com o trio inteiro', async () => {
      p.geo.listarCidades.mockReturnValue(of(okResult([marabaGeo, belemGeo])));
      await p.abrirCadastro();
      await p.digitarEAguardarBusca(campoDaCidade(), 'Mar');
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
      await p.responderAConsultaDasUnidades([reitoria]);
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
      await p.responderAConsultaDasUnidades([reitoria]);
    });

    it('descarta as opções do termo anterior assim que o campo muda', async () => {
      p.geo.listarCidades.mockReturnValue(of(okResult([marabaGeo])));
      await p.abrirCadastro();
      await p.digitarEAguardarBusca(campoDaCidade(), 'Marab');
      expect(opcoesDeCidade()).toEqual(['Marabá — PA']);

      await p.digitar(campoDaCidade(), 'Belém');

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
      await p.digitarEAguardarBusca(campoDaCidade(), 'Marabá');
      await p.digitarEAguardarBusca(campoDaCidade(), 'Belém');

      respostaMaraba.next(okResult([marabaGeo]));
      respostaBelem.next(okResult([belemGeo]));
      await p.propagar();

      expect(opcoesDeCidade()).toEqual(['Belém — PA']);
    });

    it('anuncia "Consultando" durante a busca e só diz "Nenhuma cidade" depois da resposta vazia', async () => {
      const resposta = new Subject<ApiResult<readonly CidadeResumoDto[]>>();
      p.geo.listarCidades.mockReturnValue(resposta);
      await p.abrirCadastro();

      await p.digitar(campoDaCidade(), 'Xyzxyz');
      await passarOTempo(ATRASO_DA_BUSCA_EM_MS - 1);
      expect(p.geo.listarCidades).not.toHaveBeenCalled();
      expect(texto()).not.toContain('Nenhuma cidade encontrada');

      await passarOTempo(1);
      await p.propagar();
      expect(p.geo.listarCidades).toHaveBeenCalledTimes(1);
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

      await p.digitarEAguardarBusca(campoDaCidade(), 'Marabá');

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

      await p.digitarEAguardarBusca(campoDaCidade(), 'Marabá');

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
      await p.digitarEAguardarBusca(campoDaCidade(), 'Marab');
      expect(texto()).toContain('Termo inválido');
      expect(p.erros).not.toHaveBeenCalled();

      await p.digitar(campoDaCidade(), 'Belém');
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
      await p.digitarEAguardarBusca(campoDaCidade(), 'Marabá');

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
      await p.digitarEAguardarBusca(campoDaCidade(), 'Belém');
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
      await p.digitarEAguardarBusca(campoDaCidade(), 'Belém');
      p.elemento<HTMLButtonElement>('.localidade-opcoes button').click();
      await p.propagar();

      const put = await p.enviar(`${ESCRITA}/${reitoria.id}`);
      expect(put.request.body).toMatchObject({
        cidadeCodigoIbge: '1501402',
        cidadeNome: 'Belém',
        cidadeUf: 'PA',
      });
      put.flush(...sucesso());
      await p.responderAConsultaDasUnidades([reitoria]);
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
      await p.digitarEAguardarBusca(campoDaCidade(), 'Mar');
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
});
