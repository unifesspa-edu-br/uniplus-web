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
});
