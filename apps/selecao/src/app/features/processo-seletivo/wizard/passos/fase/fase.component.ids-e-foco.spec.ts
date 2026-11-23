import { runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { CatalogoDeDocumentos } from '../cronograma/catalogos/catalogo-de-documentos.service';
import { DocumentosDaFaseComponent } from './documentos/documentos-da-fase.component';
import { EditorDaExigenciaComponent } from './documentos/editor-da-exigencia.component';
import { FasePassoComponent } from './fase.component';
import { PublicacoesDaFaseComponent } from './secoes/publicacoes-da-fase.component';
import { fase, ID_AVALIACAO, ID_CPF, ID_HOMOLOGACAO, TIPOS_DOCUMENTO } from './fase.testing';
import { usarFase, type ContextoDaFase, umaNorma } from './fase-passo.testing';

describe('FasePassoComponent', () => {
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let atenderCatalogos: ContextoDaFase['atenderCatalogos'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let exigencias: ContextoDaFase['exigencias'];
  let documentos: ContextoDaFase['documentos'];

  usarFase((tela) => {
    ({ detectar, nativo, atenderCatalogos, comCronograma, exigencias, documentos } = tela);
  });

  describe('ids únicos por instância', () => {
    /** Um passo por fase, como o Cronograma os embute. */
    function duasFases() {
      comCronograma(
        fase({}),
        fase({ faseCanonicaId: ID_HOMOLOGACAO, codigo: 'HOMOLOGACAO_INSCRICOES', ordem: 2 }),
      );
      const criar = (faseCanonicaId: string) => {
        const fixture = TestBed.createComponent(FasePassoComponent);
        fixture.componentRef.setInput('faseFixada', faseCanonicaId);
        fixture.detectChanges();
        atenderCatalogos();
        fixture.detectChanges();
        return fixture;
      };
      const avaliacao = criar(ID_AVALIACAO);
      const recursos = criar(ID_HOMOLOGACAO);
      for (const fixture of [avaliacao, recursos]) {
        (
          fixture.debugElement.query(By.directive(PublicacoesDaFaseComponent))
            .componentInstance as PublicacoesDaFaseComponent
        ).acrescentarProduto();
        fixture.debugElement
          .query(By.directive(DocumentosDaFaseComponent))
          .componentInstance.escolherDocumento(ID_CPF);
        fixture.debugElement
          .query(By.directive(DocumentosDaFaseComponent))
          .componentInstance.acrescentarDocumento();
        fixture.debugElement
          .query(By.directive(DocumentosDaFaseComponent))
          .componentInstance.alternarEdicao(ID_CPF, true);
        runInInjectionContext(
          fixture.debugElement.injector,
          () => new EditorDaExigenciaComponent(),
        ).definirBasesLegais(ID_CPF, [umaNorma({ referencia: 'Lei 1/2000' })]);
        fixture.detectChanges();
      }
      return [avaliacao, recursos].map((fixture) => fixture.nativeElement as HTMLElement);
    }

    it('não repete id com duas fases abertas', () => {
      const fases = duasFases();

      const ids = fases.flatMap((faseNaTela) =>
        Array.from(faseNaTela.querySelectorAll('[id]'), (elemento) => elemento.id),
      );
      expect(ids.length).toBeGreaterThan(20);
      expect(ids.filter((id, posicao) => ids.indexOf(id) !== posicao)).toEqual([]);
    });

    it('aponta for, aria-describedby e aria-controls para elementos da própria fase', () => {
      const fases = duasFases();

      for (const faseNaTela of fases) {
        const referencias = Array.from(
          faseNaTela.querySelectorAll('[for], [aria-describedby], [aria-controls]'),
        ).flatMap((elemento) =>
          ['for', 'aria-describedby', 'aria-controls'].flatMap(
            (atributo) => elemento.getAttribute(atributo)?.split(/\s+/) ?? [],
          ),
        );
        expect(referencias.length).toBeGreaterThan(10);
        const orfas = referencias.filter(
          (id) => id !== '' && faseNaTela.querySelector(`[id="${id}"]`) === null,
        );
        // O combobox do catálogo gera seus próprios identificadores.
        expect(orfas.filter((id) => id.startsWith('fase-'))).toEqual([]);
      }
    });
  });

  describe('foco ao remover documento', () => {
    const ID_RG = '01960000-0000-7000-0000-0000000000f2';

    beforeEach(() => {
      TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set([
        ...TIPOS_DOCUMENTO,
        { ...TIPOS_DOCUMENTO[0], id: ID_RG, codigo: 'RG', nome: 'RG' },
      ]);
      comCronograma(fase({}));
      for (const id of [ID_CPF, ID_RG]) {
        documentos().escolherDocumento(id);
        documentos().acrescentarDocumento();
      }
      documentos().alternarEdicao(ID_CPF, true);
      detectar();
    });

    const remover = () => {
      const botao = nativo.querySelector<HTMLButtonElement>('.doc-item__row button');
      botao?.focus();
      botao?.click();
      detectar();
      const confirmar = Array.from(
        nativo.querySelectorAll<HTMLButtonElement>('dialog button'),
      ).find((item) => item.textContent?.trim() === 'Remover');
      confirmar?.click();
      detectar();
    };

    it('leva o foco ao seletor do público enquanto restar documento', () => {
      remover();

      expect(exigencias().documentosDaFase()).toHaveLength(1);
      expect(document.activeElement).toBe(nativo.querySelector('#fase-AVALIACAO-doc-filtro'));
    });

    it('leva o foco ao campo "Documento a exigir" ao remover o último', () => {
      exigencias().alternarExigencia(ID_RG, false);
      detectar();

      remover();

      expect(exigencias().documentosDaFase()).toEqual([]);
      expect(document.activeElement).toBe(nativo.querySelector('ui-combobox input'));
    });

    it('anuncia a remoção numa região de status', () => {
      remover();

      const aviso = nativo.querySelector('p.sr-only[role="status"]');
      expect(aviso?.textContent).toContain('removido dos documentos exigidos nesta fase');
    });

    it('anuncia de novo quando o mesmo documento é removido pela segunda vez', () => {
      const aviso = () => nativo.querySelector('p.sr-only[role="status"]')?.textContent?.trim();
      remover();
      expect(aviso()).toBe('CPF removido dos documentos exigidos nesta fase.');

      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();
      expect(aviso(), 'com o CPF de volta, o aviso antigo não vale mais').toBe('');

      remover();
      expect(aviso()).toBe('CPF removido dos documentos exigidos nesta fase.');
    });
  });
});
