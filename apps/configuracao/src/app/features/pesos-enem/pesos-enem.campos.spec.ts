import { ChangeDetectorRef } from '@angular/core';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AREAS,
  PaginaDeTeste,
  RES_805,
  areaDo,
  digitarNumeroInvalido,
  digitarNumeroInvalidoESair,
  erroDaArea,
  linhas805,
} from './pesos-enem.testing';
import { PesosEnemEdicaoComponent } from './pesos-enem-edicao.component';

describe('PesosEnemPage — campos numéricos', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());

  it('PesosEnemPage_PesoZero_Valido_PesoNegativo_InvalidaForm', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    const grupo = t.edicao.form()?.controls[0];
    expect(grupo).toBeDefined();
    if (!grupo) throw new Error('form de edição não inicializado');
    areaDo(grupo, 'CIENCIAS_HUMANAS').controls.peso.setValue(0);
    expect(areaDo(grupo, 'CIENCIAS_HUMANAS').controls.peso.valid).toBe(true);

    const linguagens = areaDo(grupo, 'LINGUAGENS');
    linguagens.controls.peso.setValue(-1);
    linguagens.controls.peso.markAsTouched();
    expect(erroDaArea(linguagens, 'peso')).toBe('O peso não pode ser negativo.');

    t.edicao.salvar();
    await t.propagate();
    t.controller.expectNone((r) => r.url.includes('/admin/pesos-area-enem/'));
  });

  it('PesosEnemPage_CorteNegativo_InvalidaForm', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    const redacao = areaDo(t.edicao.form()?.controls[3], 'REDACAO');
    redacao.controls.corte.setValue(-10);
    redacao.controls.corte.markAsTouched();
    expect(erroDaArea(redacao, 'corte')).toBe('O corte não pode ser negativo.');
  });

  it('PesosEnemPage_CamposTemRotuloAcessivelCompleto', async () => {
    await t.carregarUmaPagina([...linhas805]);
    const raiz = t.fixture.nativeElement as HTMLElement;

    // Modo leitura: label associado ao input nomeia área e grupo.
    const rotulos = Array.from(
      t.fixture.nativeElement.querySelectorAll('label.sr-only') as NodeListOf<HTMLLabelElement>,
    ).map((l) => l.textContent?.trim());
    expect(rotulos).toContain('Peso de Matemática e suas Tecnologias — Tecnológica');

    // Drawer: o nome acessível começa pelo texto visível e acrescenta o grupo.
    t.criacao.abrir();
    await t.propagate();
    t.fixture.detectChanges();
    expect(
      raiz.querySelector('input[aria-label="Peso de Matemática e suas Tecnologias — Tecnológica"]'),
    ).not.toBeNull();
    const corteRedacao = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Corte de Redação — Saúde e Biológicas"]',
    );
    expect(corteRedacao).not.toBeNull();
    // A dica "Opcional" fica fora do nome acessível (o aria-label o substitui), então
    // é ligada ao campo como descrição.
    const dica = raiz.querySelector(
      `[id="${corteRedacao?.getAttribute('aria-describedby') ?? ''}"]`,
    );
    expect(dica?.textContent?.trim()).toBe('Opcional — em branco, a área fica sem corte.');
  });

  it('PesosEnemPage_EdicaoEmLinha_PesoECorteTemRotuloVisivel', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    for (const campo of ['peso', 'corte'] as const) {
      const input = t.inputDaEdicao(campo, 0, 0);
      const rotulo = raiz.querySelector<HTMLLabelElement>(`label[for="${input.id}"]`);
      expect(rotulo).not.toBeNull();
      // Visível: o rótulo não é sr-only, e o texto fora do trecho sr-only é curto.
      expect(rotulo?.classList.contains('sr-only')).toBe(false);
      const visivel = Array.from((rotulo?.childNodes ?? []) as NodeListOf<ChildNode>)
        .filter((no) => no.nodeType === Node.TEXT_NODE)
        .map((no) => no.textContent?.trim())
        .join('');
      expect(visivel).toBe(campo === 'peso' ? 'Peso' : 'Corte');
      // O nome acessível completo continua o texto visível.
      expect(rotulo?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        `${campo === 'peso' ? 'Peso' : 'Corte'} de Redação — Tecnológica`,
      );
    }
  });

  it('PesosEnemPage_EdicaoEmLinha_NumeroInvalidoNoCorteBloqueiaEnvio', async () => {
    // Sem a recusa, o texto não numérico virava null e o PUT apagava o corte sem aviso.
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.fixture.detectChanges();

    digitarNumeroInvalidoESair(t.inputDaEdicao('corte', 0, 0));
    t.fixture.detectChanges();

    const redacao = areaDo(t.edicao.form()?.controls[0], 'REDACAO');
    expect(erroDaArea(redacao, 'corte')).toBe('Número inválido.');

    t.edicao.salvar();
    await t.propagate();
    t.controller.expectNone((r) => r.url.includes('/admin/pesos-area-enem/'));
  });

  it('PesosEnemPage_Drawer_NumeroInvalidoNoPesoMostraErroProprio', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    const input = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Peso de Matemática e suas Tecnologias — Tecnológica"]',
    );
    if (!input) throw new Error('campo de peso ausente');
    digitarNumeroInvalidoESair(input);
    t.fixture.detectChanges();

    const matematica = areaDo(t.criacao.form.controls.grupos.controls[0], 'MATEMATICA');
    expect(erroDaArea(matematica, 'peso')).toBe('Número inválido.');
  });

  it('PesosEnemPage_CasasDecimaisAlemDoGravado_SaoRecusadas', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();

    const grupo = t.edicao.form()?.controls[0];
    const matematica = areaDo(grupo, 'MATEMATICA');
    matematica.controls.peso.setValue(1.125);
    matematica.controls.peso.markAsTouched();
    expect(erroDaArea(matematica, 'peso')).toBe('O peso aceita no máximo 2 casas decimais.');

    const redacao = areaDo(grupo, 'REDACAO');
    redacao.controls.corte.setValue(400.1234);
    redacao.controls.corte.markAsTouched();
    expect(erroDaArea(redacao, 'corte')).toBe('O corte aceita no máximo 3 casas decimais.');

    t.edicao.salvar();
    await t.propagate();
    t.controller.expectNone((r) => r.url.includes('/admin/pesos-area-enem/'));

    // No limite do que a coluna guarda, o valor é aceito.
    matematica.controls.peso.setValue(1.25);
    redacao.controls.corte.setValue(400.125);
    expect(matematica.controls.peso.valid).toBe(true);
    expect(redacao.controls.corte.valid).toBe(true);
  });

  it('PesosEnemPage_EdicaoEmLinha_CalculaErroDeCadaCampoUmaVezPorPassada', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.fixture.detectChanges();

    const edicao = PesosEnemEdicaoComponent.prototype as unknown as {
      erroDaArea: (...args: unknown[]) => unknown;
      idCampo: (...args: unknown[]) => unknown;
    };
    const erroDaAreaSpy = vi.spyOn(edicao, 'erroDaArea');
    const idCampoSpy = vi.spyOn(edicao, 'idCampo');
    try {
      const campos = (t.fixture.nativeElement as HTMLElement).querySelectorAll(
        'input[formcontrolname="peso"], input[formcontrolname="corte"]',
      ).length;
      expect(campos).toBe(40);

      // Marca a view do próprio componente (OnPush) e roda uma passada, sem a
      // conferência extra de modo de desenvolvimento.
      t.fixture.debugElement
        .query(By.directive(PesosEnemEdicaoComponent))
        .injector.get(ChangeDetectorRef)
        .markForCheck();
      t.fixture.detectChanges(false);

      // Uma avaliação por campo (peso e corte de cada área, em cada grupo) por passada.
      expect(erroDaAreaSpy).toHaveBeenCalledTimes(campos);
      expect(idCampoSpy).toHaveBeenCalledTimes(campos);
    } finally {
      erroDaAreaSpy.mockRestore();
      idCampoSpy.mockRestore();
    }
  });

  it('PesosEnemPage_DigitandoSeparadorDecimal_NaoAcusaAteSairDoCampo', async () => {
    // "2," e "2." são estados intermediários com badInput no navegador: acusá-los
    // durante a digitação dispararia o alerta a cada separador digitado.
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.fixture.detectChanges();

    const input = t.inputDaEdicao('corte', 0, 0);
    const redacao = areaDo(t.edicao.form()?.controls[0], 'REDACAO');
    digitarNumeroInvalido(input);
    t.fixture.detectChanges();
    expect(erroDaArea(redacao, 'corte')).toBeNull();
    expect(input.parentElement?.querySelector('.field__error')).toBeNull();

    // Ao sair do campo com o texto ainda inválido, o erro aparece.
    input.dispatchEvent(new FocusEvent('blur'));
    t.fixture.detectChanges();
    expect(erroDaArea(redacao, 'corte')).toBe('Número inválido.');

    // Voltar a digitar tira o alerta até o operador terminar de novo.
    digitarNumeroInvalido(input);
    t.fixture.detectChanges();
    expect(erroDaArea(redacao, 'corte')).toBeNull();
  });

  it('PesosEnemPage_Drawer_EnterComTextoInvalido_AcusaAntesDeEnviar', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    const input = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Corte de Redação — Tecnológica"]',
    );
    if (!input) throw new Error('campo de corte ausente');
    digitarNumeroInvalido(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    t.fixture.detectChanges();

    const redacao = areaDo(t.criacao.form.controls.grupos.controls[0], 'REDACAO');
    expect(erroDaArea(redacao, 'corte')).toBe('Número inválido.');
  });

  it('PesosEnemPage_EdicaoEmLinha_DigitandoSeparadorNoPeso_NaoAcusaNada', async () => {
    // No peso (obrigatório), o texto incompleto vira valor vazio: sem a chave
    // silenciosa, "Campo obrigatório." apareceria a cada separador digitado.
    await t.carregarUmaPagina([...linhas805]);
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.fixture.detectChanges();

    const input = t.inputDaEdicao('peso', 0, 4);
    const matematica = areaDo(t.edicao.form()?.controls[0], 'MATEMATICA');
    digitarNumeroInvalido(input);
    t.fixture.detectChanges();
    expect(erroDaArea(matematica, 'peso')).toBeNull();
    expect(input.parentElement?.querySelector('.field__error')).toBeNull();
    expect(matematica.controls.peso.invalid).toBe(true);

    input.dispatchEvent(new FocusEvent('blur'));
    t.fixture.detectChanges();
    expect(erroDaArea(matematica, 'peso')).toBe('Número inválido.');
  });

  it('PesosEnemPage_Drawer_DigitandoSeparadorNoPeso_NaoAcusaNada', async () => {
    await t.carregarUmaPagina([]);
    t.criacao.abrir();
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    const input = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Peso de Matemática e suas Tecnologias — Tecnológica"]',
    );
    if (!input) throw new Error('campo de peso ausente');
    const matematica = areaDo(t.criacao.form.controls.grupos.controls[0], 'MATEMATICA');
    digitarNumeroInvalido(input);
    t.fixture.detectChanges();
    expect(erroDaArea(matematica, 'peso')).toBeNull();

    input.dispatchEvent(new FocusEvent('blur'));
    t.fixture.detectChanges();
    expect(erroDaArea(matematica, 'peso')).toBe('Número inválido.');
  });

  it('PesosEnemPage_CodigoERotulo_NaoSaoEditaveis', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.criacao.abrir();
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('input[formcontrolname="codigo"]')).toHaveLength(0);
    expect(raiz.querySelectorAll('input[formcontrolname="peso"]').length).toBeGreaterThan(0);
    expect(raiz.querySelectorAll('input[formcontrolname="corte"]').length).toBeGreaterThan(0);
  });

  it('PesosEnemPage_Corte_CadaAreaTemCampoENenhumTextoRestringeARedacao', async () => {
    await t.carregarUmaPagina([...linhas805]);
    t.criacao.abrir();
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).not.toMatch(/só a Redação/iu);
    for (const area of AREAS) {
      expect(
        raiz.querySelector(`input[aria-label="Corte de ${area.rotulo} — Tecnológica"]`),
      ).not.toBeNull();
    }
  });
});
