import { VENDOR_MIME_TOKEN } from '@uniplus/shared-core/http';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATRASO_DA_BUSCA_EM_MS } from './unidades.store';
import {
  CenarioDaPaginaDeUnidades,
  ESCRITA,
  LISTA,
  criado,
  instituto,
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

  const campoDaSuperior = (): HTMLInputElement =>
    p.elemento('cfg-unidade-superior-campo input[type="search"]');

  describe('unidade superior', () => {
    it('a abertura consulta limit=100 sem q, e a busca digitada vai ao servidor depois do debounce', async () => {
      await p.abrirCadastro();
      await p.digitar(campoDaSuperior(), 'fora');
      await passarOTempo(ATRASO_DA_BUSCA_EM_MS - 1);
      p.http.expectNone((r) => r.url === LISTA);
      await passarOTempo(1);
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
      await p.digitarEAguardarBusca(campoDaSuperior(), 'reitoria');
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
      const tentar = p.elemento<HTMLButtonElement>('cfg-unidade-superior-campo button');
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
      await p.responderAConsultaDasUnidades([reitoria]);
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
      await p.responderAConsultaDasUnidades([reitoria]);
    });
  });
});
