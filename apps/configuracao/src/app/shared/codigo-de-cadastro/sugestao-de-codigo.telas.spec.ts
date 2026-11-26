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

describe('tamanho da sugestão nas telas', () => {
  it('aceita o limite de 50 e anuncia a recusa do nome longo', () => {
    const { fixture, edicao } = montarRecurso();
    const elementoDaTela = fixture.nativeElement as HTMLElement;
    const codigo = elementoDaTela.querySelector<HTMLInputElement>('[formcontrolname="codigo"]');
    edicao.form.controls.nome.setValue('a'.repeat(50));
    fixture.detectChanges();
    expect(codigo?.value).toBe('A'.repeat(50));
    edicao.form.controls.nome.setValue('a'.repeat(51));
    fixture.detectChanges();
    expect(codigo?.value).toBe('');
    expect(elementoDaTela.querySelector('#cfg-ra-codigo-aviso')?.textContent).toContain(
      '50 caracteres',
    );
    expect(codigo?.getAttribute('aria-describedby')).toContain('cfg-ra-codigo-aviso');
    TestBed.inject(HttpTestingController).verify();
  });

  it('forma o número inicial por extenso no recurso', () => {
    const { fixture, edicao } = montarRecurso();
    edicao.form.controls.nome.setValue('1ª etapa');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[formcontrolname="codigo"]').value).toBe(
      'PRIMEIRA_ETAPA',
    );
    TestBed.inject(HttpTestingController).verify();
  });

  it('aceita o limite de 80 e anuncia a recusa do nome longo', async () => {
    const pagina = await montarPagina([]);
    await pagina.abrirCadastro();
    pagina.preencher('nome', 'a'.repeat(80));
    await pagina.propagar();
    expect(pagina.campo('codigo').value).toBe('A'.repeat(80));
    pagina.preencher('nome', 'a'.repeat(81));
    await pagina.propagar();
    expect(pagina.campo('codigo').value).toBe('');
    expect(pagina.elemento('#cfg-tproc-codigo-aviso').textContent).toContain('80 caracteres');
    expect(pagina.campo('codigo').getAttribute('aria-describedby')).toContain(
      'cfg-tproc-codigo-aviso',
    );
    pagina.http.verify();
  });

  it('forma o número inicial por extenso no tipo de processo', async () => {
    const pagina = await montarPagina([]);
    await pagina.abrirCadastro();
    pagina.preencher('nome', '21 de abril');
    await pagina.propagar();
    expect(pagina.campo('codigo').value).toBe('VINTE_E_UM_DE_ABRIL');
    pagina.http.verify();
  });
});
