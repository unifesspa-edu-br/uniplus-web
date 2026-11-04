import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import {
  ProcessoSeletivoDto,
  SELECAO_BASE_PATH,
  StatusProcesso,
} from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { CamposPressupostosService } from '../../shared/campos-pressupostos.service';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { VagasStepComponent } from './vagas.component';
import {
  BASE,
  LISTA_DE_CURSOS,
  MODALIDADE,
  MODALIDADES,
  OFERTA,
  OFERTAS,
  OUTRA_OFERTA,
  PROCESSO_ID,
  ROTA_DISTRIBUICAO,
  ROTA_SIMULACAO,
  ServicosDasVagas,
  comReleitura,
  distribuicao,
  servicosDe,
} from './vagas.testing';

let servicos: ServicosDasVagas;

describe('VagasStepComponent — número de opções de curso', () => {
  const ROTA_OPCOES = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/opcoes-de-curso`;
  const ROTA_PROCESSO_RELIDO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
  const TEXTO = 'Com 2 opções de curso, cadastre pelo menos dois cursos.';

  let componente: VagasStepComponent;
  let fixture: ComponentFixture<VagasStepComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let tela: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VagasStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        GravacaoDoProcesso,
        CatalogosDoCronogramaService,
        CamposPressupostosService,
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VagasStepComponent);
    componente = fixture.componentInstance;
    servicos = servicosDe(fixture);
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    tela = fixture.nativeElement as HTMLElement;
    // O foco só se aplica a elemento que está no documento.
    document.body.appendChild(tela);

    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('ofertas-curso')) requisicao.flush(OFERTAS);
      else if (url.includes('cursos')) requisicao.flush(LISTA_DE_CURSOS);
      else if (url.includes('modalidades')) requisicao.flush(MODALIDADES);
      else requisicao.flush([]);
    }
    fixture.detectChanges();
    store.processoSeletivoId.set(PROCESSO_ID);
  });

  afterEach(() => {
    controller.verify();
    tela.remove();
  });

  const SEM_CORPO = { status: 204, statusText: 'No Content' };
  const proximoTick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const campo = () => tela.querySelector('#f-opcoes-curso') as HTMLSelectElement;

  function escolherNumero(numero: string): void {
    campo().value = numero;
    campo().dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function ofertas(...ids: string[]): void {
    store.patchObjectSection('vagas', { ofertas: ids.map(distribuicao) });
    fixture.detectChanges();
    servicos.simulacao.simular();
    controller.expectOne(ROTA_SIMULACAO).flush(
      ids.map((ofertaCursoOrigemId) => ({
        ofertaCursoOrigemId,
        quadro: [{ modalidadeOrigemId: MODALIDADE, modalidadeCodigo: 'AC_I', quantidade: 2 }],
        totalPublicado: 42,
      })),
    );
    fixture.detectChanges();
  }

  /** O número que o servidor tem gravado, na leitura mais recente. */
  function gravado(numero: number): void {
    store.opcoesDeCursoGravadas.set(numero);
  }

  const recusa422 = (code: string) => ({
    body: {
      type: 'about:blank',
      title: 'Recusado.',
      status: 422,
      code,
      traceId: 'trace-1',
    },
    opts: {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'content-type': 'application/problem+json' },
    },
  });

  it('mostra o número de opções como primeiro campo do padrão, antes da regra, com a ajuda', () => {
    const regra = tela.querySelector('#f-regra') as HTMLElement;

    expect(campo()).not.toBeNull();
    expect(campo().compareDocumentPosition(regra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tela.querySelector('#f-opcoes-curso-ajuda')?.textContent).toContain(
      'Quantos cursos o candidato escolhe na inscrição. Com 2 opções, cadastre pelo menos dois cursos.',
    );
  });

  it('com 2 opções e 1 curso, bloqueia sem chamar a API e mostra o erro ligado ao campo', async () => {
    ofertas(OFERTA);
    escolherNumero('2');

    const resultado = await componente.persistir();
    await proximoTick();
    fixture.detectChanges();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain(TEXTO);
    controller.expectNone(ROTA_OPCOES);
    controller.expectNone(ROTA_DISTRIBUICAO);
    const erro = tela.querySelector('#f-opcoes-curso-erro');
    expect(erro?.textContent).toContain(TEXTO);
    expect(erro?.closest('[aria-live]')).not.toBeNull();
    expect(campo().getAttribute('aria-describedby')).toContain('f-opcoes-curso-erro');
    expect(campo().getAttribute('aria-invalid')).toBe('true');
  });

  it('não acusa o erro antes de o operador tentar avançar', () => {
    ofertas(OFERTA);
    escolherNumero('2');

    expect(tela.querySelector('#f-opcoes-curso-erro')).toBeNull();
  });

  it('exige o número declarado', async () => {
    ofertas(OFERTA);

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain('Informe o número de opções de curso.');
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  it('com 2 opções e 2 cursos, grava a distribuição e depois o número', async () => {
    ofertas(OFERTA, OUTRA_OFERTA);
    escolherNumero('2');

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await proximoTick();
    const opcoes = controller.expectOne(ROTA_OPCOES);
    expect(opcoes.request.method).toBe('PUT');
    expect(opcoes.request.body).toEqual({ numero: 2 });
    expect(opcoes.request.headers.get('Idempotency-Key')).toBeTruthy();
    opcoes.flush(null, SEM_CORPO);

    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  it('reduzir cursos e opções grava o número primeiro e só então a distribuição', async () => {
    gravado(2);
    ofertas(OFERTA);
    escolherNumero('1');

    const gravacao = componente.persistir();
    // A distribuição só sai depois de o número baixar: com a ordem inversa o servidor a recusaria.
    controller.expectNone(ROTA_DISTRIBUICAO);
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);

    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  it('aumentar cursos e opções grava a distribuição primeiro e só então o número', async () => {
    gravado(1);
    ofertas(OFERTA, OUTRA_OFERTA);
    escolherNumero('2');

    const gravacao = componente.persistir();
    controller.expectNone(ROTA_OPCOES);
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);

    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  it('grava sempre os dois, mesmo com o quadro e o número iguais aos gravados', async () => {
    gravado(2);
    ofertas(OFERTA, OUTRA_OFERTA);
    store.patchObjectSection('opcoesDeCurso', { numero: '2' });
    fixture.detectChanges();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);

    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  it('relê o processo antes de decidir a ordem quando a gravação anterior ficou inconclusiva', async () => {
    gravado(1);
    ofertas(OFERTA);
    escolherNumero('1');
    store.vagasGravadasDefasadas.set(true);

    const gravacao = componente.persistir();
    // Outra aba ou uma resposta perdida deixou o servidor com 2 opções e 2 ofertas: o número baixa primeiro.
    controller.expectNone(ROTA_OPCOES);
    controller.expectOne(ROTA_PROCESSO_RELIDO).flush({ opcoesDeCurso: { numero: 2 } });
    await proximoTick();
    controller.expectNone(ROTA_DISTRIBUICAO);
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);

    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  it('o erro vindo da API some quando o quadro muda', async () => {
    gravado(1);
    ofertas(OFERTA, OUTRA_OFERTA);
    escolherNumero('2');
    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await proximoTick();
    const { body, opts } = recusa422(
      'uniplus.selecao.processo_seletivo.opcoes_de_curso_acima_das_ofertas',
    );
    controller.expectOne(ROTA_OPCOES).flush(body, opts);
    await gravacao;
    fixture.detectChanges();
    expect(tela.querySelector('#f-opcoes-curso-erro')).not.toBeNull();

    store.patchObjectSection('vagas', {
      ofertas: [distribuicao(OFERTA), distribuicao(OUTRA_OFERTA), distribuicao('terceira')],
    });
    fixture.detectChanges();

    expect(tela.querySelector('#f-opcoes-curso-erro')).toBeNull();
  });

  it('o diálogo de confirmação lista o número de opções de curso', () => {
    ofertas(OFERTA, OUTRA_OFERTA);
    escolherNumero('2');

    const itens = componente.confirmacaoDeGravacao()?.itens ?? [];

    expect(itens).toContainEqual({ rotulo: 'Número de opções de curso', valor: '2 opções' });
  });

  it('mostra no campo, com o mesmo texto, a recusa da API ao gravar o número', async () => {
    gravado(1);
    ofertas(OFERTA, OUTRA_OFERTA);
    escolherNumero('2');

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await proximoTick();
    const { body, opts } = recusa422(
      'uniplus.selecao.processo_seletivo.opcoes_de_curso_acima_das_ofertas',
    );
    controller.expectOne(ROTA_OPCOES).flush(body, opts);

    const resultado = await gravacao;
    fixture.detectChanges();

    expect(resultado).toEqual({
      valid: false,
      messages: [`A distribuição de vagas foi gravada. ${TEXTO}`],
    });
    expect(tela.querySelector('#f-opcoes-curso-erro')?.textContent).toContain(TEXTO);
  });

  it('mostra no mesmo campo a recusa da API sem campo, vinda da gravação da distribuição', async () => {
    gravado(2);
    ofertas(OFERTA);
    escolherNumero('1');

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);
    await proximoTick();
    const { body, opts } = recusa422(
      'uniplus.selecao.processo_seletivo.opcoes_de_curso_acima_das_ofertas',
    );
    controller.expectOne(ROTA_DISTRIBUICAO).flush(body, opts);

    const resultado = await gravacao;
    fixture.detectChanges();

    expect(resultado.messages).toEqual([`O número de opções de curso foi gravado. ${TEXTO}`]);
    expect(tela.querySelector('#f-opcoes-curso-erro')?.textContent).toContain(TEXTO);
  });

  it('guarda o número gravado e relê o processo quando a releitura depois da gravação falha', async () => {
    gravado(1);
    ofertas(OFERTA, OUTRA_OFERTA);
    escolherNumero('2');

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_PROCESSO_RELIDO).flush(null, { status: 500, statusText: 'Erro' });
    await gravacao;

    expect(store.opcoesDeCursoGravadas()).toBe(2);
    expect(store.vagasGravadasDefasadas()).toBe(true);

    // Com o número 2 gravado, reduzir para 1 curso e 1 opção só passa baixando o número antes.
    ofertas(OFERTA);
    escolherNumero('1');
    const segunda = componente.persistir();
    controller.expectOne(ROTA_PROCESSO_RELIDO).flush({ opcoesDeCurso: { numero: 2 } });
    await proximoTick();
    controller.expectNone(ROTA_DISTRIBUICAO);
    controller.expectOne(ROTA_OPCOES).flush(null, SEM_CORPO);
    await proximoTick();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, SEM_CORPO);
    await expect(comReleitura(controller, segunda)).resolves.toEqual({ valid: true });
  });

  it('trata o conflito de idempotência em andamento como resposta inconclusiva', async () => {
    gravado(1);
    ofertas(OFERTA);
    escolherNumero('1');

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(
      {
        type: 'about:blank',
        title: 'Em andamento.',
        status: 409,
        code: 'uniplus.idempotency.processing_conflict',
        traceId: 'trace-1',
      },
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await gravacao;

    expect(store.vagasGravadasDefasadas()).toBe(true);
  });

  it('descarta o erro do campo ao trocar de processo na mesma rota', async () => {
    ofertas(OFERTA);
    escolherNumero('2');
    await componente.persistir();
    fixture.detectChanges();
    expect(tela.querySelector('#f-opcoes-curso-erro')).not.toBeNull();

    store.geracao.update((valor) => valor + 1);
    TestBed.tick();
    fixture.detectChanges();

    expect(tela.querySelector('#f-opcoes-curso-erro')).toBeNull();
  });

  it('em consulta, lê o número gravado como texto', () => {
    store.patchObjectSection('opcoesDeCurso', { numero: '2' });
    store.remoteSnapshot.set({
      status: StatusProcesso.publicado,
    } as unknown as ProcessoSeletivoDto);
    fixture.detectChanges();

    expect(campo()).toBeNull();
    expect((tela.textContent ?? '').replace(/\s+/g, ' ')).toContain(
      'Número de opções de curso 2 opções',
    );
  });
});
