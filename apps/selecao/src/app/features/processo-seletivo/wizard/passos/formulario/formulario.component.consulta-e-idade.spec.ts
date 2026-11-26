import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { PASSO_DESEMPATE } from '../desempate/desempate-por-idade';
import { usarPasso, type ContextoDoPasso } from './formulario-passo.testing';

describe('FormularioPassoComponent: consulta e avisos de idade', () => {
  let fixture: ContextoDoPasso['fixture'];
  let store: ContextoDoPasso['store'];
  let host: ContextoDoPasso['host'];
  let valor: ContextoDoPasso['valor'];
  let declararDesempate: ContextoDoPasso['declararDesempate'];

  usarPasso((contexto) => {
    ({ fixture, store, host, valor, declararDesempate } = contexto);
  });

  it('avisa do desempate por idoso sem apuração da idade e leva ao passo Desempate', () => {
    declararDesempate('DESEMPATE_IDOSO');
    store.patchObjectSection('formulario', {
      referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
    });
    fixture.detectChanges();

    expect(host.querySelector('#form-idoso-sem-apuracao')).not.toBeNull();
    // A data de nascimento é dos dados básicos, que a inscrição sempre coleta.
    expect(host.querySelector('#form-desempate-sem-nascimento')).toBeNull();
    (host.querySelector('#form-ir-desempate-apuracao') as HTMLButtonElement).click();
    expect(store.passoAtual()).toBe(PASSO_DESEMPATE);
  });

  describe('em consulta', () => {
    beforeEach(() => {
      store.remoteSnapshot.set({
        situacao: { codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO, rotulo: 'Publicado' },
      } as never);
      fixture.detectChanges();
    });

    it('não oferece partir de um modelo, e lê de que modelo o formulário partiu', () => {
      // Pelo sinal, porque a consulta não aceita edição: com o tipo conhecido, a listagem não sai.
      store.draft.update((draft) => ({
        ...draft,
        tipoProcesso: { ...draft.tipoProcesso, codigo: 'REGULAR_UNIFICADO' },
      }));
      store.projetarSecao('formulario', { modeloOrigemCodigo: 'INSC' });
      fixture.detectChanges();

      expect(host.querySelector('#form-inscricao-modelo-titulo')).toBeNull();
      expect(valor('Modelo de origem')).toEqual(['INSC']);
    });

    it('lê o formulário como texto, sem controle nem ação de edição', () => {
      // Com a inscrição só, não há aba: nada entre o que navegar.
      expect(
        host.querySelector('input, select, textarea, button, insc-editor-de-formulario'),
      ).toBeNull();
      expect(valor('Título do formulário')).toEqual(['Inscrição — Medicina 2027']);
      expect(valor('Fase da inscrição')).toEqual(['INSCRICAO']);
      expect(host.textContent).toContain('Condições especiais');
      expect(host.querySelector('.doc-list ui-valor-em-consulta')).toBeNull();
      const linhas = Array.from(host.querySelectorAll('.doc-item__head')).map((l) =>
        l.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(linhas).toEqual([
        'NOME · obrigatório',
        'PCD · obrigatório conforme respostas anteriores',
        'FAMILIA · repetível, obrigatório',
      ]);
    });

    it('lê a apuração da idade pelo rótulo da âncora e a data no formato brasileiro', () => {
      expect(valor('Apurar a idade em')).toEqual(['Uma data fixa']);
      expect(valor('Data de apuração')).toEqual(['15/01/2027']);
    });

    it('não mostra os avisos de idade: o processo publicado não admite a correção', () => {
      store.remoteSnapshot.set({
        situacao: { codigo: SituacaoDoProcessoSeletivoCodigo.RASCUNHO, rotulo: 'Rascunho' },
      } as never);
      declararDesempate('DESEMPATE_IDOSO');
      store.patchObjectSection('formulario', {
        referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
      });
      fixture.detectChanges();
      expect(host.querySelector('#form-idoso-sem-apuracao')).not.toBeNull();

      store.remoteSnapshot.set({
        situacao: { codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO, rotulo: 'Publicado' },
      } as never);
      fixture.detectChanges();

      expect(host.querySelector('#form-idoso-sem-apuracao')).toBeNull();
    });
  });
});
