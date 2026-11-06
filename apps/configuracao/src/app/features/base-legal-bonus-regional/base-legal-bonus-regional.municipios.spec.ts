import { buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CIDADES_URL,
  ESCRITA,
  ITUPIRANGA,
  MARABA,
  Pagina,
  corpoDaFalha,
  montarPagina,
  portaria,
  problema,
} from './base-legal-bonus-regional.testing';

/** Mais que a espera da digitação, para o pedido de busca sair. */
const ESPERA_DA_BUSCA_EM_MS = 350;

describe('BaseLegalBonusRegionalPage — escolha dos municípios', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina([portaria]);
    p.edicao.abrirCadastro();
    await p.propagar();
  });
  afterEach(() => p.http.verify());

  const digitar = async (termo: string): Promise<void> => {
    p.buscaDeMunicipio().value = termo;
    p.buscaDeMunicipio().dispatchEvent(new Event('input'));
    await p.propagar();
  };
  const esperarABusca = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, ESPERA_DA_BUSCA_EM_MS));
  };
  const resultados = (): HTMLButtonElement[] => [
    ...p.fixture.nativeElement.querySelectorAll('.cfg-municipio-resultados button'),
  ];
  const selecionados = (): string[] =>
    [...p.fixture.nativeElement.querySelectorAll('.cfg-municipio-selecionados li span')].map(
      (item: HTMLElement) => item.textContent?.trim() ?? '',
    );

  it('só busca a partir de 3 caracteres, depois da espera da digitação', async () => {
    await digitar('Ma');
    await esperarABusca();
    p.http.expectNone((r) => r.url === CIDADES_URL);

    await digitar('Marabá');
    p.http.expectNone((r) => r.url === CIDADES_URL);
    await esperarABusca();
    const pedido = p.http.expectOne((r) => r.url === CIDADES_URL);
    expect(pedido.request.params.get('q')).toBe('Marabá');
    expect(pedido.request.params.get('limit')).toBe('20');
    expect(pedido.request.headers.get('Accept')).toBe(buildVendorMimeAccept('cidade', 1));
    pedido.flush([MARABA]);
    await p.propagar();
    expect(resultados().map((b) => b.textContent?.trim())).toEqual(['Marabá — PA']);
  });

  it('anuncia a busca em curso e, sem resultado, diz que não há município', async () => {
    await digitar('Zzzz');
    await esperarABusca();
    expect(p.elemento('cfg-campo-de-municipios .list-state__loading').textContent).toContain(
      'Buscando',
    );

    p.http.expectOne((r) => r.url === CIDADES_URL).flush([]);
    await p.propagar();
    expect(p.elemento('cfg-campo-de-municipios').textContent).toContain(
      'Nenhum município encontrado.',
    );
  });

  it('escolher um resultado o move para os selecionados e limpa a busca', async () => {
    await digitar('Marabá');
    await esperarABusca();
    p.http.expectOne((r) => r.url === CIDADES_URL).flush([MARABA, ITUPIRANGA]);
    await p.propagar();

    resultados()[0].click();
    await p.propagar();

    expect(selecionados()).toEqual(['Marabá — PA']);
    expect(p.buscaDeMunicipio().value).toBe('');
    expect(resultados()).toEqual([]);
    expect(p.elemento('cfg-campo-de-municipios').textContent).not.toContain(
      'Nenhum município adicionado ainda.',
    );
  });

  it('não oferece de novo o município que já foi escolhido', async () => {
    p.municipios.adicionar(MARABA);
    await digitar('Marabá');
    await esperarABusca();
    p.http.expectOne((r) => r.url === CIDADES_URL).flush([MARABA, ITUPIRANGA]);
    await p.propagar();

    expect(resultados().map((b) => b.textContent?.trim())).toEqual(['Itupiranga — PA']);
  });

  it('"Remover" tira o município escolhido e passa a apontar a falta quando era o único', async () => {
    p.municipios.adicionar(MARABA);
    await p.propagar();

    p.elemento<HTMLButtonElement>('button[aria-label="Remover Marabá"]').click();
    await p.propagar();

    expect(selecionados()).toEqual([]);
    expect(p.elemento('#cfg-blbr-municipios-erro').textContent?.trim()).toBe(
      'Adicione ao menos um município.',
    );
  });

  it('Enter na busca não envia o formulário', async () => {
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    p.buscaDeMunicipio().dispatchEvent(enter);
    await p.propagar();

    expect(enter.defaultPrevented).toBe(true);
    p.http.expectNone(ESCRITA);
  });

  it('escolher um resultado devolve o foco à busca', async () => {
    await digitar('Marabá');
    await esperarABusca();
    p.http.expectOne((r) => r.url === CIDADES_URL).flush([MARABA]);
    await p.propagar();

    resultados()[0].click();
    await p.propagar();

    expect(document.activeElement).toBe(p.buscaDeMunicipio());
  });

  it('remover leva o foco ao "Remover" seguinte e, sendo o último, à busca', async () => {
    p.municipios.adicionar(MARABA);
    p.municipios.adicionar(ITUPIRANGA);
    await p.propagar();

    p.elemento<HTMLButtonElement>('button[aria-label="Remover Marabá"]').click();
    await p.propagar();
    expect(document.activeElement).toBe(
      p.elemento<HTMLButtonElement>('button[aria-label="Remover Itupiranga"]'),
    );

    p.elemento<HTMLButtonElement>('button[aria-label="Remover Itupiranga"]').click();
    await p.propagar();
    expect(document.activeElement).toBe(p.buscaDeMunicipio());
  });

  it('remover um município apaga a recusa do servidor sobre o campo', async () => {
    p.municipios.adicionar(MARABA);
    p.municipios.adicionar(ITUPIRANGA);
    p.municipios.recusar('Município inválido.');
    await p.propagar();
    expect(p.elemento('#cfg-blbr-municipios-erro').textContent?.trim()).toBe('Município inválido.');

    p.elemento<HTMLButtonElement>('button[aria-label="Remover Marabá"]').click();
    await p.propagar();

    expect(p.fixture.nativeElement.querySelector('#cfg-blbr-municipios-erro')).toBeNull();
  });

  it('limpar o termo cancela a busca em voo, e a resposta atrasada não repovoa a lista', async () => {
    await digitar('Marabá');
    await esperarABusca();
    const antiga = p.http.expectOne((r) => r.url === CIDADES_URL);

    await digitar('');

    expect(antiga.cancelled).toBe(true);
    expect(resultados()).toEqual([]);
    expect(p.elemento('cfg-campo-de-municipios').textContent).not.toContain('Buscando');
  });

  it.each([
    [500, 1],
    [403, 0],
  ])(
    'a falha %s da busca é apontada no campo, que fica descrito por ela, e avisa %s vez(es) por toast',
    async (status, avisos) => {
      await digitar('Marabá');
      await esperarABusca();
      p.http
        .expectOne((r) => r.url === CIDADES_URL)
        .flush(...problema(status, corpoDaFalha(status)));
      await p.propagar();

      const erro = p.elemento('#cfg-blbr-municipio-busca-erro');
      expect(erro.textContent).toContain('Não foi possível buscar municípios.');
      expect(p.buscaDeMunicipio().getAttribute('aria-invalid')).toBe('true');
      expect(p.buscaDeMunicipio().getAttribute('aria-describedby')).toBe(
        'cfg-blbr-municipio-busca-erro',
      );
      expect(p.fixture.nativeElement.textContent).not.toContain('Nenhum município encontrado.');
      expect(p.erros).toHaveBeenCalledTimes(avisos);
    },
  );

  it('"Tentar novamente" repete a busca sem redigitar, fica indisponível enquanto busca e devolve o foco à busca', async () => {
    await digitar('Marabá');
    await esperarABusca();
    p.http.expectOne((r) => r.url === CIDADES_URL).flush(...problema(503, corpoDaFalha(503)));
    await p.propagar();

    const tentar = p.elemento<HTMLButtonElement>(
      'cfg-campo-de-municipios .list-state__retry button',
    );
    tentar.focus();
    tentar.click();
    await p.propagar();
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(tentar);
    tentar.click();
    await esperarABusca();
    const repetida = p.http.expectOne((r) => r.url === CIDADES_URL);
    expect(repetida.request.params.get('q')).toBe('Marabá');
    repetida.flush([MARABA]);
    await p.propagar();

    expect(p.fixture.nativeElement.querySelector('#cfg-blbr-municipio-busca-erro')).toBeNull();
    expect(resultados()).toHaveLength(1);
    expect(document.activeElement).toBe(p.buscaDeMunicipio());
  });

  it('abrir outro cadastro descarta a busca e a seleção da vez anterior', async () => {
    p.municipios.adicionar(MARABA);
    await digitar('Itu');
    p.edicao.fechar();
    await p.propagar();

    p.edicao.abrirCadastro();
    await p.propagar();

    expect(selecionados()).toEqual([]);
    expect(p.buscaDeMunicipio().value).toBe('');
  });

  it('abrir a edição traz os municípios da base e não acusa falta antes de a pessoa mexer', async () => {
    p.edicao.fechar();
    p.edicao.abrirEdicao(portaria);
    await p.propagar();

    expect(selecionados()).toEqual(['Marabá — PA']);
    expect(p.fixture.nativeElement.querySelector('#cfg-blbr-municipios-erro')).toBeNull();
  });
});
