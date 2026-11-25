import { HttpTestingController } from '@angular/common/http/testing';
import { FundamentoIsencao } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { PagamentoPassoComponent } from './pagamento.component';

import { ROTA_TAXA, montarPagamento, problema, tick } from './pagamento.testing';

describe('PagamentoPassoComponent', () => {
  let componente: PagamentoPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let host: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    ({ componente, store, controller, host, detectar } = await montarPagamento());
  });

  afterEach(() => controller.verify());

  it('grava a declaração ao concluir o passo', async () => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '150,50',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });

    const promessa = componente.persistir();
    await tick();

    const req = controller.expectOne(ROTA_TAXA);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      cobra: true,
      valor: 150.5,
      fundamentos: ['CADASTRO_UNICO'],
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
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '150,00',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });

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
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });
    await tick();

    componente.form.patchValue({ cobra: false });
    await tick();

    const pagamento = store.draft().pagamento;
    expect(pagamento.valor).toBe('');
    expect(pagamento.fundamentos).toEqual([]);

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
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '230',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });

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
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '230',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });

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
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '150',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });
    await tick();

    const promessa = componente.persistir();
    await tick();

    expect(componente.form.disabled).toBe(true);

    componente.alternarFundamento(FundamentoIsencao.DOACAO_MEDULA_OSSEA);
    expect(
      store.draft().pagamento.fundamentos,
      'a lista não muda com a gravação em curso — alternar é ignorado',
    ).toEqual(['CADASTRO_UNICO']);

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
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '150',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });

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
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '150',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });

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
   * move `passoAtual`, e o `next()` que fecha a gravação avança a partir do
   * índice novo — marcando como concluído um passo que ninguém preencheu.
   */
  it('recusa troca de passo enquanto a gravação corre', async () => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '150',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });
    const passoInicial = store.passoAtual();

    const promessa = componente.persistir();
    await tick();

    store.goTo(passoInicial + 3);
    expect(store.passoAtual()).toBe(passoInicial);

    controller.expectOne(ROTA_TAXA).flush(null, { status: 204, statusText: 'No Content' });
    await promessa;

    store.goTo(passoInicial + 3);
    expect(store.passoAtual()).toBe(passoInicial + 3);
  });

  /**
   * O editor sobrevive à troca de endereço. Se o operador vai para outro
   * processo durante o PUT, a resposta que chega descreve o processo anterior:
   * anunciá-la poria erro na tela nova, e destravar `salvando` liberaria um
   * editor que pode ter comando próprio em curso.
   */
  it('descarta a resposta quando o editor já passou a outro processo', async () => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '150',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });

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
   * `form.disable()` não as alcança: sem `disabled` próprio elas seguiriam
   * clicáveis durante a gravação, e o clique só não faria nada.
   */
  it('desabilita as caixas de fundamento enquanto a gravação está em curso', async () => {
    store.patchObjectSection('pagamento', {
      cobra: true,
      valor: '230',
      fundamentos: [FundamentoIsencao.CADASTRO_UNICO],
    });
    store.salvando.set(true);
    detectar();
    await tick();
    detectar();

    const caixas = Array.from(
      host.querySelectorAll<HTMLInputElement>('.pagamento-fundamentos input[type="checkbox"]'),
    );
    expect(caixas.length).toBeGreaterThan(0);
    expect(caixas.every((caixa) => caixa.disabled)).toBe(true);
  });

  /**
   * Em consulta o passo lê o que está gravado: a declaração, o valor e os fundamentos
   * aparecem como texto, sem rádio, campo nem caixa de seleção desabilitados.
   */
});
