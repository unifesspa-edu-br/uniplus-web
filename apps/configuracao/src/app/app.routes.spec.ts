import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { appRoutes } from './app.routes';

const autenticado = signal(true);
const concedidas = signal<readonly string[]>([]);
const login = vi.fn();

const permissoesStub = {
  garantir: () => Promise.resolve(),
  temAlguma: (...codigos: string[]) => codigos.some((codigo) => concedidas().includes(codigo)),
  temNoModulo: (...modulos: string[]) =>
    concedidas().some((codigo) => modulos.some((modulo) => codigo.startsWith(`${modulo}:`))),
};

describe('appRoutes — acesso pelas permissões efetivas', () => {
  let router: Router;

  beforeEach(() => {
    autenticado.set(true);
    concedidas.set([]);
    login.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(appRoutes),
        { provide: AuthService, useValue: { authenticated: autenticado, login } },
        { provide: PermissoesService, useValue: permissoesStub },
      ],
    });
    router = TestBed.inject(Router);
  });

  async function ir(url: string): Promise<string> {
    await router.navigateByUrl(url);
    return router.url;
  }

  it('abre a tela cuja permissão a pessoa tem', async () => {
    concedidas.set(['configuracao:campi:manter']);

    expect(await ir('/campi')).toBe('/campi');
  });

  it('nega a tela quando falta a permissão dela, ainda que haja outras do módulo', async () => {
    concedidas.set(['configuracao:campi:manter']);

    expect(await ir('/cursos')).toBe('/acesso-negado');
  });

  it('abre o cadastro de Tipo de Ato pela permissão de Publicações', async () => {
    concedidas.set(['publicacoes:tipos-ato:manter']);

    expect(await ir('/tipos-ato')).toBe('/tipos-ato');
  });

  it('abre a lista de tipos de processo só com a consulta', async () => {
    concedidas.set(['configuracao:tipos-processo:consultar']);

    expect(await ir('/tipos-processo')).toBe('/tipos-processo');
  });

  it('nega a edição de modelo de formulário a quem só consulta', async () => {
    concedidas.set(['configuracao:modelos-formulario:consultar']);

    expect(await ir('/modelos-formulario')).toBe('/modelos-formulario');
    expect(await ir('/modelos-formulario/abc')).toBe('/acesso-negado');
  });

  it('sem nenhuma permissão, não abre o módulo e não quebra', async () => {
    expect(await ir('/')).toBe('/acesso-negado');
    expect(await ir('/campi')).toBe('/acesso-negado');
  });

  it('a entrada sem destino leva à primeira tela que a pessoa pode abrir', async () => {
    concedidas.set(['configuracao:cursos:manter', 'configuracao:modalidades:manter']);

    expect(await ir('/')).toBe('/cursos');
  });

  it('abre o pedido de acesso a quem está autenticado e não tem nenhuma permissão', async () => {
    expect(await ir('/acessos/pedidos')).toBe('/acessos/pedidos');
    expect(await ir('/acessos/pedidos/novo')).toBe('/acessos/pedidos/novo');
  });

  it('nega cada tela de administração de acesso sem a permissão dela', async () => {
    concedidas.set(['autorizacao:pedidos:aprovar-funcional']);

    expect(await ir('/acessos/fila-do-gestor')).toBe('/acessos/fila-do-gestor');
    expect(await ir('/acessos/fila-da-protecao-de-dados')).toBe('/acesso-negado');
    expect(await ir('/acessos/concessoes')).toBe('/acesso-negado');
    expect(await ir('/acessos/perfis')).toBe('/acesso-negado');
  });

  it('manda quem não tem sessão ao login', async () => {
    autenticado.set(false);

    await router.navigateByUrl('/campi');

    expect(login).toHaveBeenCalledWith('/campi');
  });
});
