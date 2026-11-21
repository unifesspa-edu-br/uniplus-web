import { describe, expect, it } from 'vitest';
import { OperadorCodigo } from '@uniplus/shared-data/configuracao';

import { conteudoDoFormulario } from './formulario-do-processo';
import { RemocaoDoFormulario } from './servicos/remocao-do-formulario.service';
import { CamposPressupostosDoFormulario } from './servicos/campos-pressupostos-do-formulario.service';
import {
  GRAVADO,
  HABILITACAO_GRAVADA,
  PROBLEM_JSON,
  PROCESSO,
  PROCESSO_ID,
  proximoPasso,
  ROTA_HABILITACAO,
  ROTA_PROCESSO,
  usarPasso,
  type ContextoDoPasso,
} from './formulario-passo.testing';

describe('FormularioPassoComponent: um formulário por finalidade', () => {
  let fixture: ContextoDoPasso['fixture'];
  let store: ContextoDoPasso['store'];
  let controller: ContextoDoPasso['controller'];
  let host: ContextoDoPasso['host'];
  let comHabilitacao: ContextoDoPasso['comHabilitacao'];

  usarPasso((contexto) => {
    ({ fixture, store, controller, host, comHabilitacao } = contexto);
  });

  describe('com um formulário por finalidade', () => {
    const abas = (): HTMLButtonElement[] =>
      Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const teclar = (aba: HTMLButtonElement, key: string): void => {
      aba.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };

    beforeEach(() => comHabilitacao());

    it('só a aba ativa entra no Tab, e setas, Home e End trocam de aba levando o foco', () => {
      const [inscricao, habilitacao] = abas();
      expect([inscricao.tabIndex, habilitacao.tabIndex]).toEqual([0, -1]);
      expect(
        host
          .querySelector(`#${inscricao.getAttribute('aria-controls')}`)
          ?.getAttribute('aria-labelledby'),
      ).toBe(inscricao.id);

      teclar(inscricao, 'ArrowRight');
      expect(abas().map((aba) => aba.getAttribute('aria-selected'))).toEqual(['false', 'true']);
      expect([inscricao.tabIndex, habilitacao.tabIndex]).toEqual([-1, 0]);
      expect(document.activeElement).toBe(habilitacao);
      expect((host.querySelector('#form-painel-habilitacao') as HTMLElement).hidden).toBe(false);

      teclar(habilitacao, 'Home');
      expect(document.activeElement).toBe(inscricao);
      teclar(inscricao, 'End');
      expect(document.activeElement).toBe(habilitacao);
    });

    it('a inscrição não oferece remoção; as outras finalidades, sim', () => {
      expect(host.querySelector('#form-inscricao-remover')).toBeNull();
      expect(host.querySelector('#form-habilitacao-remover')).not.toBeNull();
    });

    it('os fatos da inscrição são citáveis na habilitação, e o fato que ela cita não sai da inscrição', () => {
      const habilitacao = fixture.componentInstance
        .abas()
        .find((aba) => aba.finalidade === 'HABILITACAO');
      expect(habilitacao?.fatosDaInscricao).toContain('PCD');

      const conteudo = conteudoDoFormulario(HABILITACAO_GRAVADA);
      store.patchObjectSection('formulario', {
        outrasFinalidades: [
          {
            finalidade: 'HABILITACAO',
            faseCodigo: '',
            conteudo: {
              ...conteudo,
              termos: [
                {
                  codigo: 'T',
                  ordem: 0,
                  termo: { termoId: 't', versaoId: 'v' },
                  regras: {
                    exibicao: [[{ fato: 'PCD', operador: OperadorCodigo.IGUAL, valor: 'true' }]],
                    obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
                  },
                },
              ],
            },
          },
        ],
      });

      expect(
        fixture.debugElement.injector
          .get(CamposPressupostosDoFormulario)
          .remocoesTravadas()
          .get('PCD'),
      ).toMatch(/o formulário de habilitação depende deste dado/);
    });

    it('a recusa da remoção aparece em texto na aba, que continua, e a remoção trava o passo enquanto está no ar', async () => {
      fixture.debugElement.injector.get(RemocaoDoFormulario).pedir('HABILITACAO');
      const remocao = fixture.componentInstance.confirmarRemocao();
      controller
        .expectOne(ROTA_PROCESSO)
        .flush({ ...PROCESSO, formularios: [GRAVADO, HABILITACAO_GRAVADA] });
      await proximoPasso();
      expect(
        store.operacaoEmAndamento(),
        'um PUT da aba depois do DELETE recriaria o formulário',
      ).toBe(true);
      controller
        .expectOne((r) => r.method === 'DELETE' && r.url === ROTA_HABILITACAO)
        .flush(
          {
            type: 'about:blank',
            title: 'A remoção foi recusada.',
            status: 422,
            code: 'uniplus.selecao.formulario.remocao_so_em_rascunho',
            traceId: '00000000000000000000000000000004',
          },
          { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON },
        );
      await remocao;
      fixture.detectChanges();

      expect(host.querySelector('#form-habilitacao-recusa-remocao')?.textContent).toContain(
        'A remoção foi recusada.',
      );
      expect(abas()[1].textContent).toContain('(recusado)');
      expect(store.draft().formulario.outrasFinalidades.map((outra) => outra.finalidade)).toEqual([
        'HABILITACAO',
      ]);
      expect(store.operacaoEmAndamento()).toBe(false);
    });

    it('removido o penúltimo formulário, sem abas, o foco vai ao título do painel que sobra', async () => {
      fixture.debugElement.injector.get(RemocaoDoFormulario).pedir('HABILITACAO');
      const remocao = fixture.componentInstance.confirmarRemocao();
      controller
        .expectOne(ROTA_PROCESSO)
        .flush({ ...PROCESSO, id: PROCESSO_ID, formularios: [GRAVADO, HABILITACAO_GRAVADA] });
      await proximoPasso();
      controller
        .expectOne((r) => r.method === 'DELETE' && r.url === ROTA_HABILITACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await remocao;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(abas()).toEqual([]);
      expect(document.activeElement?.id).toBe('form-inscricao-fase-titulo');
      expect(host.textContent, 'o servidor já está como o rascunho').not.toContain(
        'Há alteração nos formulários ainda não gravada',
      );
    });

    it('acrescentar uma finalidade abre a aba dela, leva o foco até ela e anuncia', async () => {
      store.patchObjectSection('formulario', { outrasFinalidades: [] });
      fixture.detectChanges();

      fixture.componentInstance.finalidadeAAcrescentar.set('HABILITACAO');
      fixture.componentInstance.acrescentarFinalidade();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.abaAtiva()).toBe('HABILITACAO');
      expect(document.activeElement?.id).toBe('form-aba-habilitacao');
      expect(host.querySelector('#form-anuncio')?.textContent).toContain(
        'Formulário de habilitação acrescentado',
      );
    });
  });
});
