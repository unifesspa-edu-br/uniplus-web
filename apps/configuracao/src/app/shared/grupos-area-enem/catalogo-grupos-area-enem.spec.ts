import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  GruposAreaEnemApi,
  type GrupoAreaEnemDto,
} from '@uniplus/shared-data/configuracao';
import { throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoGruposAreaEnem } from './catalogo-grupos-area-enem';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/vocabularios/grupos-area-enem`;

const tecnologica: GrupoAreaEnemDto = { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' };
const saude: GrupoAreaEnemDto = { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' };

describe('CatalogoGruposAreaEnem', () => {
  let catalogo: CatalogoGruposAreaEnem;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    catalogo = TestBed.inject(CatalogoGruposAreaEnem);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('busca o vocabulário uma vez, mantém a ordem da API e o expõe indexado por código', () => {
    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([saude, tecnologica]);

    // Segunda chamada reaproveita o que já chegou: nenhuma requisição nova.
    catalogo.garantirCarregado();
    controller.expectNone(URL);

    expect(catalogo.opcoes().map((grupo) => grupo.codigo)).toEqual([
      'SAUDE_E_BIOLOGICAS',
      'TECNOLOGICA',
    ]);
    expect(catalogo.porCodigo().get('TECNOLOGICA')?.rotulo).toBe('Tecnológica');
    expect(catalogo.comErro()).toBe(false);
  });

  it('sinaliza recusa quando o vocabulário não chega, e tenta de novo na próxima chamada', () => {
    catalogo.garantirCarregado();
    controller
      .expectOne(URL)
      .flush({ title: 'Indisponível', status: 503 }, { status: 503, statusText: 'Service Unavailable' });

    expect(catalogo.comErro()).toBe(true);
    expect(catalogo.opcoes().length).toBe(0);

    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([tecnologica]);
    expect(catalogo.comErro()).toBe(false);
    expect(catalogo.opcoes().length).toBe(1);
  });

  it('vocabulário só com itens sem código é falha de carga, com alerta', () => {
    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([{ codigo: ' ', rotulo: 'X' }]);

    expect(catalogo.opcoes()).toEqual([]);
    expect(catalogo.comErro()).toBe(true);
    expect(catalogo.falhou()).toBe(true);
  });

  it('recarga só com itens sem código mantém a lista anterior como reserva, sem alerta', () => {
    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([tecnologica]);

    catalogo.recarregar();
    controller.expectOne(URL).flush([{ codigo: ' ', rotulo: 'X' }]);

    expect(catalogo.opcoes().map((grupo) => grupo.codigo)).toEqual(['TECNOLOGICA']);
    expect(catalogo.comErro()).toBe(true);
    expect(catalogo.falhou()).toBe(false);
  });

  it('lista vazia é falha de carga: o vocabulário sempre tem grupos', () => {
    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([]);

    expect(catalogo.comErro()).toBe(true);
    expect(catalogo.falhou()).toBe(true);

    // Por ser falha, a próxima chamada tenta de novo.
    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([tecnologica]);
    expect(catalogo.comErro()).toBe(false);
  });

  it('erro que escapa do envelope também é falha, e não deixa a carga presa', () => {
    vi.spyOn(TestBed.inject(GruposAreaEnemApi), 'listar').mockReturnValueOnce(
      throwError(() => new Error('falha fora do envelope')),
    );
    catalogo.garantirCarregado();

    expect(catalogo.pendente()).toBe(false);
    expect(catalogo.comErro()).toBe(true);
    expect(catalogo.falhou()).toBe(true);
  });

  it('falhou guarda a falha anterior enquanto corre a tentativa pedida pelo operador', () => {
    catalogo.garantirCarregado();
    controller
      .expectOne(URL)
      .flush({ title: 'Indisponível', status: 503 }, { status: 503, statusText: 'Service Unavailable' });
    expect(catalogo.falhou()).toBe(true);

    catalogo.tentarDeNovo();
    // A nova tentativa começou: comErro volta a false, mas o alerta não pode sumir ainda.
    expect(catalogo.pendente()).toBe(true);
    expect(catalogo.comErro()).toBe(false);
    expect(catalogo.falhou()).toBe(true);

    controller.expectOne(URL).flush([tecnologica]);
    expect(catalogo.falhou()).toBe(false);
  });

  it('recarga automática não mostra a falha de outra visita enquanto corre, e mostra a que acontecer', () => {
    // Uma tela falhou antes.
    catalogo.garantirCarregado();
    controller
      .expectOne(URL)
      .flush({ title: 'Indisponível', status: 503 }, { status: 503, statusText: 'Service Unavailable' });
    expect(catalogo.falhou()).toBe(true);

    // Outra tela abre e recarrega sozinha: enquanto corre, nenhuma falha é anunciada.
    catalogo.garantirCarregado();
    expect(catalogo.pendente()).toBe(true);
    expect(catalogo.falhou()).toBe(false);

    // Esta recarga também falha: agora o alerta é desta visita.
    controller
      .expectOne(URL)
      .flush({ title: 'Indisponível', status: 503 }, { status: 503, statusText: 'Service Unavailable' });
    expect(catalogo.falhou()).toBe(true);
  });

  it('tela nova que pede a lista durante o "Tentar novamente" de outra não herda a falha', () => {
    catalogo.garantirCarregado();
    controller
      .expectOne(URL)
      .flush({ title: 'Indisponível', status: 503 }, { status: 503, statusText: 'Service Unavailable' });
    // A tela mostra o alerta da falha, e o operador pede de novo.
    expect(catalogo.falhou()).toBe(true);
    catalogo.tentarDeNovo();
    expect(catalogo.falhou()).toBe(true);

    // Outra tela abre enquanto a tentativa corre: ela não repete o pedido, e a tentativa
    // passa a contar como automática.
    catalogo.garantirCarregado();
    expect(catalogo.falhou()).toBe(false);
    controller.expectOne(URL).flush([tecnologica]);
    expect(catalogo.falhou()).toBe(false);
  });

  it('recarga que falha com a lista anterior em memória não mostra falha: a tela segue com ela', () => {
    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([tecnologica, saude]);
    expect(catalogo.falhou()).toBe(false);

    catalogo.recarregar();
    controller
      .expectOne(URL)
      .flush({ title: 'Indisponível', status: 503 }, { status: 503, statusText: 'Service Unavailable' });

    // A última tentativa falhou (a próxima chamada tenta de novo), mas há lista utilizável.
    expect(catalogo.comErro()).toBe(true);
    expect(catalogo.opcoes().map((grupo) => grupo.codigo)).toEqual(['TECNOLOGICA', 'SAUDE_E_BIOLOGICAS']);
    expect(catalogo.falhou()).toBe(false);
  });

  it('recarga que volta vazia com a lista anterior em memória mantém a lista, sem falha na tela', () => {
    catalogo.garantirCarregado();
    controller.expectOne(URL).flush([tecnologica, saude]);

    catalogo.recarregar();
    controller.expectOne(URL).flush([]);

    expect(catalogo.opcoes().map((grupo) => grupo.codigo)).toEqual(['TECNOLOGICA', 'SAUDE_E_BIOLOGICAS']);
    expect(catalogo.falhou()).toBe(false);
    // A resposta vazia ainda conta como falha da tentativa: a próxima chamada tenta de novo.
    expect(catalogo.comErro()).toBe(true);
  });

  it('recarregar descarta a tentativa em andamento e busca de novo, como diz o contrato do lookup', () => {
    catalogo.garantirCarregado();
    catalogo.recarregar();

    const [primeiro, segundo] = controller.match(URL);
    expect(primeiro?.cancelled).toBe(true);
    expect(segundo?.cancelled).toBe(false);
    segundo?.flush([tecnologica]);
    expect(catalogo.opcoes().map((grupo) => grupo.codigo)).toEqual(['TECNOLOGICA']);
  });
});
