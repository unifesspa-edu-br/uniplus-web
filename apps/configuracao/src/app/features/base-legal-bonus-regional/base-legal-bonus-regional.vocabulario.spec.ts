import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  LISTA,
  Pagina,
  TIPOS,
  TIPO_LEI,
  TIPO_PORTARIA,
  TIPOS_URL,
  corpoDaFalha,
  montarPagina,
  portaria,
  problema,
  sucesso,
} from './base-legal-bonus-regional.testing';

describe('BaseLegalBonusRegionalPage — tipos de instrumento no formulário', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  const select = (): HTMLSelectElement =>
    p.campo('tipoInstrumento') as unknown as HTMLSelectElement;
  /** As opções que a pessoa vê: o `ui-select` guarda uma opção oculta para o valor que ainda não tem rótulo. */
  const opcoes = (): string[] =>
    [...select().options]
      .filter((opcao) => !opcao.hidden)
      .map((opcao) => opcao.textContent?.trim() ?? '');
  const rotulos = TIPOS.map((tipo) => tipo.rotulo);
  const descricaoMostrada = (): string | null =>
    p.elemento('ui-select .field__hint').textContent?.trim() ?? null;
  const avisoDeEspera = (): HTMLElement | null =>
    p.fixture.nativeElement.querySelector('#cfg-blbr-salvar-aguarda-tipos');
  const submeter = async (): Promise<void> => {
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
    await p.propagar();
  };
  const alertaDoDrawer = (): HTMLElement | null =>
    p.fixture.nativeElement.querySelector('ui-drawer ui-alerta-nova-tentativa');

  /** Abrir o formulário tenta de novo o vocabulário que falhou; aqui a tentativa falha outra vez. */
  const abrirComVocabularioIndisponivel = async (): Promise<void> => {
    await p.abrirEdicao(portaria);
    p.http.expectOne((r) => r.url === TIPOS_URL).flush(...problema(503, corpoDaFalha(503)));
    await p.propagar();
  };

  it('cada abertura da tela pede o vocabulário de novo, sem guardá-lo da anterior', async () => {
    p = await montarPagina([portaria]);
    p.http.verify();
    TestBed.resetTestingModule();

    p = await montarPagina([portaria], 'pendente');

    p.http.expectOne((r) => r.url === TIPOS_URL).flush(TIPOS);
  });

  it('oferece os rótulos dos tipos, mostra a descrição do escolhido e grava o código', async () => {
    p = await montarPagina([portaria]);
    await p.abrirEdicao(portaria);

    expect(opcoes()).toEqual(['Selecione…', ...rotulos]);
    expect(select().value).toBe(TIPO_PORTARIA.codigo);
    expect(descricaoMostrada()).toBe(TIPO_PORTARIA.descricao);
    expect(select().getAttribute('aria-busy')).toBeNull();
    expect(p.salvar().hasAttribute('aria-disabled')).toBe(false);
    expect(p.salvar().hasAttribute('aria-describedby')).toBe(false);

    p.preencher('tipoInstrumento', TIPO_LEI.codigo);
    await p.propagar();
    expect(descricaoMostrada()).toBe(TIPO_LEI.descricao);
  });

  it('enquanto o vocabulário carrega, o select está ocupado e não mostra opção alguma além da inicial', async () => {
    p = await montarPagina([portaria], 'pendente');
    await p.abrirEdicao(portaria);

    expect(select().getAttribute('aria-busy')).toBe('true');
    expect(opcoes()).toEqual(['Selecione…']);
    p.http.expectOne((r) => r.url === TIPOS_URL).flush(TIPOS);
    await p.propagar();

    expect(select().getAttribute('aria-busy')).toBeNull();
    expect(opcoes()).toEqual(['Selecione…', ...rotulos]);
    expect(select().value).toBe(TIPO_PORTARIA.codigo);
  });

  it('o cadastro novo não oferece opção fora do vocabulário', async () => {
    p = await montarPagina([portaria]);
    p.edicao.abrirCadastro();
    await p.propagar();

    expect(opcoes()).toEqual(['Selecione…', ...rotulos]);
  });

  describe('enquanto o vocabulário não chegou, o envio espera', () => {
    it('na edição, o botão explica a espera, nada é enviado e, com o vocabulário, o código gravado segue', async () => {
      p = await montarPagina([portaria], 'pendente');
      await p.abrirEdicao(portaria);

      expect(p.salvar().getAttribute('aria-disabled')).toBe('true');
      expect(p.salvar().getAttribute('aria-describedby')).toBe('cfg-blbr-salvar-aguarda-tipos');
      expect(avisoDeEspera()?.textContent).toContain('Aguarde o carregamento dos tipos');
      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      p.salvar().dispatchEvent(clique);
      expect(clique.defaultPrevented).toBe(true);
      await submeter();

      p.http.expectOne((r) => r.url === TIPOS_URL).flush(TIPOS);
      await p.propagar();
      expect(p.salvar().hasAttribute('aria-disabled')).toBe(false);
      expect(p.salvar().hasAttribute('aria-describedby')).toBe(false);
      expect(avisoDeEspera()).toBeNull();
      const put = await p.enviar(`${ESCRITA}/${portaria.id}`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toMatchObject({ tipoInstrumento: TIPO_PORTARIA.codigo });
      put.flush(...sucesso());
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush([portaria]);
    });

    it('no cadastro, o botão também fica indisponível', async () => {
      p = await montarPagina([portaria], 'pendente');
      p.edicao.abrirCadastro();
      await p.propagar();

      expect(p.salvar().getAttribute('aria-disabled')).toBe('true');
      expect(avisoDeEspera()).not.toBeNull();
      await submeter();
      p.http.expectOne((r) => r.url === TIPOS_URL).flush(TIPOS);
    });
  });

  describe('quando o vocabulário falha', () => {
    it('o botão aponta o aviso da falha, nada é enviado e a nova tentativa libera o envio', async () => {
      p = await montarPagina([portaria], { falha: 503 });
      await abrirComVocabularioIndisponivel();

      expect(p.salvar().getAttribute('aria-disabled')).toBe('true');
      expect(p.salvar().getAttribute('aria-describedby')).toBe('cfg-blbr-tipos-falha');
      expect(avisoDeEspera()).toBeNull();
      await submeter();

      (alertaDoDrawer()?.querySelector('button') as HTMLButtonElement).click();
      await p.propagar();
      p.http.expectOne((r) => r.url === TIPOS_URL).flush(TIPOS);
      await p.propagar();
      expect(p.salvar().hasAttribute('aria-disabled')).toBe(false);
      expect(p.salvar().hasAttribute('aria-describedby')).toBe(false);
    });

    it('o formulário avisa, descreve o select pelo aviso e a nova tentativa devolve o foco ao select', async () => {
      p = await montarPagina([portaria], { falha: 503 });
      await abrirComVocabularioIndisponivel();

      const alerta = alertaDoDrawer() as HTMLElement;
      expect(alerta.textContent).toContain('Tipos de instrumento não carregados');
      expect(alerta.textContent).toContain('sem o vocabulário de tipos');
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
      expect(select().getAttribute('aria-describedby')).not.toContain('cfg-blbr-tipos-falha');
      expect(document.activeElement).toBe(select());
    });

    it('abrir o formulário tenta carregar de novo o vocabulário que falhou, sem exibir o aviso da vez anterior', async () => {
      p = await montarPagina([portaria], { falha: 503 });
      p.edicao.abrirCadastro();
      await p.propagar();
      expect(alertaDoDrawer()).toBeNull();

      p.http.expectOne((r) => r.url === TIPOS_URL).flush(TIPOS);
      await p.propagar();
      expect(opcoes()).toEqual(['Selecione…', ...rotulos]);
      expect(alertaDoDrawer()).toBeNull();
    });

    it('o aviso do formulário só existe com o formulário aberto, e o da página segue visível', async () => {
      p = await montarPagina([portaria], { falha: 503 });

      expect(alertaDoDrawer()).toBeNull();
      expect(p.elemento('ui-alerta-nova-tentativa').textContent).toContain(
        'Tipos de instrumento não carregados',
      );
    });
  });
});
