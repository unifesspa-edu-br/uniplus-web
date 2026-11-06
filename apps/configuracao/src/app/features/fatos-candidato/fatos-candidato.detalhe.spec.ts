import { afterEach, describe, expect, it } from 'vitest';
import {
  CATALOGO,
  PERMISSAO_DE_CONSULTAR,
  PERMISSAO_DE_MANTER,
  Pagina,
  comAprovacao,
  corRaca,
  derivado,
  montarPagina,
  problema,
  quilombola,
  urlDoFato,
} from './fatos-candidato.testing';

const categorico = {
  ...corRaca,
  id: '01960000-0000-7000-0000-0000000000b1',
  codigo: 'IDENTIDADE_GENERO',
  nome: 'Identidade de gênero',
  descricao: 'Como o candidato se identifica.',
  classificacaoProtecao: 'PESSOAL',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  valores: [
    {
      codigo: 'MULHER_CIS',
      descricao: 'Mulher cis',
      ordem: 1,
      ativo: true,
      orientacao: 'Marque se a identidade coincide com o sexo de nascimento.',
    },
    { codigo: 'ANTIGO', descricao: 'Valor antigo', ordem: 2, ativo: false, orientacao: null },
  ],
};

const atosDe = (fato: { id: string }) =>
  `http://localhost:5000/api/configuracao/admin/fatos-candidato/${fato.id}/protecao/atos`;

describe('FatosCandidatoPage — detalhe do fato', () => {
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });

  it('abre o drawer só de leitura com os campos, os valores possíveis e a orientação', async () => {
    p = await montarPagina([categorico]);

    await p.acionar(p.nomeDaLinha(categorico));
    p.http.match((r) => r.url === atosDe(categorico)).forEach((r) => r.flush([]));

    expect(p.texto('dialog[aria-label="Detalhe do fato do candidato"] .uni-drawer__title')).toBe(
      'Identidade de gênero',
    );
    const texto = p.texto('dialog[aria-label="Detalhe do fato do candidato"]');
    for (const esperado of [
      'IDENTIDADE_GENERO',
      'Como o candidato se identifica.',
      'Declarado pelo candidato',
      'Lista de valores',
      'MULHER_CIS',
      'Marque se a identidade coincide com o sexo de nascimento.',
      'Valor antigo',
      'Desativado',
      'Pessoal',
      'Execução de políticas públicas',
      'Aprovada',
    ]) {
      expect(texto).toContain(esperado);
    }
    expect(p.detalhe().querySelector('input, textarea')).toBeNull();
  });

  describe('histórico da proteção', () => {
    const ato = {
      ato: 'REPROVACAO',
      instante: '2026-10-31T13:00:00Z',
      atorNome: 'Betina Albuquerque',
      classificacaoProtecao: 'PESSOAL',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      finalidadeTratamento: 'Conferir a renda.',
      classificacaoRecomendada: null,
      justificativa: 'A renda familiar é dado sensível.',
    };

    it('lê os atos só ao abrir o drawer e os mostra a quem consulta', async () => {
      p = await montarPagina([categorico], { concedidas: [PERMISSAO_DE_CONSULTAR] });
      p.http.expectNone(atosDe(categorico));

      await p.acionar(p.nomeDaLinha(categorico));
      p.http.expectOne(atosDe(categorico)).flush([ato]);
      await p.propagar();

      const secao = p.texto('dialog[aria-label="Detalhe do fato do candidato"]');
      for (const esperado of [
        'Histórico da proteção',
        'Reprovação',
        '31/10/2026',
        'Betina Albuquerque',
        'Justificativa: A renda familiar é dado sensível.',
      ]) {
        expect(secao).toContain(esperado);
      }
    });

    it('sem atos diz que o item ainda não passou pela proteção de dados', async () => {
      p = await montarPagina([categorico], { concedidas: [PERMISSAO_DE_CONSULTAR] });

      await p.acionar(p.nomeDaLinha(categorico));
      p.http.expectOne(atosDe(categorico)).flush([]);
      await p.propagar();

      expect(p.texto('dialog[aria-label="Detalhe do fato do candidato"]')).toContain(
        'Este item ainda não passou pela proteção de dados.',
      );
    });

    it('sem a permissão de consultar não mostra a seção nem lê os atos', async () => {
      p = await montarPagina([categorico], { concedidas: [] });

      await p.acionar(p.nomeDaLinha(categorico));

      p.http.expectNone(atosDe(categorico));
      expect(p.texto('dialog[aria-label="Detalhe do fato do candidato"]')).not.toContain(
        'Histórico da proteção',
      );
    });
  });

  describe('regras padrão do derivado', () => {
    const comRegra = {
      ...categorico,
      origem: 'DERIVADO',
      regrasPadrao: [
        {
          contribui: 'MULHER_CIS',
          quando: [[{ fato: 'RENDA', operador: 'MAIOR_IGUAL', valor: 1000 }]],
        },
      ],
    };

    it('mostra as regras em prosa, para quem só consulta também, lendo o catálogo só então', async () => {
      p = await montarPagina([comRegra], { concedidas: [PERMISSAO_DE_CONSULTAR] });
      p.http.expectNone((r) => r.url === CATALOGO);

      await p.acionar(p.nomeDaLinha(comRegra));
      const catalogo = p.http.expectOne((r) => r.url === CATALOGO);
      expect(catalogo.request.headers.get('Accept')).toBe(
        'application/vnd.uniplus.fato-candidato.v1+json',
      );
      catalogo.flush([]);
      p.http.match((r) => r.url === atosDe(comRegra)).forEach((r) => r.flush([]));
      await p.propagar();

      const texto = p.texto('dialog[aria-label="Detalhe do fato do candidato"]');
      expect(texto).toContain('Regras padrão');
      expect(texto).toContain('Contribui "Mulher cis" quando:');
      expect(p.detalhe().querySelector('.form-drawer__footer')?.textContent).not.toContain(
        'Editar',
      );
    });

    it('com o catálogo, cita os fatos pelo nome; o valor sem descrição aparece pelo código', async () => {
      const regra = [{ fato: 'QUILOMBOLA', operador: 'IGUAL', valor: true }];
      const categorica = {
        ...comRegra,
        valores: [
          { codigo: 'SEM_TEXTO', descricao: null, ordem: 0, ativo: true, orientacao: null },
        ],
        regrasPadrao: [{ contribui: 'SEM_TEXTO', quando: [regra] }],
      };
      p = await montarPagina([categorica]);

      await p.acionar(p.nomeDaLinha(categorica));
      p.http.expectOne((r) => r.url === CATALOGO).flush([quilombola]);
      p.http.match((r) => r.url === atosDe(categorica)).forEach((r) => r.flush([]));
      await p.propagar();

      const texto = p.texto('dialog[aria-label="Detalhe do fato do candidato"]');
      expect(texto).toContain('Contribui "SEM_TEXTO" quando:');
      expect(texto).toContain('Quilombola');
    });

    describe('quando o catálogo que nomeia os fatos falha', () => {
      const abrirComFalha = async (status: number): Promise<void> => {
        p = await montarPagina([comRegra]);
        await p.acionar(p.nomeDaLinha(comRegra));
        p.http
          .expectOne((r) => r.url === CATALOGO)
          .flush(...problema(status, { code: 'uniplus.internal.unexpected' }));
        p.http.match((r) => r.url === atosDe(comRegra)).forEach((r) => r.flush([]));
        await p.propagar();
      };
      const tentar = (): HTMLButtonElement =>
        p.botaoPeloTexto('Tentar novamente', p.detalhe()) as HTMLButtonElement;

      it('avisa no detalhe que as regras aparecem com códigos, e a falha do servidor também vira toast', async () => {
        await abrirComFalha(500);

        expect(p.texto('dialog[aria-label="Detalhe do fato do candidato"]')).toContain(
          'Os nomes dos fatos não foram carregados',
        );
        expect(p.erros).toHaveBeenCalledTimes(1);
      });

      it('a falha 4xx não vira toast', async () => {
        await abrirComFalha(404);

        expect(tentar()).toBeDefined();
        expect(p.erros).not.toHaveBeenCalled();
      });

      it('"Tentar novamente" relê o catálogo e, dando certo, tira o aviso e leva o foco às regras', async () => {
        await abrirComFalha(404);

        await p.acionar(tentar());
        expect(tentar().getAttribute('aria-disabled')).toBe('true');
        p.http.expectOne((r) => r.url === CATALOGO).flush([quilombola]);
        await p.propagar();

        expect(p.botaoPeloTexto('Tentar novamente', p.detalhe())).toBeUndefined();
        expect(document.activeElement).toBe(p.elemento('#cfg-fato-detalhe-regras'));
      });

      it('uma nova falha mantém o aviso e o foco no botão', async () => {
        await abrirComFalha(404);

        await p.acionar(tentar());
        p.http
          .expectOne((r) => r.url === CATALOGO)
          .flush(...problema(404, { code: 'uniplus.internal.unexpected' }));
        await p.propagar();

        expect(document.activeElement).toBe(tentar());
      });
    });

    it('a regra que não contribui valor vale "sim"', async () => {
      const booleana = {
        ...comRegra,
        dominio: 'BOOLEANO',
        valores: [],
        regrasPadrao: [
          { contribui: null, quando: [[{ fato: 'RENDA', operador: 'MAIOR_IGUAL', valor: 1000 }]] },
        ],
      };
      p = await montarPagina([booleana]);

      await p.acionar(p.nomeDaLinha(booleana));
      p.http.expectOne((r) => r.url === CATALOGO).flush([]);
      p.http.match((r) => r.url === atosDe(booleana)).forEach((r) => r.flush([]));
      await p.propagar();

      expect(p.texto('dialog[aria-label="Detalhe do fato do candidato"]')).toContain(
        'É "sim" quando:',
      );
    });

    it('um derivado sem regra não lê o catálogo', async () => {
      p = await montarPagina([derivado]);

      await p.acionar(p.nomeDaLinha(derivado));
      p.http.match((r) => r.url === atosDe(derivado)).forEach((r) => r.flush([]));

      p.http.expectNone((r) => r.url === CATALOGO);
    });
  });

  it('no fato reprovado mostra a justificativa e oferece "Editar", sem "Aceitar recomendação"', async () => {
    p = await montarPagina([comAprovacao(categorico, 'REPROVADA', null, 'Falta base legal.')]);

    await p.acionar(p.nomeDaLinha(categorico));
    p.http.match((r) => r.url === atosDe(categorico)).forEach((r) => r.flush([]));

    expect(p.texto('dialog[aria-label="Detalhe do fato do candidato"]')).toContain(
      'Justificativa: Falta base legal.',
    );
    const rodape = [...p.detalhe().querySelectorAll('.form-drawer__footer button')].map((b) =>
      b.textContent?.trim(),
    );
    expect(rodape).toEqual(['Fechar', 'Editar']);
  });

  it('"Editar" fecha o detalhe e abre a edição do mesmo fato', async () => {
    p = await montarPagina([categorico]);
    await p.acionar(p.nomeDaLinha(categorico));
    p.http.match((r) => r.url === atosDe(categorico)).forEach((r) => r.flush([]));

    await p.acionar(p.botaoPeloTexto('Editar', p.detalhe()) as HTMLButtonElement);

    expect(p.detalhe().open).toBe(false);
    expect(p.drawerDoFato().open).toBe(true);
    p.http.expectOne(urlDoFato(categorico)).flush(categorico);
    await p.propagar();
    expect(p.edicao.modo()).toBe('editar');
    expect(p.editor.leitura.id()).toBe(categorico.id);
  });

  it('com a lista carregando ou gravando, "Editar" e "Aceitar recomendação" ficam indisponíveis', async () => {
    p = await montarPagina([comAprovacao(categorico, 'AJUSTE_RECOMENDADO', 'SENSIVEL')], {
      concedidas: [PERMISSAO_DE_MANTER],
    });
    await p.acionar(p.nomeDaLinha(categorico));
    p.http.match((r) => r.url === atosDe(categorico)).forEach((r) => r.flush([]));

    p.store.recarregar();
    await p.propagar();

    expect(
      (p.botaoPeloTexto('Editar', p.detalhe()) as HTMLButtonElement).matches(':disabled'),
    ).toBe(true);
    expect(
      (p.botaoPeloTexto('Aceitar recomendação', p.detalhe()) as HTMLButtonElement).matches(
        ':disabled',
      ),
    ).toBe(true);
    p.http
      .expectOne((r) => r.method === 'GET' && r.url.endsWith('/admin/fatos-candidato'))
      .flush([categorico]);
    await p.propagar();
  });
});
