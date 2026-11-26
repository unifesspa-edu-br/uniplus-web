import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { buscaDeMunicipiosNoGeo, GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';
import { BUSCA_DE_MUNICIPIOS, ESPERA_DA_DIGITACAO_MS } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { MunicipioDoProcessoComponent } from './municipio-do-processo.component';

const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };
const BELEM = { codigoIbge: '1501402', nome: 'Belém', uf: 'PA' };

describe('Município que rege os prazos', () => {
  let host: HTMLElement;
  let store: ProcessoSeletivoStore;
  let http: HttpTestingController;
  let detectar: () => void;

  beforeEach(() => {
    ligarRelogioControlado();
    TestBed.configureTestingModule({
      imports: [MunicipioDoProcessoComponent],
      providers: [
        ProcessoSeletivoStore,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: GEO_BASE_PATH, useValue: 'http://localhost:5000' },
        { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
      ],
    });
    const fixture = TestBed.createComponent(MunicipioDoProcessoComponent);
    fixture.componentRef.setInput('invalido', false);
    host = fixture.nativeElement as HTMLElement;
    detectar = () => fixture.detectChanges();
    store = TestBed.inject(ProcessoSeletivoStore);
    http = TestBed.inject(HttpTestingController);
    detectar();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function campo(): HTMLInputElement {
    return host.querySelector('input[role="combobox"]') as HTMLInputElement;
  }

  function digitar(texto: string): void {
    campo().focus();
    campo().value = texto;
    campo().dispatchEvent(new Event('input', { bubbles: true }));
    detectar();
  }

  function requisicao() {
    return http.expectOne((req) => req.url.includes('/api/cidades'));
  }

  async function esperar(): Promise<void> {
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    detectar();
  }

  it('não consulta abaixo do mínimo e aguarda depois das teclas', async () => {
    digitar('Ma');
    await esperar();
    http.expectNone((req) => req.url.includes('/api/cidades'));
    digitar('Mar');
    digitar('Mara');
    http.expectNone((req) => req.url.includes('/api/cidades'));
    await esperar();
    const busca = requisicao();
    expect(busca.request.params.get('q')).toBe('Mara');
    busca.flush([MARABA]);
    http.expectNone((req) => req.url.includes('/api/cidades'));
  });

  it('consulta uma vez com o mínimo após a espera', async () => {
    digitar('Mar');
    http.expectNone((req) => req.url.includes('/api/cidades'));
    await esperar();
    const busca = requisicao();
    expect(busca.request.params.get('q')).toBe('Mar');
    busca.flush([MARABA]);
  });

  it('associa o rótulo e permite escolher pelo teclado o trio completo', async () => {
    expect(host.querySelector('label')?.htmlFor).toBe(campo().id);
    digitar('Mar');
    await esperar();
    requisicao().flush([MARABA]);
    detectar();
    expect(host.querySelector('[role="option"]')?.textContent).toContain('Marabá (PA)');
    campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    detectar();
    expect(store.draft().identificacao.localidade).toEqual(MARABA);
  });

  it('cancela a busca antiga e mostra apenas a resposta atual', async () => {
    digitar('Mar');
    await esperar();
    const antiga = requisicao();
    digitar('Bel');
    expect(antiga.cancelled).toBe(true);
    await esperar();
    requisicao().flush([BELEM]);
    detectar();
    expect(host.textContent).toContain('Belém (PA)');
    expect(host.textContent).not.toContain('Marabá');
  });

  it('anuncia falha uma vez e repete a busca atual', async () => {
    digitar('Mar');
    await esperar();
    requisicao().flush({}, { status: 500, statusText: 'Erro' });
    detectar();
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1);
    const botao = host.querySelector('ui-falha-de-leitura-do-campo button') as HTMLButtonElement;
    expect(botao.textContent).toContain('Tentar novamente');
    botao.click();
    await esperar();
    const repetida = requisicao();
    expect(repetida.request.params.get('q')).toBe('Mar');
    repetida.flush([MARABA]);
  });

  it('anuncia quando não encontra municípios', async () => {
    digitar('Mar');
    await esperar();
    requisicao().flush([]);
    detectar();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Nenhum município');
  });

  it('bloqueia a busca quando o processo já foi gravado', () => {
    store.processoSeletivoId.set('processo');
    detectar();
    expect(campo().disabled).toBe(true);
    expect(host.querySelector('label')?.htmlFor).toBe(campo().id);
  });

  it('permite trocar o município e mantém o campo bloqueado após gravação', () => {
    store.patchObjectSection('identificacao', { localidade: MARABA });
    detectar();
    (host.querySelector('button') as HTMLButtonElement).click();
    detectar();
    expect(store.draft().identificacao.localidade).toBeNull();
    store.patchObjectSection('identificacao', { localidade: MARABA });
    store.processoSeletivoId.set('processo');
    detectar();
    expect(host.querySelector<HTMLInputElement>('#f-localidade')?.disabled).toBe(true);
    expect(host.querySelector('button')).toBeNull();
  });
});
