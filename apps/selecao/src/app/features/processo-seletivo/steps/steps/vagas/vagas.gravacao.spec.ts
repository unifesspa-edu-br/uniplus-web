import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { GravacaoDosCamposPressupostos } from '../../shared/campos-pressupostos.service';
import { CatalogosDoCronograma } from '../cronograma/catalogos-do-cronograma.service';
import { VagasStepComponent } from './vagas.component';
import {
  ACEITA_AS_OPCOES,
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
  TelaDasVagas,
  comReleitura,
  declararUmaOpcaoJaGravada,
  distribuicao,
  servicosDe,
} from './vagas.testing';

let servicos: ServicosDasVagas;
let operador: TelaDasVagas;

describe('VagasStepComponent — gravação da distribuição', () => {
  let componente: VagasStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VagasStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicial,
        GravacaoDoProcesso,
        CatalogosDoCronograma,
        GravacaoDosCamposPressupostos,
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
        provideHttpClient(withInterceptors([apiResultInterceptor, ACEITA_AS_OPCOES])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VagasStepComponent);
    componente = fixture.componentInstance;
    servicos = servicosDe(fixture);
    operador = new TelaDasVagas(fixture);
    store = TestBed.inject(ProcessoSeletivoStore);
    declararUmaOpcaoJaGravada(store);
    controller = TestBed.inject(HttpTestingController);

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
    store.patchObjectSection('vagas', {
      ofertas: [distribuicao(OFERTA), distribuicao(OUTRA_OFERTA)],
    });
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  /**
   * A gravação exige a simulação: gravar sem simular é declarar um quadro que ninguém viu.
   *
   * A conferência do operador deixou de ser estado do componente e virou o diálogo que a página
   * abre no instante de gravar — por isso não há mais nada a marcar aqui.
   */
  function simularEConferir(ofertas: readonly string[]): void {
    simular(ofertas);
  }

  function simular(ofertas: readonly string[]): void {
    servicos.simulacao.simular();
    controller.expectOne(ROTA_SIMULACAO).flush(
      ofertas.map((ofertaCursoOrigemId) => ({
        ofertaCursoOrigemId,
        quadro: [{ modalidadeOrigemId: MODALIDADE, modalidadeCodigo: 'AC_I', quantidade: 2 }],
        totalPublicado: 42,
      })),
    );
  }

  /** O comando substitui a configuração inteira: as duas ofertas vão juntas. */
  it('envia a coleção completa num único PUT', async () => {
    simularEConferir([OFERTA, OUTRA_OFERTA]);

    const gravacao = componente.persistir();

    const requisicao = controller.expectOne(ROTA_DISTRIBUICAO);
    expect(requisicao.request.method).toBe('PUT');
    expect(requisicao.request.body).toHaveLength(2);
    expect(requisicao.request.body[0]).toMatchObject({
      ofertaCursoId: OFERTA,
      voBase: 40,
      modalidadeIds: [MODALIDADE],
      quadro: [{ modalidadeId: MODALIDADE, quantidade: 2 }],
    });

    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  /** ADR-0027: comando de escrita viaja com Idempotency-Key. */
  it('envia a gravação com Idempotency-Key', async () => {
    simularEConferir([OFERTA, OUTRA_OFERTA]);

    const gravacao = componente.persistir();

    const requisicao = controller.expectOne(ROTA_DISTRIBUICAO);
    expect(requisicao.request.headers.get('Idempotency-Key')).toBeTruthy();

    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await comReleitura(controller, gravacao);
  });

  /**
   * Cenário de aceite da #541: a recusa da API não pode apagar o formulário —
   * o operador precisa corrigir a partir do que já preencheu.
   */
  it('preserva o rascunho quando a API recusa a coleção', async () => {
    simularEConferir([OFERTA, OUTRA_OFERTA]);

    const gravacao = componente.persistir();

    controller.expectOne(ROTA_DISTRIBUICAO).flush(
      {
        type: 'about:blank',
        title: 'A quantidade de AC_I não pode ser fixada pelo edital.',
        status: 422,
        code: 'uniplus.selecao.configuracao_distribuicao_vagas.quantidade_calculada_nao_informavel',
        traceId: 'trace-1',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const resultado = await comReleitura(controller, gravacao);
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toBeTruthy();
    expect(store.draft().vagas.ofertas).toHaveLength(2);
    expect(store.salvando()).toBe(false);
  });

  /**
   * O que a regra calcula é a maior parte do que será publicado, e só existe
   * depois da simulação: gravar sem ela é declarar um quadro que ninguém viu.
   */
  it('recusa gravar antes de simular o quadro', async () => {
    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('Simule o quadro'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  /** Uma edição descarta o resultado: a conferência é sobre o que está em tela. */
  it('volta a exigir simulação depois de editar o quadro', () => {
    simularEConferir([OFERTA, OUTRA_OFERTA]);
    expect(servicos.estado.simulacaoCobreOQuadro()).toBe(true);

    operador.alterarVoBase(OFERTA, '35');

    expect(store.draft().vagas.ofertas[0].voBase).toBe('35');
    expect(servicos.estado.simulacaoCobreOQuadro()).toBe(false);
  });

  /**
   * Gravar sem simular é declarar um quadro que ninguém viu — e essa continua sendo a recusa do
   * passo. A conferência do operador saiu de `persistir()` e virou o diálogo que a página abre
   * antes de chamar aqui: enquanto era estado do componente, um recarregamento a derrubava e a
   * gravação falhava num passo que o operador não tinha aberto.
   */
  it('recusa gravar sem simular o quadro', async () => {
    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('Simule o quadro'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  /** Simulado e sem pendência, o passo grava — sem pedir marca nenhuma. */
  it('grava depois de simular, sem exigir declaração do operador', async () => {
    simular([OFERTA, OUTRA_OFERTA]);

    expect(componente.validar().valid).toBe(true);
  });

  /** Ninguém confirma um quadro que o passo não vai gravar. */
  it('não oferece confirmação enquanto há pendência', () => {
    expect(componente.confirmacaoDeGravacao()).toBeNull();
  });

  /**
   * O diálogo distingue as linhas pelo rótulo, e duas modalidades de descrição parecida
   * colidiriam — o código de domínio é o que garante a unicidade.
   */
  it('resume o quadro com rótulos únicos e totais que batem com as colunas', () => {
    simular([OFERTA, OUTRA_OFERTA]);

    const confirmacao = componente.confirmacaoDeGravacao();
    if (confirmacao === null) throw new Error('o quadro simulado e sem pendência deve confirmar');

    const rotulos = confirmacao.itens.map((item) => item.rotulo);
    expect(new Set(rotulos).size).toBe(rotulos.length);
    expect(rotulos).toContain('Ofertas de curso no quadro');
    expect(confirmacao.itens.find((i) => i.rotulo === 'Ofertas de curso no quadro')?.valor).toBe(
      String(servicos.estado.distribuicoes().length),
    );
  });

  /**
   * Sob a Lei 12.711 a suplementar ACRESCE ao total da oferta, então o que o edital publica
   * pode ser maior que a soma das vagas informadas. O diálogo diz representar o quadro
   * publicado, e pedia confirmação do número menor — com o rótulo do maior.
   */
  it('confirma os dois totais quando o publicado difere do informado', () => {
    simular([OFERTA, OUTRA_OFERTA]);

    const confirmacao = componente.confirmacaoDeGravacao();
    if (confirmacao === null) throw new Error('o quadro simulado e sem pendência deve confirmar');

    const informadas = confirmacao.itens.find((i) => i.rotulo === 'Vagas informadas nas ofertas');
    const publicado = confirmacao.itens.find((i) => i.rotulo.startsWith('Total publicado'));

    expect(informadas?.valor, 'duas ofertas de 40 vagas informadas').toBe('80');
    expect(
      publicado?.valor,
      'duas ofertas cujo cálculo da regra publica 42 — é este o total do edital',
    ).toBe('84');
  });

  /**
   * Editar o quadro invalida a simulação — e é a simulação, não uma marca do operador, que o
   * passo exige antes de gravar. Era isso que o checkbox protegia indiretamente; agora a
   * invariante está sozinha, e sem estado que possa envelhecer entre o clique e a gravação.
   */
  it('editar o quadro derruba a simulação e volta a impedir a gravação', () => {
    simularEConferir([OFERTA, OUTRA_OFERTA]);
    expect(componente.validar().valid).toBe(true);

    operador.alterarVoBase(OFERTA, '35');

    expect(store.draft().vagas.ofertas[0].voBase).toBe('35');
    expect(servicos.estado.simulacaoCobreOQuadro()).toBe(false);
    expect(componente.validar().valid).toBe(false);
  });

  /**
   * A resposta descreveria o quadro anterior, e a conferência — que só olha se
   * cada oferta tem resultado — a aceitaria como atual. Abandonar a requisição
   * resolve os dois lados: nada obsoleto é instalado, e o botão de simular fica
   * livre para o quadro novo em vez de esperar por um resultado que será
   * ignorado.
   */
  it('abandona a simulação em voo quando o quadro muda', async () => {
    servicos.simulacao.simular();
    const requisicao = controller.expectOne(ROTA_SIMULACAO);
    expect(servicos.simulacao.simulando()).toBe(true);

    operador.alterarVoBase(OFERTA, '35');

    expect(store.draft().vagas.ofertas[0].voBase).toBe('35');
    expect(requisicao.cancelled).toBe(true);
    expect(servicos.simulacao.simulando()).toBe(false);
    expect(servicos.estado.simulacaoCobreOQuadro()).toBe(false);

    const resultado = await comReleitura(controller, componente.persistir());
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('Simule o quadro'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  /** Simular de novo não deixa a requisição anterior competindo pelo resultado. */
  it('abandona a simulação anterior ao simular outra vez', () => {
    servicos.simulacao.simular();
    const primeira = controller.expectOne(ROTA_SIMULACAO);

    servicos.simulacao.simular();
    const segunda = controller.expectOne(ROTA_SIMULACAO);

    expect(primeira.cancelled).toBe(true);
    expect(segunda.cancelled).toBe(false);
    expect(servicos.simulacao.simulando()).toBe(true);
  });

  /** Sem edição no meio, a resposta é a do quadro em tela e vale. */
  it('instala a simulação quando o quadro não mudou', () => {
    simular([OFERTA, OUTRA_OFERTA]);

    expect(servicos.estado.simulacaoCobreOQuadro()).toBe(true);
  });

  /**
   * A rota é reusada entre processos e `store.reset()` não alcança signal de
   * componente. Como a cobertura é verificada por id de oferta, o resultado do
   * processo anterior valeria para o novo sempre que as ofertas coincidissem —
   * e são as mesmas quando os dois usam o catálogo de cursos da instituição.
   */
  it('descarta a simulação ao trocar de processo', () => {
    simularEConferir([OFERTA, OUTRA_OFERTA]);
    expect(servicos.estado.simulacaoCobreOQuadro()).toBe(true);

    trocarDeProcesso();

    expect(servicos.estado.simulacaoCobreOQuadro()).toBe(false);
  });

  /** O padrão guardado pertence ao processo em que foi guardado. */
  it('descarta o padrão preservado ao trocar de processo', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    operador.pedirRemocao(OFERTA);
    operador.confirmarRemocao();
    expect(servicos.estado.padrao().regraDistribuicaoCodigo).toBe('DISTRIB-VAGAS-INSTITUCIONAL');

    trocarDeProcesso();

    expect(servicos.estado.padrao().regraDistribuicaoCodigo).toBe('');
    expect(servicos.estado.padrao().modalidades).toEqual([]);
  });

  /**
   * O contrato guarda regra e percentual por oferta, então um processo criado
   * por outro caminho pode chegar heterogêneo. A tela mostra o padrão da
   * primeira e enviaria os valores de cada uma: gravar assim seria confirmar
   * um quadro e declarar outro.
   */
  it('recusa gravar com oferta fora do padrão em tela', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicao(OFERTA), { ...distribuicao(OUTRA_OFERTA), pr: '0,75' }],
    });

    expect(servicos.estado.ofertasForaDoPadrao()).toHaveLength(1);

    const resultado = await comReleitura(controller, componente.persistir());
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('diferentes do padrão'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  it('uniformiza o quadro ao aplicar o padrão a todas', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicao(OFERTA), { ...distribuicao(OUTRA_OFERTA), pr: '0,75' }],
    });
    operador.atualizar();

    operador.aplicarPadraoATodas();

    expect(servicos.estado.ofertasForaDoPadrao()).toEqual([]);
    expect(store.draft().vagas.ofertas.map((item) => item.pr)).toEqual(['0,5', '0,5']);
  });

  /** A troca de processo devolve o botão de simular ao processo novo. */
  it('desliga o indicador de simulação ao trocar de processo', () => {
    servicos.simulacao.simular();
    controller.expectOne(ROTA_SIMULACAO);
    expect(servicos.simulacao.simulando()).toBe(true);

    trocarDeProcesso();

    expect(servicos.simulacao.simulando()).toBe(false);
  });

  /** O que sobra do processo anterior não pertence ao que está aberto. */
  it('descarta o restante do estado local ao trocar de processo', () => {
    servicos.estado.ofertasMarcadas.set(new Set([OFERTA]));
    servicos.estado.filtroDeOferta.set('medicina');
    operador.pedirRemocao(OUTRA_OFERTA);
    servicos.estado.erroDaSimulacao.set('falha anterior');

    trocarDeProcesso();

    expect(servicos.estado.ofertasMarcadas().size).toBe(0);
    expect(servicos.estado.filtroDeOferta()).toBe('');
    expect(servicos.estado.remocaoPendente()).toBeNull();
    expect(servicos.estado.erroDaSimulacao()).toBeNull();
  });

  /** O editor reusa o componente; quem troca de processo é a geração do store. */
  function trocarDeProcesso(): void {
    store.geracao.update((valor) => valor + 1);
    TestBed.tick();
  }

  /** Sem processo criado não há o que gravar, e o comando não sai. */
  it('recusa gravar antes de o processo existir', async () => {
    store.processoSeletivoId.set(null);

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  /**
   * O comando não sai de um passo que a validação recusaria: os campos são
   * texto, e o que não é número viraria zero no envio.
   */
  it('não envia comando quando a validação do passo recusa', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [{ ...distribuicao(OFERTA), voBase: '' }],
    });

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });
});
