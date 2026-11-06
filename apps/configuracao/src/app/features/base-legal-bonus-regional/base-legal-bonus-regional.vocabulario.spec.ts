import { EnvironmentInjector, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { TiposDeInstrumento } from './tipos-de-instrumento';
import {
  Pagina,
  TIPOS,
  TIPOS_URL,
  corpoDaFalha,
  montarPagina,
  portaria,
  problema,
} from './base-legal-bonus-regional.testing';

const ANTIGA = { ...portaria, tipoInstrumento: 'PARECER_ANTIGO' };

describe('BaseLegalBonusRegionalPage — tipos de instrumento no formulário', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  const select = (): HTMLSelectElement =>
    p.campo('tipoInstrumento') as unknown as HTMLSelectElement;
  const opcoes = (): string[] =>
    [...select().options].map((opcao) => opcao.textContent?.trim() ?? '');
  const alertaDoDrawer = (): HTMLElement | null =>
    p.fixture.nativeElement.querySelector('ui-drawer cfg-alerta-nova-tentativa');

  /** Abrir o formulário tenta de novo o vocabulário que falhou; aqui a tentativa falha outra vez. */
  const abrirComVocabularioIndisponivel = async (): Promise<void> => {
    await p.abrirEdicao(portaria);
    p.http.expectOne((r) => r.url === TIPOS_URL).flush(...problema(503, corpoDaFalha(503)));
    await p.propagar();
  };

  it('uma nova visita à tela reaproveita o vocabulário já carregado, sem pedi-lo de novo', async () => {
    p = await montarPagina([portaria]);
    const novaVisita = Injector.create({
      providers: [TiposDeInstrumento],
      parent: TestBed.inject(EnvironmentInjector),
    }).get(TiposDeInstrumento);

    p.http.expectNone((r) => r.url === TIPOS_URL);
    expect(novaVisita.resolver('PORTARIA')).toMatchObject({ rotulo: 'Portaria' });
  });

  it('oferece os nomes dos tipos e grava o código', async () => {
    p = await montarPagina([portaria]);
    await p.abrirEdicao(portaria);

    expect(opcoes()).toEqual(['Selecione…', 'Portaria', 'Lei']);
    expect(select().value).toBe('PORTARIA');
    expect(select().getAttribute('aria-busy')).toBeNull();
  });

  it('enquanto o vocabulário carrega, o select está ocupado e o tipo da base não aparece como código cru', async () => {
    p = await montarPagina([portaria], 'pendente');
    await p.abrirEdicao(portaria);

    expect(select().getAttribute('aria-busy')).toBe('true');
    expect(opcoes()).toEqual(['Selecione…', 'Carregando…']);
    p.http.expectOne((r) => r.url === TIPOS_URL).flush(TIPOS);
    await p.propagar();

    expect(select().getAttribute('aria-busy')).toBeNull();
    expect(opcoes()).toEqual(['Selecione…', 'Portaria', 'Lei']);
    expect(select().value).toBe('PORTARIA');
  });

  it('um tipo que o vocabulário atual não tem continua visível, com o código, e selecionado', async () => {
    p = await montarPagina([ANTIGA]);
    await p.abrirEdicao(ANTIGA);

    expect(opcoes()).toEqual(['Selecione…', 'PARECER_ANTIGO', 'Portaria', 'Lei']);
    expect(select().value).toBe('PARECER_ANTIGO');
    p.preencher('tipoInstrumento', 'LEI');
    expect(opcoes()).toContain('PARECER_ANTIGO');
  });

  it('o cadastro novo não oferece opção fora do vocabulário', async () => {
    p = await montarPagina([ANTIGA]);
    p.edicao.abrirCadastro();
    await p.propagar();

    expect(opcoes()).toEqual(['Selecione…', 'Portaria', 'Lei']);
  });

  describe('quando o vocabulário falha', () => {
    it('o formulário avisa, descreve o select pelo aviso e a nova tentativa devolve o foco ao select', async () => {
      p = await montarPagina([portaria], { falha: 503 });
      await abrirComVocabularioIndisponivel();

      const alerta = alertaDoDrawer() as HTMLElement;
      expect(alerta.textContent).toContain('Tipos de instrumento não carregados');
      expect(alerta.textContent).toContain(
        'Sem o vocabulário de tipos não é possível classificar a base legal.',
      );
      expect(select().getAttribute('aria-describedby')).toBe('cfg-blbr-tipos-falha');
      const tentar = alerta.querySelector('button') as HTMLButtonElement;
      tentar.focus();
      tentar.click();
      await p.propagar();
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      expect(tentar.getAttribute('aria-busy')).toBe('true');
      p.http.expectOne((r) => r.url === TIPOS_URL).flush(TIPOS);
      await p.propagar();

      expect(alertaDoDrawer()).toBeNull();
      expect(select().getAttribute('aria-describedby')).toBeNull();
      expect(document.activeElement).toBe(select());
    });

    it('a nova tentativa que falha de novo conta as tentativas e o aviso permanece', async () => {
      p = await montarPagina([portaria], { falha: 503 });
      await abrirComVocabularioIndisponivel();
      (alertaDoDrawer()?.querySelector('button') as HTMLButtonElement).click();
      await p.propagar();
      p.http.expectOne((r) => r.url === TIPOS_URL).flush(...problema(503, corpoDaFalha(503)));
      await p.propagar();

      expect(alertaDoDrawer()?.textContent).toContain('Tentativa 2 sem sucesso.');
    });

    it('abrir o formulário tenta carregar de novo o vocabulário que falhou, sem exibir o aviso da vez anterior', async () => {
      p = await montarPagina([portaria], { falha: 503 });
      p.edicao.abrirCadastro();
      await p.propagar();
      expect(alertaDoDrawer()).toBeNull();

      p.http.expectOne((r) => r.url === TIPOS_URL).flush(TIPOS);
      await p.propagar();
      expect(opcoes()).toEqual(['Selecione…', 'Portaria', 'Lei']);
      expect(alertaDoDrawer()).toBeNull();
    });

    it('o aviso do formulário só existe com o formulário aberto, e o da página segue visível', async () => {
      p = await montarPagina([portaria], { falha: 503 });

      expect(alertaDoDrawer()).toBeNull();
      expect(p.elemento('cfg-alerta-nova-tentativa').textContent).toContain(
        'A coluna Tipo mostra “Não carregado” até a busca ser refeita.',
      );
    });
  });
});
