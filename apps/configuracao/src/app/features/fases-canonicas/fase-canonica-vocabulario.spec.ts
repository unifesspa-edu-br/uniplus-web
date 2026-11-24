import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { VocabulariosDeConfiguracaoApi } from '@uniplus/shared-data/configuracao';
import { Subject, throwError } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { FaseCanonicaFormularioComponent } from './fase-canonica-formulario.component';
import { criarFormularioDeFase } from './fase-canonica-form';
import { ORIGENS_DE_DATA } from './origens-de-data.testing';

it('recupera as origens e só permite enviar com a origem disponível', () => {
  const resposta = new Subject<{ ok: true; data: (typeof ORIGENS_DE_DATA.NO_EDITAL)[] }>();
  const listar = vi
    .fn()
    .mockReturnValueOnce(throwError(() => new Error()))
    .mockReturnValue(resposta);
  TestBed.configureTestingModule({
    providers: [{ provide: VocabulariosDeConfiguracaoApi, useValue: { listar } }],
  });
  const fixture = TestBed.createComponent(FaseCanonicaFormularioComponent);
  const form = criarFormularioDeFase();
  form.controls.origemData.setValue(ORIGENS_DE_DATA.NO_EDITAL.codigo);
  const leitura = {
    assunto: 'unidades',
    visivel: signal(false),
    mensagem: signal(''),
    fase: signal('ociosa'),
    pendente: signal(false),
    indisponivel: signal(false),
    tentar: vi.fn(),
  };
  for (const [nome, valor] of Object.entries({
    aberto: true,
    form,
    salvando: false,
    erro: null,
    anuncio: '',
    leituraDasUnidades: leitura,
    unidadesParaEscolha: [],
    showGrupoAgrupa: true,
    showGrupoCompl: false,
    ehFaseDeIsencao: false,
  }))
    fixture.componentRef.setInput(nome, valor);
  let envios = 0;
  fixture.componentInstance.salvar.subscribe(() => envios++);
  fixture.detectChanges();
  const raiz = fixture.nativeElement as HTMLElement;
  const formulario = raiz.querySelector('form');
  if (!formulario) throw new Error('Formulário ausente.');
  formulario.dispatchEvent(new Event('submit'));
  expect(envios).toBe(0);
  expect(raiz.querySelectorAll('[role="alert"]')).toHaveLength(1);
  expect(
    raiz.querySelector('[formControlName="origemData"]')?.getAttribute('aria-describedby'),
  ).toBe('cfg-fase-falha-origem');
  const tentar = [...raiz.querySelectorAll('button')].find((botao) =>
    botao.textContent?.includes('Tentar novamente'),
  );
  if (!tentar) throw new Error('Ação de nova tentativa ausente.');
  tentar.click();
  fixture.detectChanges();
  expect(raiz.textContent).toContain('Recarregando origens da data');
  formulario.dispatchEvent(new Event('submit'));
  expect(envios).toBe(0);
  resposta.next({ ok: true, data: [ORIGENS_DE_DATA.NO_EDITAL] });
  resposta.complete();
  fixture.detectChanges();
  formulario.dispatchEvent(new Event('submit'));
  expect(envios).toBe(1);
  form.controls.origemData.setValue(ORIGENS_DE_DATA.NA_EXECUCAO.codigo);
  formulario.dispatchEvent(new Event('submit'));
  expect(envios).toBe(1);
  form.controls.origemData.setValue(null);
  formulario.dispatchEvent(new Event('submit'));
  expect(envios).toBe(2);
});
