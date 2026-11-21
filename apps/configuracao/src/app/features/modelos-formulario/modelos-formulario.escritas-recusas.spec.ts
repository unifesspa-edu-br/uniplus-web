import { idempotencyKey } from '@uniplus/shared-core/idempotency';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PROBLEMA,
  PaginaDosModelos,
  URL,
  modelo,
  problema,
} from './modelos-formulario.escritas.testing';

describe('ModelosFormularioPage — recusas e troca de situação', () => {
  const pagina = new PaginaDosModelos();

  beforeEach(() => pagina.montar());
  afterEach(() => pagina.desmontar());

  it('Enter num campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async () => {
    await pagina.carregar();
    await pagina.preencher();
    pagina.nomeDoCampo().focus();
    pagina.enviar();
    const post = pagina.controller.expectOne(URL);
    await pagina.propagar();
    expect(document.activeElement).toBe(pagina.salvar());

    post.flush(problema(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: PROBLEMA,
    });
    await pagina.propagar();
    await pagina.propagar();

    expect(pagina.elemento('ui-alert[variant="danger"]').textContent).toContain('Erro interno');
    expect(pagina.nomeDoCampo().matches(':disabled')).toBe(false);
    expect(document.activeElement).toBe(pagina.salvar());
    pagina.enviar();
    pagina.controller.expectOne(URL);
  });

  it('o envio barrado localmente leva o foco ao primeiro campo inválido, sem requisição', async () => {
    await pagina.carregar();
    pagina.elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await pagina.propagar();
    pagina.salvar().focus();

    pagina.enviar();
    await pagina.propagar();
    await pagina.propagar();

    pagina.controller.expectNone(URL);
    expect(pagina.nomeDoCampo().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(pagina.nomeDoCampo());
  });

  it('só o código de duplicidade marca o campo do código e renova a chave', async () => {
    await pagina.carregar();
    await pagina.preencher();
    const criar = vi.spyOn(idempotencyKey, 'create');
    pagina.enviar();
    await pagina.propagar();

    pagina.controller
      .expectOne(URL)
      .flush(
        problema(
          409,
          'uniplus.configuracao.modelo_formulario.codigo_ja_existe',
          'Já existe um modelo com este código.',
        ),
        { status: 409, statusText: 'Conflict', headers: PROBLEMA },
      );
    await pagina.propagar();
    await pagina.propagar();

    const codigo = pagina.elemento<HTMLInputElement>('input[formcontrolname="codigo"]');
    expect(codigo.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(codigo);
    expect(codigo.closest('label')?.querySelector('.field__error')?.textContent).toContain(
      'Já existe um modelo com este código.',
    );
    expect(document.querySelector('ui-alert[variant="danger"]')).toBeNull();
    expect(criar).toHaveBeenCalledTimes(1);
  });

  it('o conflito de processamento mantém a chave e mostra a mensagem no alerta, sem marcar campo', async () => {
    await pagina.carregar();
    await pagina.preencher();
    const criar = vi.spyOn(idempotencyKey, 'create');
    pagina.enviar();
    await pagina.propagar();

    pagina.controller
      .expectOne(URL)
      .flush(
        problema(
          409,
          'uniplus.idempotency.processing_conflict',
          'A operação anterior ainda está em andamento.',
        ),
        { status: 409, statusText: 'Conflict', headers: PROBLEMA },
      );
    await pagina.propagar();

    expect(pagina.elemento('ui-alert[variant="danger"]').textContent).toContain(
      'A operação anterior ainda está em andamento.',
    );
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull();
    expect(criar).not.toHaveBeenCalled();
  });

  it('a recusa de campo renova a chave, e a recusa sem campo conhecido vai ao alerta', async () => {
    await pagina.carregar();
    await pagina.preencher();
    const criar = vi.spyOn(idempotencyKey, 'create');
    pagina.enviar();
    await pagina.propagar();
    pagina.recusar();
    await pagina.propagar();
    expect(criar).toHaveBeenCalledTimes(1);

    await pagina.editarNome('Inscrição revisada');
    pagina.enviar();
    await pagina.propagar();
    pagina.controller
      .expectOne(URL)
      .flush(
        problema(422, 'uniplus.validacao', 'Dados inválidos', [
          { field: 'Conteudo.Itens[0].Nome', code: 'x', message: 'Item recusado.' },
        ]),
        { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEMA },
      );
    await pagina.propagar();

    expect(pagina.elemento('ui-alert[variant="danger"]').textContent).toContain('Dados inválidos');
  });

  it('o campo desabilitado por regra de negócio segue assim depois do sucesso e da recusa', async () => {
    await pagina.carregar();
    await pagina.preencher();
    pagina.edicao.form.controls.tipoProcessoCodigo.disable();
    pagina.enviar();
    await pagina.propagar();
    pagina.recusar();
    await pagina.propagar();
    const tipo = (): HTMLSelectElement =>
      pagina.elemento('select[formcontrolname="tipoProcessoCodigo"]');
    expect(tipo().matches(':disabled')).toBe(true);
    expect(pagina.edicao.form.controls.tipoProcessoCodigo.disabled).toBe(true);

    await pagina.editarNome('Inscrição revisada');
    pagina.enviar();
    await pagina.propagar();
    pagina.controller.expectOne(URL).flush('novo-id', { status: 201, statusText: 'Created' });
    await pagina.propagar();

    expect(pagina.edicao.form.controls.tipoProcessoCodigo.disabled).toBe(true);
  });

  it('a troca de situação recusada anuncia a falha, libera a linha e devolve o foco ao botão', async () => {
    await pagina.carregar();
    const desativar = (): HTMLButtonElement =>
      pagina.elemento('[aria-label="Desativar o modelo INSCRICAO"]');
    desativar().focus();
    desativar().click();
    const requisicao = pagina.controller.expectOne(`${URL}/${modelo.id}`);
    await pagina.propagar();
    expect(desativar().disabled).toBe(true);
    (document.activeElement as HTMLElement).blur();

    requisicao.flush(problema(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: PROBLEMA,
    });
    await pagina.propagar();
    await pagina.propagar();

    expect(pagina.elemento('[role="status"]').textContent).toContain(
      'Não foi possível alterar a situação do modelo INSCRICAO.',
    );
    expect(pagina.elemento('tbody').textContent).not.toContain('Desativando...');
    expect(desativar().disabled).toBe(false);
    expect(document.activeElement).toBe(desativar());
  });

  it('a troca concluída devolve o foco ao botão da linha quando a lista recarregada a traz', async () => {
    await pagina.carregar();
    pagina.elemento<HTMLButtonElement>('[aria-label="Desativar o modelo INSCRICAO"]').click();
    pagina.controller
      .expectOne(`${URL}/${modelo.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await pagina.propagar();
    (document.activeElement as HTMLElement).blur();
    const recarga = pagina.controller.expectOne((r) => r.url === URL);
    await pagina.propagar();
    expect(document.activeElement).toBe(document.body);

    recarga.flush([{ ...modelo, ativo: false }]);
    await pagina.propagar();
    await pagina.propagar();

    expect(document.activeElement).toBe(
      pagina.elemento('[aria-label="Ativar o modelo INSCRICAO"]'),
    );
  });

  it('a troca concluída, com a linha ausente da recarga, leva o foco ao título da lista', async () => {
    await pagina.carregar();
    pagina.elemento<HTMLButtonElement>('[aria-label="Desativar o modelo INSCRICAO"]').click();
    pagina.controller
      .expectOne(`${URL}/${modelo.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await pagina.propagar();
    (document.activeElement as HTMLElement).blur();

    pagina.controller.expectOne((r) => r.url === URL).flush([]);
    await pagina.propagar();
    await pagina.propagar();

    expect(document.activeElement).toBe(pagina.elemento('#cfg-modelos-list-title'));
  });

  it('a troca concluída, com falha na recarga, leva o foco ao título da lista', async () => {
    await pagina.carregar();
    pagina.elemento<HTMLButtonElement>('[aria-label="Ativar o modelo INATIVO"]').click();
    pagina.controller
      .expectOne(`${URL}/modelo-2/ativacao`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await pagina.propagar();
    (document.activeElement as HTMLElement).blur();

    pagina.controller
      .expectOne((r) => r.url === URL)
      .flush(problema(500, 'uniplus.internal.unexpected', 'Erro interno'), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: PROBLEMA,
      });
    await pagina.propagar();
    await pagina.propagar();

    expect(document.activeElement).toBe(pagina.elemento('#cfg-modelos-list-title'));
  });

  it('não toma o foco de quem o levou a outro lugar durante a recarga', async () => {
    await pagina.carregar();
    pagina.elemento<HTMLButtonElement>('[aria-label="Desativar o modelo INSCRICAO"]').click();
    pagina.controller
      .expectOne(`${URL}/${modelo.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await pagina.propagar();
    const recarga = pagina.controller.expectOne((r) => r.url === URL);
    const outro = pagina.elemento<HTMLButtonElement>('.panel-head .btn--primary');
    outro.focus();

    recarga.flush([{ ...modelo, ativo: false }]);
    await pagina.propagar();
    await pagina.propagar();

    expect(document.activeElement).toBe(outro);
  });

  it('filtrar durante a carga cancela a leitura pendente, mantém o foco no filtro e mostra só a resposta nova', async () => {
    await pagina.carregar(false, [{ codigo: 'GRADUACAO', nome: 'Graduação' }]);
    const tipo = pagina.elemento<HTMLSelectElement>('.filter-bar select');
    tipo.focus();
    pagina.elemento<HTMLButtonElement>('ui-pager [data-pager="next"]').click();
    await pagina.propagar();
    const pendente = pagina.controller.expectOne((r) => r.url === URL && r.params.has('cursor'));

    tipo.value = 'GRADUACAO';
    tipo.dispatchEvent(new Event('change'));
    await pagina.propagar();

    expect(pendente.cancelled).toBe(true);
    const nova = pagina.controller.expectOne(
      (r) => r.url === URL && r.params.get('tipoProcesso') === 'GRADUACAO',
    );
    expect(nova.request.params.has('cursor')).toBe(false);
    expect(tipo.matches(':disabled')).toBe(false);
    expect(document.activeElement).toBe(tipo);

    nova.flush([{ ...modelo, id: 'modelo-3', codigo: 'GRADUADO' }]);
    await pagina.propagar();

    const tabela = pagina.elemento('table').textContent;
    expect(tabela).toContain('GRADUADO');
    expect(tabela).not.toContain('INATIVO');
  });
});
