import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CalendarioFormularioComponent } from './calendario-formulario.component';
import {
  ESCRITA_DO_CALENDARIO,
  PaginaNova,
  criado,
  montarNovo,
  problema,
} from './calendario-dias-uteis.testing';

describe('CalendarioDiasUteisNovoPage — escritas pela interface', () => {
  let p: PaginaNova;

  beforeEach(async () => {
    p = await montarNovo();
    p.escrever(p.versao(), '2026.1');
    const indice = await p.adicionarDia();
    await p.preencherDia(indice, 'NACIONAL', '2026-09-07');
  });
  afterEach(() => p.http.verify());

  const submeter = (): void => {
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const cancelar = (): HTMLButtonElement =>
    p.elemento('.cfg-calendario-form__footer button:not([type="submit"])');

  describe('gravação pendente', () => {
    it('deixa o formulário somente leitura, com foco no botão, e Cancelar indisponível', async () => {
      const post = await p.enviar();
      const botao = p.salvar();

      expect(p.versao().matches(':disabled')).toBe(true);
      expect(p.versao().value).toBe('2026.1');
      expect(p.dia(0, 'descricao').matches(':disabled')).toBe(true);
      expect(p.elemento('#cfg-calendario-adicionar-dia').matches(':disabled')).toBe(true);
      expect(p.elemento('.cfg-dia-card__remover').matches(':disabled')).toBe(true);
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      expect(botao.getAttribute('aria-busy')).toBe('true');
      expect(botao.textContent).toContain('Salvando...');
      expect(botao.querySelector('ui-spinner')).not.toBeNull();
      expect(document.activeElement).toBe(botao);
      expect(p.elemento('[role="status"]').textContent).toContain('Criando o calendário');
      expect(cancelar().matches(':disabled')).toBe(true);

      post.flush(...criado());
      await p.fixture.whenStable();
      expect(p.router.url).toBe('/calendario-dias-uteis');
    });

    it('clique e submissão repetidos não geram segundo envio', async () => {
      const post = await p.enviar();
      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      p.salvar().dispatchEvent(clique);
      submeter();
      await p.propagar();

      expect(clique.defaultPrevented).toBe(true);
      p.http.expectNone(ESCRITA_DO_CALENDARIO);
      post.flush(...criado());
      await p.fixture.whenStable();
    });

    it('a submissão repetida nem chega a pedir o salvamento ao formulário', async () => {
      const pedidos: string[] = [];
      p.fixture.debugElement
        .query(By.directive(CalendarioFormularioComponent))
        .componentInstance.salvar.subscribe(() => pedidos.push('salvar'));
      const post = await p.enviar();
      expect(pedidos).toEqual(['salvar']);

      submeter();
      await p.propagar();

      expect(pedidos).toEqual(['salvar']);
      post.flush(...criado());
      await p.fixture.whenStable();
    });

    it('chamadas concorrentes à edição não geram segunda requisição', async () => {
      p.edicao.salvar();
      p.edicao.salvar();

      p.http.expectOne(ESCRITA_DO_CALENDARIO).flush(...criado());
      await p.fixture.whenStable();
    });

    it('remover um dia durante a gravação não tira o dia do envio', async () => {
      const post = await p.enviar();

      p.edicao.removerDia(p.edicao.form.controls.diasNaoUteis.at(0));

      expect(p.edicao.form.controls.diasNaoUteis.length).toBe(1);
      post.flush(...criado());
      await p.fixture.whenStable();
    });

    it('Enter num campo leva o foco ao botão e, na falha 500, o envio segue disponível', async () => {
      p.versao().focus();
      submeter();
      await p.propagar();
      const post = p.http.expectOne(ESCRITA_DO_CALENDARIO);
      const chave = post.request.headers.get('Idempotency-Key');

      expect(p.versao().matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(p.salvar());
      post.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
      await p.propagar();

      expect(p.versao().matches(':disabled')).toBe(false);
      expect(p.elemento('ui-alert').textContent).toContain('Falha');
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(p.salvar());
      expect(p.salvar().getAttribute('aria-disabled')).toBeNull();
      submeter();
      await p.propagar();
      const repeticao = p.http.expectOne(ESCRITA_DO_CALENDARIO);
      expect(repeticao.request.headers.get('Idempotency-Key')).toBe(chave);
      repeticao.flush(...criado());
      await p.fixture.whenStable();
    });
  });

  describe('campo desabilitado por regra de negócio', () => {
    it.each(['sucesso', 'recusa'] as const)('continua desabilitado após %s', async (desfecho) => {
      const descricao = p.edicao.form.controls.diasNaoUteis.at(0).controls.descricao;
      descricao.disable();
      const post = await p.enviar();
      expect(descricao.disabled).toBe(true);

      if (desfecho === 'sucesso') post.flush(...criado());
      else
        post.flush(
          ...problema(422, {
            code: 'uniplus.configuracao.calendario_dias_uteis.descricao_obrigatoria',
          }),
        );
      await p.propagar();

      expect(descricao.disabled).toBe(true);
      expect(p.dia(0, 'descricao').matches(':disabled')).toBe(true);
      expect(p.versao().matches(':disabled')).toBe(false);
    });
  });

  describe('envio barrado localmente', () => {
    it('leva o foco ao primeiro campo inválido', async () => {
      p.escrever(p.versao(), '   ');
      p.escrever(p.dia(0, 'descricao') as HTMLTextAreaElement, '   ');
      p.salvar().focus();
      p.salvar().click();
      await p.propagar();
      await p.propagar();

      p.http.expectNone(ESCRITA_DO_CALENDARIO);
      expect(document.activeElement).toBe(p.versao());
    });

    it('depois de uma recusa, o envio barrado esconde a recusa antiga', async () => {
      const post = await p.enviar();
      post.flush(
        ...problema(422, {
          code: 'uniplus.configuracao.calendario_dias_uteis.descricao_obrigatoria',
          title: 'Dados inválidos',
        }),
      );
      await p.propagar();
      expect(p.elemento('ui-alert')).not.toBeNull();

      p.escrever(p.versao(), '   ');
      p.salvar().click();
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('ui-alert')).toBeNull();
    });
  });
});
