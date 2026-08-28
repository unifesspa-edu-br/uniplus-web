import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { FundamentoIsencao, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { PagamentoStepComponent } from './pagamento.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
const ROTA_FUNDAMENTOS = `${BASE}/api/selecao/fundamentos-isencao`;
const ROTA_TAXA = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/taxa-inscricao`;

const CATALOGO = [
  { codigo: 'CADASTRO_UNICO', nome: 'Cadastro Único', descricao: 'Baixa renda inscrita no CadÚnico.' },
  { codigo: 'DOACAO_MEDULA_OSSEA', nome: 'Doação de medula óssea', descricao: 'Candidato doador.' },
  {
    codigo: 'CARENCIA_SOCIOECONOMICA',
    nome: 'Carência socioeconômica',
    descricao: 'Renda até 1,5 salário mínimo e ensino médio em escola pública.',
  },
];

function problema(status: number, code: string, title: string) {
  return {
    body: { type: 'about:blank', title, status, code, traceId: 'trace-1' },
    opts: { status, statusText: title, headers: { 'Content-Type': 'application/problem+json' } },
  };
}

describe('PagamentoStepComponent', () => {
  let componente: PagamentoStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let host: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PagamentoStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PagamentoStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    host = fixture.nativeElement as HTMLElement;
    detectar = () => fixture.detectChanges();

    controller.expectOne(ROTA_FUNDAMENTOS).flush(CATALOGO);
    detectar();
    store.processoSeletivoId.set(PROCESSO_ID);
  });

  afterEach(() => controller.verify());

  function tick(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /** Ausência de declaração não é "não cobra" — a publicação recusa quem não declarou. */
  it('exige a declaração de cobrança', () => {
    expect(componente.validate().valid).toBe(false);
    expect(componente.validate().messages?.[0]).toContain('Declare se o processo cobra');
  });

  it('exige valor positivo quando declara cobrança', () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '0' });

    expect(componente.validate().valid).toBe(false);
    expect(componente.validate().messages?.[0]).toContain('maior que zero');
  });

  it('aceita ausência de valor quando o processo é gratuito', () => {
    store.patchObjectSection('pagamento', { cobra: false, valor: '' });

    expect(componente.validate().valid).toBe(true);
  });

  /** UNI-REQ-0099: zero fundamentos é estado válido para processo que cobra. */
  it('aceita cobrança sem nenhum fundamento de isenção', () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '150,00', fundamentos: [] });

    expect(componente.validate().valid).toBe(true);
  });

  it('exige confirmação explícita quando há fundamento referenciado', () => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '150,00',
      fundamentos: ['CADASTRO_UNICO'],
      confirmacaoFundamentos: false,
    });

    expect(componente.validate().valid).toBe(false);
    expect(componente.validate().messages?.[0]).toContain('Confirme os fundamentos');
  });

  /** Sem fundamento não há o que confirmar; a confirmação gravada mentiria. */
  it('descarta a confirmação ao remover o último fundamento', () => {
    componente.alternarFundamento('CADASTRO_UNICO');
    store.patchObjectSection('pagamento', { confirmacaoFundamentos: true });

    componente.alternarFundamento('CADASTRO_UNICO');

    expect(store.draft().pagamento.fundamentos).toEqual([]);
    expect(store.draft().pagamento.confirmacaoFundamentos).toBe(false);
  });

  /** Os fundamentos só fazem sentido para processo que cobra. */
  it('oferece os fundamentos que o catálogo devolve, com a descrição', () => {
    store.patchObjectSection('pagamento', { cobra: true });
    detectar();

    expect(componente.fundamentos()).toHaveLength(3);
    expect(host.textContent).toContain('Carência socioeconômica');
    expect(host.textContent).toContain('Renda até 1,5 salário mínimo');
  });

  it('grava a declaração ao concluir o passo', async () => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '150,50',
      fundamentos: ['CADASTRO_UNICO'],
      confirmacaoFundamentos: true,
    });

    const promessa = componente.persistir();
    await tick();

    const req = controller.expectOne(ROTA_TAXA);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      cobra: true,
      valor: 150.5,
      fundamentos: ['CADASTRO_UNICO'],
      confirmacaoFundamentos: true,
    });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect((await promessa).valid).toBe(true);
  });

  /** Processo gratuito não manda valor: o servidor recusa valor com cobra=false. */
  it('não envia valor quando o processo é gratuito', async () => {
    store.patchObjectSection('pagamento', { cobra: false });

    const promessa = componente.persistir();
    await tick();

    const req = controller.expectOne(ROTA_TAXA);
    expect(req.request.body.valor).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promessa;
  });

  it('exibe a recusa da API sem apagar o que foi preenchido', async () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '150,00' });

    const promessa = componente.persistir();
    await tick();

    const recusa = problema(
      422,
      'uniplus.selecao.configuracao_taxa_inscricao.valor_obrigatorio_quando_cobra',
      'Valor é obrigatório quando o processo cobra',
    );
    controller.expectOne(ROTA_TAXA).flush(recusa.body, recusa.opts);
    const resultado = await promessa;

    expect(resultado.valid).toBe(false);
    expect(componente.erroDeGravacao()).toBeTruthy();
    expect(store.draft().pagamento.valor).toBe('150,00');
  });

  it('recusa gravar antes de o processo existir', async () => {
    store.processoSeletivoId.set(null);
    store.patchObjectSection('pagamento', { cobra: false });

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('cadastro do processo precisa estar concluído');
  });

  /**
   * O servidor recusa fundamento com cobra=false — "não cobrar" e "isentar" são
   * decisões mutuamente exclusivas. Retomar um processo que cobrava e passar a
   * declarar gratuidade precisa limpar o que a nova declaração não admite.
   */
  it('descarta valor e fundamentos ao passar a declarar gratuidade', async () => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '230',
      fundamentos: [FundamentoIsencao.CadastroUnico],
      confirmacaoFundamentos: true,
    });
    await tick();

    componente.form.patchValue({ cobra: false });
    await tick();

    const pagamento = store.draft().pagamento;
    expect(pagamento.valor).toBe('');
    expect(pagamento.fundamentos).toEqual([]);
    expect(pagamento.confirmacaoFundamentos).toBe(false);

    const promessa = componente.persistir();
    await tick();
    const req = controller.expectOne(ROTA_TAXA);
    expect(req.request.body.fundamentos).toEqual([]);
    expect(req.request.body.valor).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promessa;
  });

  /**
   * O filtro de idempotência guarda a resposta de qualquer status abaixo de 500:
   * reenviar a declaração corrigida com a mesma chave devolveria `body_mismatch`
   * em vez de gravar, e o operador só sairia disso recarregando o editor.
   */
  it('renova a Idempotency-Key após 422 de validação', async () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '230' });

    const primeira = componente.persistir();
    await tick();
    const req1 = controller.expectOne(ROTA_TAXA);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const recusa = problema(
      422,
      'uniplus.selecao.configuracao_taxa_inscricao.valor_obrigatorio_quando_cobra',
      'Valor é obrigatório quando o processo cobra',
    );
    req1.flush(recusa.body, recusa.opts);
    await primeira;

    store.patchObjectSection('pagamento', { valor: '250' });
    const segunda = componente.persistir();
    await tick();
    const req2 = controller.expectOne(ROTA_TAXA);
    expect(req2.request.headers.get('Idempotency-Key')).not.toBe(chave1);
    req2.flush(null, { status: 204, statusText: 'No Content' });
    expect((await segunda).valid).toBe(true);
  });

  /**
   * `processing_conflict` é o único 409 em que o backend pede retry com a mesma
   * chave — a execução anterior ainda pode concluir.
   */
  it('preserva a Idempotency-Key em processing_conflict', async () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '230' });

    const primeira = componente.persistir();
    await tick();
    const req1 = controller.expectOne(ROTA_TAXA);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const conflito = problema(
      409,
      'uniplus.idempotency.processing_conflict',
      'Requisição concorrente em processamento',
    );
    req1.flush(conflito.body, conflito.opts);
    await primeira;

    const segunda = componente.persistir();
    await tick();
    const req2 = controller.expectOne(ROTA_TAXA);
    expect(req2.request.headers.get('Idempotency-Key')).toBe(chave1);
    req2.flush(null, { status: 204, statusText: 'No Content' });
    await segunda;
  });

  /**
   * Enquanto a gravação corre, alterar o valor faria o rascunho local divergir
   * do que o servidor gravou: o PUT já levou o valor antigo, e o sucesso
   * avançaria o passo com o novo em tela.
   */
  it('não aceita edição enquanto a gravação está em curso', async () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '150' });
    await tick();

    const promessa = componente.persistir();
    await tick();

    expect(componente.form.disabled).toBe(true);

    componente.alternarFundamento(FundamentoIsencao.CadastroUnico);
    expect(store.draft().pagamento.fundamentos).toEqual([]);

    controller.expectOne(ROTA_TAXA).flush(null, { status: 204, statusText: 'No Content' });
    await promessa;
    await tick();

    expect(componente.form.disabled).toBe(false);
  });

  /**
   * Erro de rede retém a chave — a execução anterior ainda pode ter chegado ao
   * servidor. Retida, ela vale para o corpo que a acompanhou: corrigir o valor
   * e regravar sob a mesma chave devolveria `body_mismatch`, e o operador não
   * teria como sair disso.
   */
  it('renova a chave quando a declaração muda depois de falha retentável', async () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '150' });

    const primeira = componente.persistir();
    await tick();
    const req1 = controller.expectOne(ROTA_TAXA);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    req1.error(new ProgressEvent('error'));
    await primeira;

    store.patchObjectSection('pagamento', { valor: '250' });
    const segunda = componente.persistir();
    await tick();
    const req2 = controller.expectOne(ROTA_TAXA);
    expect(req2.request.headers.get('Idempotency-Key')).not.toBe(chave1);
    req2.flush(null, { status: 204, statusText: 'No Content' });
    await segunda;
  });

  /** Repetir a mesma declaração é o que a chave retida existe para permitir. */
  it('mantém a chave ao repetir a mesma declaração após falha retentável', async () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '150' });

    const primeira = componente.persistir();
    await tick();
    const req1 = controller.expectOne(ROTA_TAXA);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    req1.error(new ProgressEvent('error'));
    await primeira;

    const segunda = componente.persistir();
    await tick();
    const req2 = controller.expectOne(ROTA_TAXA);
    expect(req2.request.headers.get('Idempotency-Key')).toBe(chave1);
    req2.flush(null, { status: 204, statusText: 'No Content' });
    await segunda;
  });

  /**
   * O stepper continua clicável durante o PUT. Sem o bloqueio, a troca de passo
   * move `currentStep`, e o `next()` que fecha a gravação avança a partir do
   * índice novo — marcando como concluído um passo que ninguém preencheu.
   */
  it('recusa troca de passo enquanto a gravação corre', async () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '150' });
    const passoInicial = store.currentStep();

    const promessa = componente.persistir();
    await tick();

    store.goTo(passoInicial + 3);
    expect(store.currentStep()).toBe(passoInicial);

    controller.expectOne(ROTA_TAXA).flush(null, { status: 204, statusText: 'No Content' });
    await promessa;

    store.goTo(passoInicial + 3);
    expect(store.currentStep()).toBe(passoInicial + 3);
  });

  /**
   * O editor sobrevive à troca de endereço. Se o operador vai para outro
   * processo durante o PUT, a resposta que chega descreve o processo anterior:
   * anunciá-la poria erro na tela nova, e destravar `salvando` liberaria um
   * editor que pode ter comando próprio em curso.
   */
  it('descarta a resposta quando o editor já passou a outro processo', async () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '150' });

    const promessa = componente.persistir();
    await tick();

    store.geracao.update((valor) => valor + 1);
    store.salvando.set(true);

    const recusa = problema(422, 'qualquer', 'Mensagem do processo anterior');
    controller.expectOne(ROTA_TAXA).flush(recusa.body, recusa.opts);
    const resultado = await promessa;

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toEqual([]);
    expect(componente.erroDeGravacao()).toBeNull();
    expect(store.salvando()).toBe(true);
  });

  /**
   * As caixas de fundamento são inputs nativos fora do formulário, então
   * `form.disable()` não as alcança: sem `disabled` próprio elas seguem
   * focáveis e clicáveis, e o clique só não faz nada — o operador tenta e a
   * tela não explica.
   */
  it('desabilita as caixas de fundamento fora de rascunho', async () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '230' });
    store.remoteSnapshot.set({ status: 'Publicado' } as never);
    detectar();
    await tick();
    detectar();

    const caixas = host.querySelectorAll<HTMLInputElement>(
      '.pagamento-fundamentos input[type="checkbox"]',
    );
    expect(caixas.length).toBeGreaterThan(0);
    for (const caixa of caixas) expect(caixa.disabled).toBe(true);
  });

  /**
   * Formas que `Number` converteria em outro número — `1e2` em 100, `0x10` em
   * 16 — ou em que separador de milhar e decimal se confundem. Nenhuma pode
   * virar valor em silêncio.
   */
  it.each([['1e2'], ['0x10'], ['1.00'], ['1,234'], ['R$ 230']])(
    'recusa %j como valor da taxa em vez de convertê-lo',
    (texto) => {
      store.patchObjectSection('pagamento', { cobra: true, valor: texto });

      const resultado = componente.validate();

      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.[0]).toContain('1.000,50');
    },
  );

  /**
   * `Number('1.000')` é 1: mil reais viravam um, passavam na validação e eram
   * gravados assim, com a tela seguindo a exibir o que o operador digitou.
   */
  it.each([
    ['1.000', 1000],
    ['1.000,50', 1000.5],
    ['1000,50', 1000.5],
    ['230', 230],
  ])('envia %j como %d', async (texto, esperado) => {
    store.patchObjectSection('pagamento', { cobra: true, valor: texto });

    const promessa = componente.persistir();
    await tick();

    const req = controller.expectOne(ROTA_TAXA);
    expect(req.request.body.valor).toBe(esperado);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promessa;
  });

  /** Texto que a validação recusa não pode virar comando. */
  it('não envia comando quando o valor não é um valor em reais', async () => {
    store.patchObjectSection('pagamento', { cobra: true, valor: '1e2x' });

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    controller.verify();
  });

  /** O clique grava; dizer "Próximo" descreveria só a navegação. */
  it('anuncia no botão que o avanço grava', () => {
    expect(componente.rotuloDeAvanco()).toBe('Gravar e avançar');
  });
});
