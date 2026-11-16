import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CenaDaPagina,
  URL_DAS_UNIDADES,
  URL_DA_LISTA,
  faseAvaliacaoSeed,
  faseRecursoSeed,
  montarPagina,
  nomesDeBotoes,
  propagar,
  responderLista,
  verificarRequisicoesDaPagina,
} from './fases-canonicas.testing';

describe('FasesCanonicasPage — lista', () => {
  let cena: CenaDaPagina;

  beforeEach(() => {
    cena = montarPagina();
  });

  afterEach(() => verificarRequisicoesDaPagina(cena));

  it('CA-12: renderiza a lista de fases canônicas', async () => {
    await responderLista(cena, [faseAvaliacaoSeed]);
    expect(cena.store.fases()).toHaveLength(1);
    cena.fixture.detectChanges();
    expect(cena.fixture.nativeElement.textContent).toContain('Avaliação');
    expect(cena.fixture.nativeElement.textContent).toContain('AVALIACAO');
  });

  it('CA-01/CA-03: o cabeçalho não oferece a ação "Nova fase canônica"', async () => {
    await responderLista(cena, [faseAvaliacaoSeed]);
    cena.fixture.detectChanges();
    const nomes = nomesDeBotoes(cena);
    expect(nomes).not.toContain('Nova fase canônica');
    expect(nomes).not.toContain('Criar fase canônica');
  });

  it('CA-02/CA-16: o estado vazio informa sem sugerir cadastro da primeira fase', async () => {
    await responderLista(cena, []);
    cena.fixture.detectChanges();
    const texto: string = cena.fixture.nativeElement.textContent;
    expect(texto).toContain('catálogo de fases é definido institucionalmente');
    expect(texto).not.toMatch(/cadastr\w+ a primeira/iu);
    expect(nomesDeBotoes(cena)).not.toContain('Nova fase canônica');
  });

  it('CA-10/CA-11: o aviso remete ao catálogo institucional e não orienta a criar uma nova entrada', async () => {
    await responderLista(cena, []);
    cena.fixture.detectChanges();
    const texto: string = cena.fixture.nativeElement.textContent;
    expect(texto).toContain('Códigos definidos pelo catálogo institucional');
    expect(texto).not.toContain('crie uma nova entrada');
  });

  it('CA-13: a busca filtra os registros carregados pelo código', async () => {
    const faseMatricula: FaseCanonicaDto = { ...faseAvaliacaoSeed, id: 'f2', codigo: 'MATRICULA' };
    await responderLista(cena, [faseAvaliacaoSeed, faseMatricula]);

    cena.store.termoBusca.set('matric');
    expect(cena.store.fasesFiltradas()).toEqual([faseMatricula]);
  });

  it('navega pelo cursor e volta à primeira página ao recarregar', async () => {
    const primeira = cena.controller.expectOne((r) => r.url === URL_DA_LISTA);
    primeira.flush([faseAvaliacaoSeed], {
      headers: {
        Link: '</api/configuracao/fases-canonicas?cursor=abc&direction=next>; rel="next"',
      },
    });
    cena.controller.match((r) => r.url === URL_DAS_UNIDADES).forEach((r) => r.flush([]));
    await propagar(cena);

    cena.store.proximaPagina();
    await propagar(cena);
    const segunda = cena.controller.expectOne((r) => r.url === URL_DA_LISTA);
    expect(segunda.request.params.get('cursor')).toBe('abc');
    expect(segunda.request.params.get('direction')).toBe('next');
    segunda.flush([faseRecursoSeed]);
    await propagar(cena);
    expect(cena.store.fases()).toEqual([faseRecursoSeed]);

    cena.store.recarregar();
    await propagar(cena);
    const recarga = cena.controller.expectOne((r) => r.url === URL_DA_LISTA);
    expect(recarga.request.params.get('limit')).toBe('50');
    expect(recarga.request.params.has('cursor')).toBe(false);
    recarga.flush([faseAvaliacaoSeed]);
    await propagar(cena);
    expect(cena.store.fases()).toEqual([faseAvaliacaoSeed]);
  });

  it('CA-10: aviso de código do catálogo é visível mesmo com lista vazia', async () => {
    await responderLista(cena, []);
    cena.fixture.detectChanges();
    expect(cena.fixture.nativeElement.textContent).toContain(
      'Códigos definidos pelo catálogo institucional',
    );
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await responderLista(cena, [faseAvaliacaoSeed]);
    cena.fixture.detectChanges();

    const caption = cena.fixture.nativeElement.querySelector('table > caption');
    // Sem `sr-only` a legenda vira texto visível acima da tabela e quebra o layout.
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Fases canônicas, com unidade sugerida, agrupamento de etapas e permissão de complementação documental',
    );
  });
});
