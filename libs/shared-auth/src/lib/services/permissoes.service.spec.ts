import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { AUTORIZACAO_BASE_PATH } from '../tokens/auth.tokens';
import { AuthService } from './auth.service';
import { PermissoesService } from './permissoes.service';

const URL = 'http://api.test/api/autorizacao/permissoes/efetivas';

const MOTIVOS = { codigo: 'selecao:motivos-decisao-isencao:manter', nome: 'Manter motivos' };
const CAMPI = { codigo: 'configuracao:campi:manter', nome: 'Manter campi' };

describe('PermissoesService', () => {
  const sessao = signal<string | null>(null);
  let http: HttpTestingController;
  let service: PermissoesService;

  beforeEach(() => {
    sessao.set('leandro:0');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        { provide: AuthService, useValue: { sessao } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PermissoesService);
  });

  afterEach(() => http.verify());

  async function carregar(permissoes: unknown[]): Promise<void> {
    const pronta = service.garantir();
    http.expectOne(URL).flush(permissoes);
    await pronta;
  }

  it('consulta a API com o media type versionado e expõe os códigos recebidos', async () => {
    const pronta = service.garantir();
    const requisicao = http.expectOne(URL);
    expect(requisicao.request.headers.get('Accept')).toBe(
      'application/vnd.uniplus.permissao-efetiva.v1+json',
    );
    requisicao.flush([MOTIVOS, CAMPI]);
    await pronta;

    expect(service.estado()).toBe('carregada');
    expect(service.tem('selecao:motivos-decisao-isencao:manter')).toBe(true);
    expect(service.tem('selecao:processos:configurar')).toBe(false);
    expect(service.temAlguma('selecao:processos:configurar', 'configuracao:campi:manter')).toBe(
      true,
    );
    expect(service.temNoModulo('configuracao')).toBe(true);
    expect(service.temNoModulo('publicacoes', 'organizacao')).toBe(false);
  });

  it('carrega uma vez por sessão, ainda que várias partes perguntem', async () => {
    const primeira = service.garantir();
    const segunda = service.garantir();
    http.expectOne(URL).flush([CAMPI]);
    await Promise.all([primeira, segunda]);

    await service.garantir();

    expect(service.tem('configuracao:campi:manter')).toBe(true);
  });

  it('recarrega na troca de sessão e descarta as permissões do usuário anterior', async () => {
    await carregar([MOTIVOS]);

    sessao.set('caroline:0');
    const pronta = service.garantir();

    expect(service.estado()).toBe('carregando');
    expect(service.tem('selecao:motivos-decisao-isencao:manter')).toBe(false);
    http.expectOne(URL).flush([CAMPI]);
    await pronta;

    expect(service.tem('selecao:motivos-decisao-isencao:manter')).toBe(false);
    expect(service.tem('configuracao:campi:manter')).toBe(true);
  });

  it('recarrega na renovação do token sem esvaziar as permissões do mesmo usuário', async () => {
    await carregar([MOTIVOS]);

    sessao.set('leandro:1');
    const pronta = service.garantir();
    expect(service.tem('selecao:motivos-decisao-isencao:manter')).toBe(true);
    http.expectOne(URL).flush([CAMPI]);
    await pronta;

    expect(service.tem('selecao:motivos-decisao-isencao:manter')).toBe(false);
    expect(service.tem('configuracao:campi:manter')).toBe(true);
  });

  it('esvazia as permissões no logout e não consulta a API sem sessão', async () => {
    await carregar([MOTIVOS]);

    sessao.set(null);
    await service.garantir();

    expect(service.estado()).toBe('pendente');
    expect(service.codigos().size).toBe(0);
    http.expectNone(URL);
  });

  it('trata a lista vazia sem erro', async () => {
    await carregar([]);

    expect(service.estado()).toBe('carregada');
    expect(service.tem('selecao:processos:configurar')).toBe(false);
    expect(service.temNoModulo('selecao')).toBe(false);
  });

  it('fica sem permissões quando a API recusa (401)', async () => {
    const pronta = service.garantir();
    http.expectOne(URL).flush(
      { type: 'about:blank', title: 'Unauthorized', status: 401 },
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await pronta;

    expect(service.estado()).toBe('indisponivel');
    expect(service.codigos().size).toBe(0);
  });

  it('esvazia as permissões da mesma pessoa quando a recarga da renovação falha por rede', async () => {
    await carregar([MOTIVOS]);

    sessao.set('leandro:1');
    const pronta = service.garantir();
    http.expectOne(URL).error(new ProgressEvent('error'));
    await pronta;

    expect(service.estado()).toBe('indisponivel');
    expect(service.codigos().size).toBe(0);
  });

  it('não leva as permissões de uma pessoa para outra quando a recarga falha por rede', async () => {
    await carregar([MOTIVOS]);

    sessao.set('betina:0');
    const pronta = service.garantir();
    http.expectOne(URL).error(new ProgressEvent('error'));
    await pronta;

    expect(service.estado()).toBe('indisponivel');
    expect(service.tem('selecao:motivos-decisao-isencao:manter')).toBe(false);
  });

  it('ignora a resposta de uma sessão que já foi substituída', async () => {
    const antiga = service.garantir();
    const requisicaoAntiga = http.expectOne(URL);

    sessao.set('caroline:0');
    const atual = service.garantir();
    const requisicaoAtual = http.expectOne(URL);

    requisicaoAtual.flush([CAMPI]);
    await atual;
    requisicaoAntiga.flush([MOTIVOS]);
    await antiga;

    expect(service.tem('configuracao:campi:manter')).toBe(true);
    expect(service.tem('selecao:motivos-decisao-isencao:manter')).toBe(false);
  });

  it('descarta a resposta antiga entregue depois da troca de sessão e antes de qualquer sincronização', async () => {
    const antiga = service.garantir();
    const requisicaoAntiga = http.expectOne(URL);

    sessao.set('caroline:0');
    requisicaoAntiga.flush([MOTIVOS]);
    await Promise.resolve();

    expect(service.tem('selecao:motivos-decisao-isencao:manter')).toBe(false);

    http.expectOne(URL).flush([CAMPI]);
    await antiga;
    await service.garantir();
    expect(service.tem('configuracao:campi:manter')).toBe(true);
    expect(service.tem('selecao:motivos-decisao-isencao:manter')).toBe(false);
  });

  it('garantir aguarda a carga da sessão vigente quando uma renovação ocorre durante a consulta', async () => {
    const pronta = service.garantir();
    const primeira = http.expectOne(URL);

    sessao.set('leandro:1');
    primeira.flush([MOTIVOS]);
    await new Promise((resolver) => setTimeout(resolver));
    http.expectOne(URL).flush([MOTIVOS, CAMPI]);
    await pronta;

    expect(service.estado()).toBe('carregada');
    expect(service.tem('selecao:motivos-decisao-isencao:manter')).toBe(true);
    expect(service.tem('configuracao:campi:manter')).toBe(true);
  });

  it('recarrega sozinho quando a sessão muda, sem depender de quem pergunta', async () => {
    TestBed.tick();
    http.expectOne(URL).flush([CAMPI]);
    await service.garantir();

    sessao.set('betina:0');
    TestBed.tick();
    http.expectOne(URL).flush([MOTIVOS]);
    await service.garantir();

    expect(service.tem('selecao:motivos-decisao-isencao:manter')).toBe(true);
  });
});
