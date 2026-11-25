import { conteudoInicial } from '@uniplus/shared-inscricao/formulario';
import { describe, expect, it } from 'vitest';

import { FasesDosFormularios } from './servicos/fases-dos-formularios.service';
import { conteudoDoFormulario } from './formulario-do-processo';
import {
  GRAVADO,
  HABILITACAO_GRAVADA,
  usarPasso,
  type ContextoDoPasso,
} from './formulario-passo.testing';

describe('FormularioPassoComponent: escolha da fase e simulação', () => {
  let fixture: ContextoDoPasso['fixture'];
  let store: ContextoDoPasso['store'];
  let host: ContextoDoPasso['host'];
  let comProcessoLido: ContextoDoPasso['comProcessoLido'];

  usarPasso((contexto) => {
    ({ fixture, store, host, comProcessoLido } = contexto);
  });

  it('a simulação usa o processo gravado e avisa a alteração ainda não gravada', () => {
    comProcessoLido();
    fixture.detectChanges();
    expect(host.textContent).not.toContain('Há alteração nos formulários ainda não gravada');

    store.patchObjectSection('formulario', {
      conteudo: { ...conteudoDoFormulario(GRAVADO), titulo: 'Outro título' },
    });
    fixture.detectChanges();

    expect(host.textContent).toContain('Há alteração nos formulários ainda não gravada');
  });

  it('cada formulário gravado tem o link que abre a simulação dele em nova aba', () => {
    comProcessoLido([GRAVADO, HABILITACAO_GRAVADA]);

    const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('.form-simulacao__links a'));
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toMatch(/\/processo-seletivo\/.+\/simulacao\/INSCRICAO$/);
    expect(links[1].getAttribute('href')).toMatch(
      /\/processo-seletivo\/.+\/simulacao\/HABILITACAO$/,
    );
    expect(links.every((link) => link.target === '_blank')).toBe(true);
  });

  it('com uma só fase que coleta inscrição, a escolhe sozinho', () => {
    expect(store.draft().formulario.faseCodigo).toBe('');
    expect(fixture.debugElement.injector.get(FasesDosFormularios).faseDaInscricao()).toBe(
      'INSCRICAO',
    );
    expect(fixture.componentInstance.validar()).toEqual({ valid: true });
  });

  it('antes de o formulário existir no servidor, o combo não oferece o conjunto básico, que a API põe na seção reservada', () => {
    expect(
      fixture.componentInstance.abas()[0].fatosIndisponiveis,
      'com a seção dos dados básicos, ela é a referência',
    ).not.toContain('SEXO');

    store.patchObjectSection('formulario', { conteudo: conteudoInicial() });

    expect(fixture.componentInstance.abas()[0].fatosIndisponiveis).toContain('SEXO');
  });

  it('o formulário de isenção que já existe barra o passo quando o processo deixa de cobrar taxa', () => {
    store.patchObjectSection('formulario', {
      outrasFinalidades: [
        { finalidade: 'ISENCAO_TAXA', faseCodigo: 'INSCRICAO', conteudo: conteudoInicial() },
      ],
    });
    store.patchObjectSection('pagamento', { cobra: false });

    const validacao = fixture.componentInstance.validar();

    expect(validacao.valid).toBe(false);
    expect(validacao.messages?.join(' ')).toContain(
      'O processo não cobra taxa de inscrição, e o formulário de isenção',
    );
  });
});
