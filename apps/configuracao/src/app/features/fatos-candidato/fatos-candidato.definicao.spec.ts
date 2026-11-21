import { afterEach, describe, expect, it, beforeAll } from 'vitest';
import {
  Pagina,
  montarPagina,
  problema,
  urlDoFato,
  compilarPaginaUmaVez,
} from './fatos-candidato.testing';
import { comDefinicao, comProtecao, corRaca, emManutencao } from './fatos-candidato.fixtures';
import { type FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import {
  campo,
  derivadoBooleano,
  agregadoDeRenda,
  ConducaoDaDefinicao,
} from './fatos-candidato.definicao.testing';

describe('FatosCandidatoPage — definição do fato', () => {
  beforeAll(compilarPaginaUmaVez);
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });

  const abrir = async (fato: FatoCandidatoDto): Promise<void> => {
    p = await montarPagina([fato]);
    await p.abrirEdicao(fato);
  };
  const { enviar, definir, entregar } = new ConducaoDaDefinicao(() => p);

  describe('o que cada tipo de fato envia', () => {
    it('o declarado envia todos os eixos que o tipo de dado aceita, com chave própria', async () => {
      await abrir(corRaca);
      await enviar();

      const pedido = definir(corRaca);
      expect(pedido.request.headers.has('Idempotency-Key')).toBe(true);
      expect(pedido.request.body).toEqual({
        pontoResolucao: 'INSCRICAO',
        classificacaoProtecao: 'SENSIVEL',
        finalidadeTratamento: 'Reserva de vagas.',
        hipoteseLegal: 'CUMPRIMENTO_OBRIGACAO_LEGAL',
        dominio: 'CATEGORICO',
        escopo: 'CANDIDATO',
        cardinalidade: 'ESCALAR',
        fonteValores: 'GLOBAL',
        formato: null,
      });
      await entregar(corRaca, pedido);
    });

    it('os seletores de quantidade de valores e de escopo anunciam a obrigatoriedade', async () => {
      await abrir(corRaca);

      for (const nome of ['cardinalidade', 'escopo']) {
        expect(p.elemento(campo(nome)).getAttribute('aria-required'), nome).toBe('true');
      }
    });

    it('o derivado por regra envia o tipo de dado e o escopo, sem cardinalidade, fonte nem formato', async () => {
      await abrir(derivadoBooleano);
      await enviar();

      const pedido = definir(derivadoBooleano);
      expect(Object.keys(pedido.request.body as object).sort()).toEqual([
        'classificacaoProtecao',
        'dominio',
        'escopo',
        'finalidadeTratamento',
        'hipoteseLegal',
        'pontoResolucao',
      ]);
      await entregar(derivadoBooleano, pedido);
    });

    it('o agregado envia só o ponto de resolução e a proteção, e mostra o fato de membro sem edição', async () => {
      await abrir(agregadoDeRenda);
      await enviar();

      const pedido = definir(agregadoDeRenda);
      expect(Object.keys(pedido.request.body as object).sort()).toEqual([
        'classificacaoProtecao',
        'finalidadeTratamento',
        'hipoteseLegal',
        'pontoResolucao',
      ]);
      const rotulos = [...p.raiz().querySelectorAll('dt')];
      const membro = rotulos.find((dt) => dt.textContent?.trim() === 'Fato de membro resumido');
      expect(membro?.nextElementSibling?.textContent?.trim()).toBe('RENDA');
      expect(p.existe(campo('dominio'))).toBe(false);
      await entregar(agregadoDeRenda, pedido);
    });

    it('o fato de sistema trava a definição e envia só o ponto de resolução atual e a proteção', async () => {
      const sistema = { ...corRaca, semeadoPeloSistema: true };
      await abrir(sistema);
      expect(p.texto()).toContain('Fato de sistema');
      expect(p.existe(campo('classificacaoProtecao'))).toBe(true);
      expect(p.existe(campo('dominio'))).toBe(false);
      expect(p.existe(campo('pontoResolucao'))).toBe(false);
      expect(p.texto()).toContain('Conhecido a partir da fase');
      p.digitar(campo('classificacaoProtecao'), 'PESSOAL');
      p.digitar(campo('hipoteseLegal'), 'EXECUCAO_POLITICAS_PUBLICAS');

      await enviar();

      const pedido = definir(sistema);
      expect(pedido.request.body).toEqual({
        pontoResolucao: 'INSCRICAO',
        classificacaoProtecao: 'PESSOAL',
        finalidadeTratamento: 'Reserva de vagas.',
        hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      });
      await entregar(sistema, pedido);
    });
  });

  describe('os eixos só para leitura', () => {
    it('o agregado mostra o que o tipo não edita, com a origem do valor', async () => {
      await abrir(agregadoDeRenda);

      const lista = p.texto('#cfg-fato-def-derivados');
      expect(lista).toContain('Tipo de dado');
      expect(lista).toContain('De quem é o dado');
      expect(lista).toContain('vem do fato de membro');
      expect(p.existe(campo('dominio'))).toBe(false);
    });

    it('o derivado mostra só para leitura o que sai do tipo de dado', async () => {
      await abrir(derivadoBooleano);

      const lista = p.texto('#cfg-fato-def-derivados');
      expect(lista).toContain('Quantos valores');
      expect(lista).toContain('vem do tipo de dado');
      expect(lista).not.toContain('De quem é o dado');
    });
  });

  describe('os apoios e as dependências entre campos', () => {
    it('o agregado mantém o tipo de dado do servidor e calcula as classificações por ele', async () => {
      const texto = comProtecao(comDefinicao(agregadoDeRenda, { dominio: 'TEXTO' }), {
        classificacao: 'IDENTIFICADOR',
      });
      await abrir(texto);

      p.digitar(campo('finalidadeTratamento'), 'Outra finalidade.');
      await p.propagar();

      expect(p.elemento<HTMLSelectElement>(campo('classificacaoProtecao')).value).toBe(
        'IDENTIFICADOR',
      );
      const opcoes = [
        ...p.raiz().querySelectorAll<HTMLOptionElement>(`${campo('classificacaoProtecao')} option`),
      ];
      expect(opcoes.map((o) => o.value)).not.toContain('PUBLICO');
    });

    it('sem a lista de fases, avisa e, na nova tentativa que dá certo, o foco vai ao campo da fase', async () => {
      p = await montarPagina([derivadoBooleano]);
      await p.acionar(p.editar(derivadoBooleano));
      p.http
        .expectOne(urlDoFato(derivadoBooleano))
        .flush(emManutencao(structuredClone(derivadoBooleano)));
      await p.propagar();
      for (const req of p.http.match((r) => r.url.endsWith('/fases-canonicas'))) {
        req.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      }
      p.atenderApoios();
      await p.propagar();

      await p.acionar(p.botaoPeloTexto('Definição', p.drawerDoFato()) as HTMLButtonElement);
      expect(p.texto()).toContain('Fases não carregadas');
      await p.acionar(p.botaoPeloTexto('Tentar novamente', p.drawerDoFato()) as HTMLButtonElement);
      p.atenderApoios();
      await p.propagar();
      await p.propagar();
      expect(p.texto()).not.toContain('Fases não carregadas');
      expect(document.activeElement).toBe(p.elemento('#cfg-fato-def-pontoResolucao'));
    });
  });
});
