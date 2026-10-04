import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { PASSO_DESEMPATE } from '../desempate/desempate-por-idade';
import { FormularioStepComponent } from './formulario.component';

const BASE = 'http://localhost:5000';

describe('FormularioStepComponent em consulta', () => {
  let fixture: ComponentFixture<FormularioStepComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormularioStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        CatalogosDoCronogramaService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    store.patchSection('formulario', {
      titulo: 'Inscrição — Medicina 2027',
      termoAceiteTexto: 'Declaro que li o edital.\nDeclaro que as informações são verdadeiras.',
      fatos: [
        {
          fatoCodigo: 'COR_RACA',
          ordem: 1,
          rotulo: 'Cor ou raça',
          tipoRenderizacao: 'SELECAO',
          obrigatorio: true,
          precondicao: null,
        },
        {
          fatoCodigo: 'RENDA_PER_CAPITA',
          ordem: 2,
          rotulo: 'Renda per capita',
          tipoRenderizacao: 'NUMERO',
          obrigatorio: false,
          precondicao: null,
        },
      ],
      referenciaTemporal: { tipo: 'DATA_ESPECIFICA', data: '2027-01-15', faseCodigo: '' },
      derivacao: [],
    });
    store.remoteSnapshot.set({ status: 'publicado' } as never);

    fixture = TestBed.createComponent(FormularioStepComponent);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) requisicao.flush([]);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function valor(rotulo: string): readonly (string | undefined)[] {
    return Array.from(host.querySelectorAll('dl'))
      .filter((dl) => dl.querySelector('dt')?.textContent?.trim() === rotulo)
      .map((dl) => dl.querySelector('dd')?.textContent?.trim());
  }

  it('não oferece controle de formulário nem ação de edição', () => {
    expect(host.querySelector('input, select, textarea, button, ui-combobox')).toBeNull();
  });

  /** O catálogo de fatos só serve para acrescentar campo: carga e falha dele não aparecem. */
  it('não mostra o carregamento nem a falha do catálogo de fatos', () => {
    fixture.componentInstance.carregarCatalogo();
    fixture.detectChanges();
    expect(host.querySelector('.alert')).toBeNull();

    controller
      .expectOne(`${BASE}/api/configuracao/fatos-candidato`)
      .flush(
        { type: 'about:blank', title: 'Indisponível.', status: 503, traceId: 't' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    fixture.detectChanges();

    expect(fixture.componentInstance.catalogoErro()).not.toBeNull();
    expect(host.querySelector('.alert')).toBeNull();
    expect(host.querySelector('button')).toBeNull();
  });

  it('lê título e termo de aceite como texto, com as quebras de linha do termo', () => {
    expect(valor('Título do formulário')).toEqual(['Inscrição — Medicina 2027']);
    expect(valor('Termo de aceite')).toEqual([
      'Declaro que li o edital.\nDeclaro que as informações são verdadeiras.',
    ]);
  });

  it('diz de cada campo se a resposta é obrigatória ou opcional', () => {
    const campos = Array.from(host.querySelectorAll('.doc-item')).map((item) => [
      item.querySelector('.doc-item__name')?.textContent?.trim(),
      item.querySelector('dd')?.textContent?.trim(),
    ]);

    expect(campos).toEqual([
      ['Cor ou raça', 'Obrigatória'],
      ['Renda per capita', 'Opcional'],
    ]);
  });

  it('lê a apuração da idade pelo rótulo da âncora e a data no formato brasileiro', () => {
    expect(valor('Apurar a idade em')).toEqual(['Uma data fixa']);
    expect(valor('Data de apuração')).toEqual(['15/01/2027']);
  });

  function declararDesempate(regraCodigo: string): void {
    // O rascunho só aceita edição fora de consulta.
    store.remoteSnapshot.set({ status: 'rascunho' } as never);
    store.patchSection('desempate', [
      {
        regraCodigo,
        regraVersao: 'v1',
        etapaRef: '',
        idadeMinima: '',
        fato: '',
        operador: '',
        valor: '',
        areas: [],
      },
    ]);
  }

  it('em consulta, não mostra os avisos de idade: o processo publicado não admite a correção', () => {
    declararDesempate('DESEMPATE-MAIOR-IDADE');
    store.patchObjectSection('formulario', {
      referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
    });
    store.patchSection('desempate', [
      ...store.draft().desempate,
      { ...store.draft().desempate[0], regraCodigo: 'DESEMPATE-IDOSO', idadeMinima: '60' },
    ]);
    expect(fixture.componentInstance.desempateSemDataDeNascimento()).toBe(true);
    expect(fixture.componentInstance.desempateIdosoSemApuracao()).toBe(true);

    store.remoteSnapshot.set({ status: 'publicado' } as never);
    fixture.detectChanges();

    expect(fixture.componentInstance.desempateSemDataDeNascimento()).toBe(false);
    expect(fixture.componentInstance.desempateIdosoSemApuracao()).toBe(false);
    expect(host.querySelector('#form-desempate-sem-nascimento')).toBeNull();
    expect(host.querySelector('#form-idoso-sem-apuracao')).toBeNull();
  });

  it('avisa do desempate por maior idade sem data de nascimento e leva ao passo Desempate', () => {
    expect(host.querySelector('#form-desempate-sem-nascimento')).toBeNull();

    declararDesempate('DESEMPATE-MAIOR-IDADE');
    fixture.detectChanges();

    expect(host.querySelector('#form-desempate-sem-nascimento')).not.toBeNull();
    // A apuração da idade não é do maior idade: o aviso dela não aparece.
    expect(host.querySelector('#form-idoso-sem-apuracao')).toBeNull();
    (host.querySelector('#form-ir-desempate-nascimento') as HTMLButtonElement).click();
    expect(store.currentStep()).toBe(PASSO_DESEMPATE);
  });

  it('o aviso sai quando a data de nascimento passa a ser coletada', () => {
    declararDesempate('DESEMPATE-MAIOR-IDADE');
    store.patchObjectSection('formulario', {
      fatos: [
        ...store.draft().formulario.fatos,
        {
          fatoCodigo: 'DATA_NASCIMENTO',
          ordem: 3,
          rotulo: 'Data de nascimento',
          tipoRenderizacao: 'DATA',
          obrigatorio: true,
          precondicao: null,
        },
      ],
    });
    fixture.detectChanges();

    expect(host.querySelector('#form-desempate-sem-nascimento')).toBeNull();
    // O desempate usa o dado: ele não aparece como campo sem finalidade.
    expect(host.textContent).not.toMatch(/Nada no certame usa[^.]*Data de nascimento/);
  });

  it('avisa do desempate por idoso sem apuração da idade e leva ao passo Desempate', () => {
    declararDesempate('DESEMPATE-IDOSO');
    store.patchObjectSection('formulario', {
      referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
    });
    fixture.detectChanges();

    expect(host.querySelector('#form-idoso-sem-apuracao')).not.toBeNull();
    expect(host.querySelector('#form-desempate-sem-nascimento')).toBeNull();
    (host.querySelector('#form-ir-desempate-apuracao') as HTMLButtonElement).click();
    expect(store.currentStep()).toBe(PASSO_DESEMPATE);
  });
});
