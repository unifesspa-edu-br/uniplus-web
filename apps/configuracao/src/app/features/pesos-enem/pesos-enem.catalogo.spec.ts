import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CatalogoGruposAreaEnem } from '../../shared/grupos-area-enem';
import { PesosEnemPage } from './pesos-enem.page';
import {
  AREAS,
  AREAS_URL,
  BASE,
  GRUPOS,
  GRUPOS_URL,
  LIST_URL,
  linhas805,
} from './pesos-enem.testing';

describe('PesosEnemPage — grupos de área vindos do catálogo compartilhado', () => {
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PesosEnemPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('PesosEnemPage_TentativaDoOperadorEmOutraTela_NaoApareceComoFalhaAoEntrar', async () => {
    // Em Cursos a lista falhou e o operador clicou "Tentar novamente".
    const catalogo = TestBed.inject(CatalogoGruposAreaEnem);
    catalogo.garantirCarregado();
    controller
      .expectOne(GRUPOS_URL)
      .flush(
        { title: 'Indisponível', status: 503 },
        { status: 503, statusText: 'Service Unavailable' },
      );
    expect(catalogo.falhou()).toBe(true);
    catalogo.tentarDeNovo();
    expect(catalogo.falhou()).toBe(true);

    // Ele navega para Pesos antes de a tentativa responder: para Pesos, ela é automática.
    const fixture = TestBed.createComponent(PesosEnemPage);
    fixture.detectChanges();
    controller.expectOne(AREAS_URL).flush([...AREAS]);
    controller.expectOne((r) => r.url === LIST_URL).flush([...linhas805]);
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).not.toContain('Não foi possível carregar');

    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    expect(raiz.querySelectorAll('.cell-label--group-label')).toHaveLength(linhas805.length);
  });

  it('PesosEnemPage_GruposJaCarregadosPorOutraTela_NaoPedeDeNovo', async () => {
    // Outra tela (ex.: o cadastro de Cursos) já trouxe o vocabulário.
    const catalogo = TestBed.inject(CatalogoGruposAreaEnem);
    catalogo.garantirCarregado();
    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);

    const fixture = TestBed.createComponent(PesosEnemPage);
    fixture.detectChanges();
    controller.expectOne(AREAS_URL).flush([...AREAS]);
    controller.expectOne((r) => r.url === LIST_URL).flush([...linhas805]);
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();

    controller.expectNone(GRUPOS_URL);
    const rotulos = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.cell-label--group-label'),
      (el) => el.textContent?.trim(),
    );
    expect(rotulos).toEqual(GRUPOS.map((grupo) => grupo.rotulo));
  });

  it('PesosEnemPage_FalhaDosGruposEmOutraTela_NaoApareceDuranteARecargaAutomatica', async () => {
    // O vocabulário falhou no cadastro de Cursos.
    const catalogo = TestBed.inject(CatalogoGruposAreaEnem);
    catalogo.garantirCarregado();
    controller
      .expectOne(GRUPOS_URL)
      .flush(
        { title: 'Indisponível', status: 503 },
        { status: 503, statusText: 'Service Unavailable' },
      );
    // A tela de Cursos mostrou o alerta dessa falha.
    expect(catalogo.falhou()).toBe(true);

    // Ao entrar em Pesos a lista é pedida de novo; enquanto isso, nenhum alerta.
    const fixture = TestBed.createComponent(PesosEnemPage);
    fixture.detectChanges();
    controller.expectOne(AREAS_URL).flush([...AREAS]);
    controller.expectOne((r) => r.url === LIST_URL).flush([...linhas805]);
    const recarga = controller.expectOne(GRUPOS_URL);
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).not.toContain('Não foi possível carregar');
    expect(raiz.querySelector('#cfg-pesos-enem-grupos-tentar')).toBeNull();

    // A recarga desta visita falha: agora o alerta aparece.
    recarga.flush(
      { title: 'Indisponível', status: 503 },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    expect(raiz.textContent).toContain('Não foi possível carregar os grupos de área do ENEM');
  });
});
