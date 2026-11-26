import { ESPERA_DA_DIGITACAO_MS } from '@uniplus/shared-ui/components';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CIDADES_URL,
  ITUPIRANGA,
  MARABA,
  Pagina,
  montarPagina,
  portaria,
  problema,
} from './base-legal-bonus-regional.testing';

describe('Base legal — municípios', () => {
  let p: Pagina;
  beforeEach(async () => {
    ligarRelogioControlado();
    p = await montarPagina([portaria]);
    p.edicao.abrirCadastro();
    await p.propagar();
  });
  afterEach(() => {
    vi.useRealTimers();
    p.http.verify();
  });

  async function digitar(termo: string): Promise<void> {
    const campo = p.buscaDeMunicipio();
    campo.focus();
    campo.value = termo;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await p.propagar();
  }
  async function buscar(termo: string, cidades = [MARABA, ITUPIRANGA]): Promise<void> {
    await digitar(termo);
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    p.http.expectOne((r) => r.url === CIDADES_URL).flush(cidades);
    await p.propagar();
  }
  const opcoes = (): HTMLElement[] => [
    ...p.fixture.nativeElement.querySelectorAll('[role="option"]'),
  ];
  const selecionados = (): string[] =>
    [...p.fixture.nativeElement.querySelectorAll('.cfg-municipio-selecionados li span')].map(
      (item: HTMLElement) => item.textContent?.trim() ?? '',
    );
  const teclar = (key: string): void => {
    p.buscaDeMunicipio().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  };

  it('consulta uma vez ao atingir o mínimo e esperar após a digitação', async () => {
    await digitar('Ma');
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    p.http.expectNone((r) => r.url === CIDADES_URL);
    await digitar('Mar');
    await passarOTempo(ESPERA_DA_DIGITACAO_MS - 1);
    p.http.expectNone((r) => r.url === CIDADES_URL);
    await passarOTempo(1);
    const pedido = p.http.expectOne((r) => r.url === CIDADES_URL);
    expect(pedido.request.params.get('q')).toBe('Mar');
    pedido.flush([MARABA]);
    await p.propagar();
    expect(opcoes().some((o) => o.textContent?.includes('Marabá'))).toBe(true);
  });

  it('escolhe pelo teclado, grava os três campos e mantém o foco', async () => {
    await buscar('Mar', [MARABA]);
    teclar('ArrowDown');
    teclar('Enter');
    await p.propagar();
    expect(p.municipios.itens()).toEqual([
      { codigoIbge: MARABA.codigoIbge, nome: 'Marabá', uf: 'PA' },
    ]);
    expect(selecionados()).toEqual(['Marabá — PA']);
    expect(document.activeElement).toBe(p.buscaDeMunicipio());
  });

  it('não repete escolhido no grupo encontrados', async () => {
    p.escolherMunicipios(MARABA);
    await buscar('Mar');
    const titulo = [...p.fixture.nativeElement.querySelectorAll('.combobox__grupo')].find(
      (item: Element) => item.textContent?.trim() === 'Encontrados',
    ) as HTMLElement;
    const encontrados = titulo?.nextElementSibling;
    expect(encontrados?.textContent).not.toContain('Marabá');
    expect(encontrados?.textContent).toContain('Itupiranga');
  });

  it('desmarca um escolhido pela lista e mantém o foco no campo', async () => {
    p.escolherMunicipios(MARABA);
    await p.propagar();
    p.buscaDeMunicipio().focus();
    await p.propagar();
    teclar('ArrowDown');
    teclar('Enter');
    await p.propagar();
    expect(selecionados()).toEqual([]);
    expect(document.activeElement).toBe(p.buscaDeMunicipio());
  });

  it('associa o rótulo ao campo obrigatório', () => {
    const rotulo = p.elemento<HTMLLabelElement>('cfg-campo-de-municipios label');
    expect(rotulo.htmlFor).toBe(p.buscaDeMunicipio().id);
    expect(p.buscaDeMunicipio().getAttribute('aria-required')).toBe('true');
  });

  it('remover passa ao próximo botão e depois ao campo e exige um município', async () => {
    p.escolherMunicipios(MARABA, ITUPIRANGA);
    await p.propagar();
    p.elemento<HTMLButtonElement>('button[aria-label="Remover Marabá"]').click();
    await p.propagar();
    expect(document.activeElement).toBe(p.elemento('button[aria-label="Remover Itupiranga"]'));
    p.elemento<HTMLButtonElement>('button[aria-label="Remover Itupiranga"]').click();
    await p.propagar();
    expect(document.activeElement).toBe(p.buscaDeMunicipio());
    expect(p.elemento('#cfg-blbr-municipios-erro').textContent).toContain(
      'Adicione ao menos um município.',
    );
  });

  it('na edição preserva o município gravado e seu rótulo', async () => {
    p.edicao.fechar();
    p.edicao.abrirEdicao(portaria);
    await p.propagar();
    expect(selecionados()).toEqual(['Marabá — PA']);
    expect(p.fixture.nativeElement.querySelector('#cfg-blbr-municipios-erro')).toBeNull();
  });

  it('recomeça a busca que falhou ao abrir outro formulário', async () => {
    const novaTentativa = (): Element | null =>
      p.fixture.nativeElement.querySelector('ui-nova-tentativa-do-campo');
    await digitar('Mar');
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    p.http.expectOne((r) => r.url === CIDADES_URL).flush(...problema(503));
    await p.propagar();
    expect(novaTentativa()).not.toBeNull();
    p.edicao.fechar();
    await p.propagar();
    p.edicao.abrirCadastro();
    await p.propagar();
    expect(p.buscaDeMunicipio()).not.toBeNull();
    expect(novaTentativa()).toBeNull();
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    p.http.expectNone((r) => r.url === CIDADES_URL);
  });

  it('mostra falha e permite tentar novamente com aviso de servidor', async () => {
    await digitar('Mar');
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    p.http.expectOne((r) => r.url === CIDADES_URL).flush(...problema(503));
    await p.propagar();
    expect(p.erros).toHaveBeenCalledTimes(1);
    p.elemento<HTMLButtonElement>('ui-nova-tentativa-do-campo button').click();
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    p.http.expectOne((r) => r.url === CIDADES_URL).flush([MARABA]);
    await p.propagar();
    expect(opcoes().some((o) => o.textContent?.includes('Marabá'))).toBe(true);
  });
});
