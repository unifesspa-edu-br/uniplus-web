import { conteudoInicial } from '@uniplus/shared-inscricao/formulario';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  INSCRICAO_COPIADA,
  PROBLEM_JSON,
  PROCESSO_COM_DERIVACOES,
  proximoPasso,
  relato,
  ROTA_APLICACAO,
  ROTA_PROCESSO,
  usarPasso,
  type ContextoDoPasso,
} from './formulario-passo.testing';
import { formularioDoRascunho } from './formulario-de-inscricao.testing';

describe('FormularioPassoComponent: modelo em respostas incertas', () => {
  let fixture: ContextoDoPasso['fixture'];
  let host: ContextoDoPasso['host'];
  let controller: ContextoDoPasso['controller'];
  let servicoDeModelos: ContextoDoPasso['servicoDeModelos'];
  let comModelosCarregados: ContextoDoPasso['comModelosCarregados'];
  let escolherEAplicar: ContextoDoPasso['escolherEAplicar'];

  usarPasso((contexto) => {
    ({ fixture, host, controller, servicoDeModelos, comModelosCarregados, escolherEAplicar } =
      contexto);
  });

  const pedirModelo = (codigo: string) =>
    servicoDeModelos().pedir(
      formularioDoRascunho(conteudoInicial(), { codigo, gravado: true }),
      codigo === 'INSCRICAO',
    );

  describe('partindo de um modelo', () => {
    beforeEach(() => comModelosCarregados());

    it('sem saber se a cópia aconteceu, o passo não grava o rascunho antigo por cima dela', async () => {
      const aplicacao = escolherEAplicar('INSCRICAO', 'insc');
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(
        {
          type: 'about:blank',
          title: 'Serviço indisponível.',
          status: 503,
          traceId: '00000000000000000000000000000006',
        },
        { status: 503, statusText: 'Service Unavailable', headers: PROBLEM_JSON },
      );
      await aplicacao;

      const validacao = fixture.componentInstance.validar();
      expect(validacao.valid).toBe(false);
      expect(validacao.messages?.join(' ')).toContain(
        'Não foi possível confirmar se o modelo “Inscrição de Medicina” foi aplicado ao formulário INSCRICAO',
      );
      fixture.detectChanges();
      const naAba = host.querySelector('#form-0-recusa-modelo')?.textContent ?? '';
      expect(naAba, 'a aba não desmente a trava').toContain(
        'Não foi possível confirmar se o modelo “Inscrição de Medicina” foi aplicado',
      );
      expect(naAba).not.toContain('não foi aplicado');
    });

    it('sem saber se a cópia aconteceu, só o mesmo modelo pode ser aplicado de novo', async () => {
      servicoDeModelos().modelos.set([
        { id: 'insc', nome: 'Inscrição de Medicina' },
        { id: 'outro', nome: 'Outra inscrição' },
        { id: 'hab', nome: 'Habilitação padrão' },
      ] as never);
      const aplicacao = escolherEAplicar('INSCRICAO', 'insc');
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(
        {
          type: 'about:blank',
          title: 'Serviço indisponível.',
          status: 503,
          traceId: '00000000000000000000000000000007',
        },
        { status: 503, statusText: 'Service Unavailable', headers: PROBLEM_JSON },
      );
      await aplicacao;

      servicoDeModelos().escolher('INSCRICAO', 'outro');
      pedirModelo('INSCRICAO');
      expect(
        servicoDeModelos().pendente(),
        'outro modelo trocaria a chave, e a primeira cópia ainda pode chegar',
      ).toBeNull();
      servicoDeModelos().escolher('HABILITACAO', 'hab');
      pedirModelo('HABILITACAO');
      expect(
        servicoDeModelos().pendente(),
        'nem em outra aba: as cópias mexem no que é do processo inteiro',
      ).toBeNull();

      servicoDeModelos().escolher('INSCRICAO', 'insc');
      pedirModelo('INSCRICAO');
      expect(servicoDeModelos().pendente()?.modelo.id).toBe('insc');

      // A nova tentativa recusada de vez não desfaz a cópia que a primeira pode ter feito.
      const nova = fixture.componentInstance.confirmarAplicacao();
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(
        {
          type: 'about:blank',
          title: 'O modelo não serve a este processo.',
          status: 422,
          code: 'uniplus.selecao.validacao',
          traceId: '00000000000000000000000000000009',
        },
        { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON },
      );
      await nova;
      fixture.detectChanges();
      const naAba = host.querySelector('#form-0-recusa-modelo')?.textContent ?? '';
      expect(naAba, 'o operador sabe o que corrigir').toContain(
        'A nova tentativa foi recusada: O modelo não serve a este processo.',
      );
      expect(naAba).toContain(
        'Não foi possível confirmar se o modelo “Inscrição de Medicina” foi aplicado',
      );
      // A cópia em aberto se resolve: a outra aba deixa de ser recusada por causa dela.
      servicoDeModelos().escolher('INSCRICAO', 'insc');
      pedirModelo('INSCRICAO');
      const resolvida = fixture.componentInstance.confirmarAplicacao();
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(relato('INSCRICAO'));
      await proximoPasso();
      controller
        .expectOne(ROTA_PROCESSO)
        .flush({ ...PROCESSO_COM_DERIVACOES, formularios: [INSCRICAO_COPIADA] });
      await resolvida;
      expect(
        servicoDeModelos().recusas().has('HABILITACAO'),
        'a recusa da habilitação era só o bloqueio',
      ).toBe(false);
    });

    it('com a cópia confirmada e a releitura falhando, a aba diz que o modelo foi aplicado e pede recarregar', async () => {
      const aplicacao = escolherEAplicar('INSCRICAO', 'insc');
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(relato('INSCRICAO'));
      await proximoPasso();
      controller.expectOne(ROTA_PROCESSO).flush(
        {
          type: 'about:blank',
          title: 'Serviço indisponível.',
          status: 503,
          traceId: '00000000000000000000000000000008',
        },
        { status: 503, statusText: 'Service Unavailable', headers: PROBLEM_JSON },
      );
      await aplicacao;
      fixture.detectChanges();

      const naAba = host.querySelector('#form-0-recusa-modelo')?.textContent ?? '';
      expect(naAba).toContain(
        'foi aplicado ao formulário INSCRICAO, mas não foi possível reler o processo. Recarregue o processo',
      );
      expect(naAba).not.toContain('Não foi possível confirmar');
      expect(fixture.componentInstance.validar().valid).toBe(false);
    });
  });
});
