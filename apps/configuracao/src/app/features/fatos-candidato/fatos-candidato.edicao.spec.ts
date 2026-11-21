import { TestBed } from '@angular/core/testing';
import { AnuncioDaConclusao } from '@uniplus/shared-ui/components';
import { afterEach, describe, expect, it, vi, beforeAll } from 'vitest';
import {
  Pagina,
  montarPagina,
  problema,
  recusaDeCampo,
  sucesso,
  urlDoFato,
  compilarPaginaUmaVez,
} from './fatos-candidato.testing';
import { corRaca, emManutencao } from './fatos-candidato.fixtures';
import type { FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { campo, DESCRITIVO, ConducaoDoDescritivo } from './fatos-candidato.edicao.testing';

describe('FatosCandidatoPage — edição do fato: nome, descrição e componente', () => {
  beforeAll(compilarPaginaUmaVez);
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });
  const { salvarDescritivo, putDoFato } = new ConducaoDoDescritivo(() => p);

  it('a edição é integral e o componente vazio vai como nulo', async () => {
    const fato: FatoCandidatoDto = {
      ...corRaca,
      descritivo: { ...corRaca.descritivo, componenteExibicao: 'MOEDA' },
    };
    p = await montarPagina([fato]);
    await p.abrirEdicao(fato);
    const select = p.elemento<HTMLSelectElement>(campo('componenteExibicao'));
    expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
      'Padrão (pelo tipo do dado)',
      'Moeda',
      'Situação',
    ]);
    expect(select.value).toBe('MOEDA');

    await salvarDescritivo();
    const mantido = putDoFato();
    expect(mantido.request.headers.has('Idempotency-Key')).toBe(true);
    expect(mantido.request.body).toEqual({
      nome: 'Cor ou raça',
      descricao: 'Cor ou raça autodeclarada.',
      componenteExibicao: 'MOEDA',
    });
    mantido.flush(...sucesso());
    await p.recarregarOFato(fato);
    expect(p.sucessos).toHaveBeenCalledTimes(1);

    p.digitar(`${DESCRITIVO} ${campo('componenteExibicao')}`, '');
    await salvarDescritivo();
    const limpo = putDoFato();
    expect(limpo.request.body).toMatchObject({ componenteExibicao: null });
    limpo.flush(...sucesso());
    await p.recarregarOFato(fato);
  });

  it('o clique no botão de salvar habilitado não é barrado e envia o formulário', async () => {
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca);
    const botao = p.botaoPeloTexto('Salvar nome, descrição e componente') as HTMLButtonElement;

    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    botao.dispatchEvent(clique);
    await p.propagar();

    expect(clique.defaultPrevented).toBe(false);
    p.submeter(DESCRITIVO);
    putDoFato().flush(...sucesso());
    await p.recarregarOFato(corRaca);
  });

  it('a descrição em branco não salva, é anunciada como obrigatória e leva o foco ao campo', async () => {
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca);
    p.digitar(`${DESCRITIVO} ${campo('descricao')}`, '   ');

    await salvarDescritivo();

    p.http.expectNone((r) => r.method === 'PUT');
    const area = p.elemento(`${DESCRITIVO} ${campo('descricao')}`);
    expect(area.getAttribute('aria-required')).toBe('true');
    expect(area.getAttribute('aria-invalid')).toBe('true');
    expect(p.texto(`#${area.getAttribute('aria-describedby')}`)).not.toBe('');
    expect(document.activeElement).toBe(area);
  });

  it('o fato sem descrição abre com o campo vazio e obrigatório, sem quebrar a validação', async () => {
    const semDescricao: FatoCandidatoDto = {
      ...corRaca,
      descritivo: { ...corRaca.descritivo, descricao: '' },
    };
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca, semDescricao);

    const area = p.elemento<HTMLTextAreaElement>(`${DESCRITIVO} ${campo('descricao')}`);
    expect(area.value).toBe('');
    await salvarDescritivo();
    expect(area.getAttribute('aria-invalid')).toBe('true');
  });

  it('limita nome e descrição ao tamanho aceito pela API', async () => {
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca);
    p.digitar(`${DESCRITIVO} ${campo('nome')}`, 'a'.repeat(201));
    p.digitar(`${DESCRITIVO} ${campo('descricao')}`, 'a'.repeat(1001));

    await salvarDescritivo();

    p.http.expectNone((r) => r.method === 'PUT');
    expect(p.elemento(`${DESCRITIVO} ${campo('nome')}`).getAttribute('aria-invalid')).toBe('true');
    expect(p.elemento(`${DESCRITIVO} ${campo('descricao')}`).getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('a recusa de campo chega ao campo, com foco, e não vira toast', async () => {
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca);
    await salvarDescritivo();

    putDoFato().flush(...recusaDeCampo('nome', 'Nome já usado.'));
    await p.propagar();

    expect(p.texto('#cfg-fato-ed-nome-erro')).toBe('Nome já usado.');
    expect(p.elemento(`${DESCRITIVO} ${campo('nome')}`).getAttribute('aria-describedby')).toBe(
      'cfg-fato-ed-nome-erro',
    );
    expect(document.activeElement).toBe(p.elemento(`${DESCRITIVO} ${campo('nome')}`));
    expect(p.erros).not.toHaveBeenCalled();
  });

  it('a falha do servidor (5xx) avisa por toast e mantém a edição', async () => {
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca);
    await salvarDescritivo();

    putDoFato().flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(p.drawerDoFato().open).toBe(true);
  });

  it('o envio por Enter com a resposta 500 não duplica a escrita e devolve o foco', async () => {
    p = await montarPagina([corRaca]);
    await p.abrirEdicao(corRaca);
    const nome = p.elemento<HTMLInputElement>(`${DESCRITIVO} ${campo('nome')}`);
    nome.focus();

    p.submeter(DESCRITIVO);
    p.submeter(DESCRITIVO);
    await p.propagar();
    const pedidos = p.http.match((r) => r.method === 'PUT' && r.url === urlDoFato(corRaca));
    expect(pedidos).toHaveLength(1);
    pedidos[0].flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(p.elemento(DESCRITIVO).contains(document.activeElement)).toBe(true);
  });

  it('o "Fechar" do rodapé fecha o drawer e devolve o foco ao Editar da linha', async () => {
    p = await montarPagina([corRaca]);
    await p.editar(corRaca).focus();
    await p.abrirEdicao(corRaca);

    await p.acionar(
      p.botaoPeloTexto('Fechar', p.elemento('.form-drawer__footer')) as HTMLButtonElement,
    );

    expect(p.drawerDoFato().open).toBe(false);
    expect(document.activeElement).toBe(p.editar(corRaca));
  });

  describe('a falha ao ler o fato', () => {
    const falharALeitura = async (): Promise<void> => {
      p = await montarPagina([corRaca]);
      await p.acionar(p.editar(corRaca));
      expect(p.texto()).toContain('Carregando o fato');
      p.http
        .expectOne(urlDoFato(corRaca))
        .flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
    };

    it('troca o formulário pelo alerta, avisa por toast e leva o foco ao alerta', async () => {
      await falharALeitura();

      expect(p.texto()).toContain('Não foi possível carregar o fato');
      expect(p.existe(DESCRITIVO)).toBe(false);
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(p.elemento('#cfg-fato-erro-de-carga'));
    });

    const tentarNovamente = (): HTMLButtonElement =>
      p.botaoPeloTexto('Tentar novamente', p.drawerDoFato()) as HTMLButtonElement;

    it('"Tentar novamente" relê o fato e, dando certo, devolve o formulário com o foco no início da edição', async () => {
      await falharALeitura();

      await p.acionar(tentarNovamente());
      p.http.expectOne(urlDoFato(corRaca)).flush(emManutencao(structuredClone(corRaca)));
      p.atenderApoios();
      await p.propagar();

      expect(p.existe(DESCRITIVO)).toBe(true);
      expect(p.texto()).not.toContain('Não foi possível carregar o fato');
      expect(document.activeElement).toBe(p.elemento('#cfg-fato-edicao-inicio'));
    });

    it('o fato que não existe mais mostra a recusa, sem nova tentativa e sem toast', async () => {
      p = await montarPagina([corRaca]);
      await p.acionar(p.editar(corRaca));
      p.http
        .expectOne(urlDoFato(corRaca))
        .flush(...problema(404, { code: 'uniplus.configuracao.fato_candidato.nao_encontrado' }));
      await p.propagar();

      expect(p.texto()).toContain('Fato não encontrado');
      expect(p.botaoPeloTexto('Tentar novamente', p.drawerDoFato())).toBeUndefined();
      expect(p.botaoPeloTexto('Fechar', p.drawerDoFato())).toBeDefined();
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('a nova falha de leitura com o foco no "Tentar novamente" mantém o foco no botão', async () => {
      await falharALeitura();
      const botao = tentarNovamente();
      botao.focus();

      botao.click();
      await p.propagar();
      p.http.expectOne(urlDoFato(corRaca)).error(new ProgressEvent('error'));
      await p.propagar();
      await p.propagar();

      expect(p.texto()).toContain('Não foi possível carregar o fato');
      expect(document.activeElement).toBe(tentarNovamente());
    });

    it('a nova tentativa que termina em fato inexistente não anuncia leitura concluída', async () => {
      await falharALeitura();
      const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');

      tentarNovamente().click();
      await p.propagar();
      p.http
        .expectOne(urlDoFato(corRaca))
        .flush(...problema(404, { code: 'uniplus.configuracao.fato_candidato.nao_encontrado' }));
      await p.propagar();
      await p.propagar();

      expect(p.texto()).toContain('Fato não encontrado');
      expect(anunciar).not.toHaveBeenCalled();
    });
  });

  describe('o fato de sistema', () => {
    const sistema: FatoCandidatoDto = {
      ...corRaca,
      semeadoPeloSistema: true,
      descritivo: { ...corRaca.descritivo, componenteExibicao: 'SITUACAO' },
    };

    it('tem nome, descrição e componente editáveis, e o aviso cita os quatro itens', async () => {
      p = await montarPagina([sistema]);
      await p.abrirEdicao(sistema);

      expect(p.texto()).toContain(
        'Só o nome, a descrição, o componente de exibição e a proteção de dados podem ser alterados',
      );
      expect(p.elemento<HTMLSelectElement>(campo('componenteExibicao')).disabled).toBe(false);
      expect(p.elemento<HTMLTextAreaElement>(`${DESCRITIVO} ${campo('descricao')}`).readOnly).toBe(
        false,
      );
      expect(p.texto('.cfg-fato-definicao')).toContain('Situação');
    });

    it('mostra os valores só para leitura', async () => {
      p = await montarPagina([sistema]);
      await p.abrirEdicao(sistema);

      expect(p.texto()).toContain('PRETA');
      expect(p.texto()).not.toContain('Acrescentar valor');
      expect(p.existe('[id$="-acao"]')).toBe(false);
    });

    it('mostra o rótulo do padrão quando não há componente declarado', async () => {
      const padrao: FatoCandidatoDto = {
        ...sistema,
        descritivo: { ...sistema.descritivo, componenteExibicao: null },
      };
      p = await montarPagina([padrao]);
      await p.abrirEdicao(padrao);

      expect(p.texto('.cfg-fato-definicao')).toContain(
        'Componente de exibiçãoPadrão (pelo tipo do dado)',
      );
    });
  });
});
