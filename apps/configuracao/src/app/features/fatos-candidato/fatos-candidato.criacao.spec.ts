import { afterEach, describe, expect, it, beforeAll } from 'vitest';
import {
  LISTA,
  Pagina,
  montarPagina,
  problema,
  recusaDeCampo,
  compilarPaginaUmaVez,
} from './fatos-candidato.testing';
import { quilombola, noCatalogo } from './fatos-candidato.fixtures';
import {
  campo,
  PREENCHIMENTO_DO_DERIVADO,
  ConducaoDaCriacao,
} from './fatos-candidato.criacao.testing';

describe('FatosCandidatoPage — criação do fato', () => {
  beforeAll(compilarPaginaUmaVez);
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });
  const { preencher, escolherTipo, entregar, criar } = new ConducaoDaCriacao(() => p);

  it('"Novo fato" abre o drawer de criação com as três opções num só grupo de rádio', async () => {
    p = await montarPagina([]);

    await p.abrirCriacao();

    expect(p.drawerDoFato().open).toBe(true);
    const radios = [
      ...p.raiz().querySelectorAll<HTMLInputElement>('input[type="radio"][formcontrolname="tipo"]'),
    ];
    expect(radios.map((r) => r.value)).toEqual(['DECLARADO', 'DERIVADO', 'AGREGADO']);
    expect(radios.map((r) => r.name)).toEqual(['tipo', 'tipo', 'tipo']);
    expect(p.edicao.modo()).toBe('criar');
  });

  it('sem a lista de fases, avisa e oferece tentar de novo em vez de um campo vazio', async () => {
    p = await montarPagina([]);
    await p.acionar(p.novo());
    for (const req of p.http.match((r) => r.url.endsWith('/fases-canonicas'))) {
      req.flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    }
    await p.propagar();

    expect(p.texto()).toContain('Fases não carregadas');
    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(p.elemento<HTMLSelectElement>('#cfg-fato-pontoResolucao').options).toHaveLength(1);

    await p.acionar(p.botaoPeloTexto('Tentar novamente') as HTMLButtonElement);
    p.atenderApoios();
    await p.propagar();
    await p.propagar();
    expect(p.texto()).not.toContain('Fases não carregadas');
    expect(document.activeElement).toBe(p.elemento('#cfg-fato-pontoResolucao'));
  });

  it('o catálogo só é pedido ao escolher o agregado', async () => {
    p = await montarPagina([]);
    await p.abrirCriacao();
    p.http.expectNone((r) => r.url.endsWith('/api/configuracao/fatos-candidato'));

    await p.acionar(p.elemento('input[type="radio"][value="AGREGADO"]'));

    p.http.expectOne((r) => r.url.endsWith('/api/configuracao/fatos-candidato')).flush([]);
    await p.propagar();
  });

  it('sem o catálogo de fatos, avisa e, na nova tentativa que dá certo, o foco vai ao fato de membro', async () => {
    p = await montarPagina([]);
    await p.abrirCriacao();
    await p.acionar(p.elemento('input[type="radio"][value="AGREGADO"]'));
    p.http
      .expectOne((r) => r.url.endsWith('/api/configuracao/fatos-candidato'))
      .flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();
    expect(p.texto()).toContain('Fatos de membro não carregados');

    await p.acionar(p.botaoPeloTexto('Tentar novamente') as HTMLButtonElement);

    p.http.expectOne((r) => r.url.endsWith('/api/configuracao/fatos-candidato')).flush([]);
    await p.propagar();
    await p.propagar();

    expect(p.texto()).not.toContain('Fatos de membro não carregados');
    expect(document.activeElement).toBe(p.elemento('#cfg-fato-fatoDeMembro'));
  });

  describe('a descrição e os limites', () => {
    it('a descrição é obrigatória: em branco não envia, anuncia a obrigatoriedade e leva o foco ao campo', async () => {
      p = await montarPagina([]);
      await p.abrirCriacao();
      await escolherTipo('DERIVADO');
      preencher({ nome: 'Perfil socioeconômico', codigo: 'PERFIL', descricao: '  ' });

      await criar();

      p.http.expectNone(`${LISTA}/derivados`);
      const textarea = p.elemento(campo('descricao'));
      expect(p.texto('#cfg-fato-descricao-erro')).not.toBe('');
      expect(textarea.getAttribute('aria-required')).toBe('true');
      expect(textarea.getAttribute('aria-invalid')).toBe('true');
      expect(textarea.getAttribute('aria-describedby')).toBe('cfg-fato-descricao-erro');
    });

    it('o envio bloqueado leva o foco ao primeiro campo inválido', async () => {
      p = await montarPagina([]);
      await p.abrirCriacao();
      await escolherTipo('DERIVADO');
      preencher({ codigo: 'PERFIL' });

      await criar();

      p.http.expectNone(`${LISTA}/derivados`);
      expect(document.activeElement).toBe(p.elemento(campo('nome')));
    });

    it('limita nome, descrição e finalidade ao tamanho aceito pela API', async () => {
      p = await montarPagina([]);
      await p.abrirCriacao();
      await escolherTipo('DERIVADO');
      const excedente = (n: number): string => 'a'.repeat(n + 1);
      preencher({
        ...PREENCHIMENTO_DO_DERIVADO,
        nome: excedente(200),
        descricao: excedente(1000),
        finalidadeTratamento: excedente(500),
      });

      await criar();

      p.http.expectNone(`${LISTA}/derivados`);
      for (const nome of ['nome', 'descricao', 'finalidadeTratamento']) {
        expect(p.elemento(campo(nome)).getAttribute('aria-invalid'), nome).toBe('true');
      }
    });
  });

  it('o agregado vai à API com o fato de membro, sem tipo de dado nem escopo, e a recusa do membro chega ao campo', async () => {
    p = await montarPagina([]);
    await p.abrirCriacao();
    await p.acionar(p.elemento('input[type="radio"][value="AGREGADO"]'));
    p.http
      .expectOne((r) => r.url.endsWith('/api/configuracao/fatos-candidato'))
      .flush([
        noCatalogo({
          ...quilombola,
          codigo: 'MEMBRO_TRABALHA',
          nome: 'Membro trabalha',
          binding: 'CAMPO_FORMULARIO:MEMBRO_TRABALHA',
          escopo: 'MEMBRO_GRUPO',
        }),
      ]);
    p.atenderApoios();
    await p.propagar();
    preencher({
      nome: 'Família com quem trabalha',
      descricao: 'Há alguém da família que trabalha.',
      codigo: 'FAMILIA_TRABALHA',
      fatoDeMembro: 'MEMBRO_TRABALHA',
      pontoResolucao: 'INSCRICAO',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Avaliar a renda familiar.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    });

    await criar();

    const pedido = p.http.expectOne(`${LISTA}/agregados`);
    expect(pedido.request.body).toEqual({
      codigo: 'FAMILIA_TRABALHA',
      nome: 'Família com quem trabalha',
      descricao: 'Há alguém da família que trabalha.',
      componenteExibicao: null,
      fatoDeMembro: 'MEMBRO_TRABALHA',
      pontoResolucao: 'INSCRICAO',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Avaliar a renda familiar.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    });
    expect(pedido.request.headers.has('Idempotency-Key')).toBe(true);
    pedido.flush(...recusaDeCampo('fatoDeMembro', 'O fato está desativado.'));
    await p.propagar();

    expect(p.texto('#cfg-fato-fatoDeMembro-erro')).toBe('O fato está desativado.');
  });

  it('os seletores de quantidade de valores e de escopo, marcados como obrigatórios, anunciam a obrigatoriedade', async () => {
    p = await montarPagina([]);
    await p.abrirCriacao();
    await escolherTipo('DECLARADO');

    for (const nome of ['cardinalidade', 'escopo']) {
      expect(p.elemento(campo(nome)).getAttribute('aria-required'), nome).toBe('true');
    }
  });

  it('o declarado vai à API com a cardinalidade, e só os domínios com lista levam a fonte de valores', async () => {
    p = await montarPagina([]);
    await p.abrirCriacao();
    await escolherTipo('DECLARADO');
    preencher({ ...PREENCHIMENTO_DO_DERIVADO, dominio: 'CATEGORICO' });
    await p.propagar();
    expect(p.existe(campo('fonteValores'))).toBe(true);
    p.digitar(campo('fonteValores'), 'GLOBAL');

    await criar();

    const pedido = p.http.expectOne(LISTA);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toMatchObject({
      cardinalidade: 'ESCALAR',
      dominio: 'CATEGORICO',
      fonteValores: 'GLOBAL',
      formato: null,
    });
    await entregar(pedido);
  });
});
