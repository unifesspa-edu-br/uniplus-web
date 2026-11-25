import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import { RecursosAcessibilidadeListPage } from '../../features/recursos-acessibilidade/recursos-acessibilidade-list.page';
import { EdicaoDosRecursosAcessibilidade } from '../../features/recursos-acessibilidade/edicao-dos-recursos-acessibilidade';
import { montarPagina } from '../../features/tipos-processo/tipos-processo.testing';

function configurarRecurso(): void {
  TestBed.configureTestingModule({
    imports: [RecursosAcessibilidadeListPage],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: 'http://localhost:5000' },
    ],
  });
}

function montarRecurso() {
  configurarRecurso();
  const fixture = TestBed.createComponent(RecursosAcessibilidadeListPage);
  const edicao = fixture.debugElement.injector.get(EdicaoDosRecursosAcessibilidade);
  fixture.detectChanges();
  TestBed.inject(HttpTestingController)
    .expectOne((r) => r.url.endsWith('/recursos-acessibilidade'))
    .flush([]);
  edicao.abrirCadastro();
  fixture.detectChanges();
  return { fixture, edicao };
}

function verificarRecurso(elementoDaTela: HTMLElement, tamanho: number): void {
  const codigo = elementoDaTela.querySelector<HTMLInputElement>('[formcontrolname="codigo"]');
  expect(codigo?.value).toBe('A'.repeat(tamanho));
}

describe('tamanho da sugestão nas telas', () => {
  it('mostra o código inteiro e o aviso de tamanho no recurso de acessibilidade', () => {
    const { fixture, edicao } = montarRecurso();
    const elementoDaTela = fixture.nativeElement as HTMLElement;
    edicao.form.controls.nome.setValue('a'.repeat(50));
    fixture.detectChanges();
    verificarRecurso(elementoDaTela, 50);
    expect(elementoDaTela.querySelector('#cfg-ra-codigo-erro')).toBeNull();
    edicao.form.controls.nome.setValue('a'.repeat(51));
    fixture.detectChanges();
    verificarRecurso(elementoDaTela, 51);
    expect(elementoDaTela.querySelector('#cfg-ra-codigo-erro')?.textContent).toContain(
      'máximo 50 caracteres',
    );
    TestBed.inject(HttpTestingController).verify();
  });

  it('mostra o código inteiro e o aviso de tamanho no tipo de processo', async () => {
    const pagina = await montarPagina([]);
    await pagina.abrirCadastro();
    pagina.preencher('nome', 'a'.repeat(80));
    await pagina.propagar();
    expect(pagina.campo('codigo').value).toBe('A'.repeat(80));
    expect(pagina.fixture.nativeElement.querySelector('#cfg-tproc-codigo-erro')).toBeNull();
    pagina.preencher('nome', 'a'.repeat(81));
    await pagina.propagar();
    expect(pagina.campo('codigo').value).toBe('A'.repeat(81));
    expect(pagina.elemento('#cfg-tproc-codigo-erro').textContent).toContain('máximo 80 caracteres');
    pagina.http.verify();
  });
});
