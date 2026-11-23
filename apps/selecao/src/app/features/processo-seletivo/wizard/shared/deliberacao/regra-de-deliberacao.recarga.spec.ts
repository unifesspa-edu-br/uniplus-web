import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { RegraDeDeliberacaoComponent } from './regra-de-deliberacao.component';
import { VocabulariosDaRegra } from './vocabularios-da-regra.service';

const BASE = '/api/selecao/vocabularios/';
const ROTAS = [
  'modos-deliberacao',
  'criterios-votacao',
  'desempates-votacao',
  'encerramentos-votacao',
  'resultados-sem-unanimidade',
];

function responderListas(http: HttpTestingController): void {
  for (const rota of ROTAS) {
    const pedido = http.expectOne(BASE + rota);
    if (rota === ROTAS[1]) pedido.flush('Erro', { status: 503, statusText: 'Erro' });
    else pedido.flush({ ok: true, data: [] });
  }
}

function criarEditor() {
  const fixture = TestBed.createComponent(RegraDeDeliberacaoComponent);
  fixture.componentRef.setInput('idBase', 'banca');
  fixture.componentRef.setInput('regra', null);
  fixture.detectChanges();
  return fixture;
}

function clicarTentativa(fixture: ComponentFixture<RegraDeDeliberacaoComponent>): void {
  const host = fixture.nativeElement as HTMLElement;
  const botao = host.querySelector('button') as HTMLButtonElement;
  expect(botao.textContent).toContain('Tentar de novo');
  document.body.appendChild(host);
  botao.focus();
  botao.click();
  expect(document.activeElement).toBe(host.querySelector('.form-grid'));
  host.remove();
}

describe('Recarga das opções no editor', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [RegraDeDeliberacaoComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: '' },
      ],
    }),
  );

  it('tenta novamente ao abrir e habilita o seletor após sucesso', () => {
    const vocabularios = TestBed.inject(VocabulariosDaRegra);
    const http = TestBed.inject(HttpTestingController);
    responderListas(http);
    const fixture = criarEditor();
    const seletor = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(seletor.disabled).toBe(true);
    expect(vocabularios.criterios().situacao).toBe('carregando');
    http.expectOne(BASE + ROTAS[1]).flush({ ok: true, data: [] });
    fixture.detectChanges();
    expect(seletor.disabled).toBe(false);
    expect(vocabularios.pronta()).toBe(true);
    http.verify();
  });

  it('permite tentar de novo pelo aviso', () => {
    const fixture = criarEditor();
    const http = TestBed.inject(HttpTestingController);
    responderListas(http);
    fixture.detectChanges();
    const vocabularios = TestBed.inject(VocabulariosDaRegra);
    const recarregar = vi.spyOn(vocabularios, 'recarregarIndisponiveis');
    clicarTentativa(fixture);
    expect(recarregar).toHaveBeenCalledOnce();
    http.expectOne(BASE + ROTAS[1]).flush({ ok: true, data: [] });
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('select') as HTMLSelectElement).disabled).toBe(
      false,
    );
    http.verify();
  });
});
