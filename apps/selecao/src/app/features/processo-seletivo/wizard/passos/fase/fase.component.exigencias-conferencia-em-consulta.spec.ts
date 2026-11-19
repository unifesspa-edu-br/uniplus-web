import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { StatusProcesso, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { CatalogoDeDocumentos } from '../cronograma/catalogos/catalogo-de-documentos.service';
import { DocumentosDaFaseComponent } from './documentos/documentos-da-fase.component';
import { ExigenciasDaFaseStore } from './documentos/exigencias-da-fase.store';
import { FasePassoComponent } from './fase.component';
import { fase, ID_AVALIACAO, ID_CPF, ID_RECURSOS, TIPOS_DOCUMENTO } from './fase.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';

describe('FasePassoComponent', () => {
  let componente: ContextoDaFase['componente'];
  let store: ContextoDaFase['store'];
  let controller: ContextoDaFase['controller'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let exigencias: ContextoDaFase['exigencias'];
  let documentos: ContextoDaFase['documentos'];
  let linhas: ContextoDaFase['linhas'];
  let botaoDeEdicao: ContextoDaFase['botaoDeEdicao'];
  let campoDeEntrega: ContextoDaFase['campoDeEntrega'];

  usarFase((tela) => {
    ({
      componente,
      store,
      controller,
      detectar,
      nativo,
      comCronograma,
      exigencias,
      documentos,
      linhas,
      botaoDeEdicao,
      campoDeEntrega,
    } = tela);
  });

  describe('exigências documentais da fase', () => {
    describe('conferência dos documentos da fase', () => {
      beforeEach(() => comCronograma(fase({})));

      /** O filtro e o aviso são da fase aberta: a outra fase abre com todos os documentos. */
      it('volta o filtro a todos e apaga o aviso ao trocar de fase', () => {
        comCronograma(
          fase({}),
          fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 2 }),
        );
        exigencias().alternarExigencia(ID_CPF, true);
        documentos().filtroDoPublico.set('condicao:Cor ou raça é INDIGENA');
        documentos().saiuDaLista.set('CPF saiu da lista, porque não é mais do público filtrado.');
        detectar();

        componente.abrirFase(ID_RECURSOS);
        exigencias().alternarExigencia(ID_CPF, true);
        detectar();

        expect(documentos().filtroDoPublico()).toBe('');
        expect(nativo.querySelector<HTMLSelectElement>('#fase-RECURSOS-doc-filtro')?.value).toBe(
          '',
        );
        expect(nativo.querySelector('#fase-RECURSOS-doc-filtro-total')?.textContent?.trim()).toBe(
          '1 de 1 documentos.',
        );
      });

      /** A mesma exigência em outra fase é outra exigência: abrir numa não abre na outra. */
      it('abre os campos só na fase em que o documento foi aberto', () => {
        comCronograma(
          fase({}),
          fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 2 }),
        );
        documentos().escolherDocumento(ID_CPF);
        documentos().acrescentarDocumento();
        detectar();
        expect(documentos().emEdicao(ID_CPF)).toBe(true);

        componente.abrirFase(ID_RECURSOS);
        exigencias().alternarExigencia(ID_CPF, true);
        detectar();
        expect(documentos().emEdicao(ID_CPF)).toBe(false);
        expect(campoDeEntrega()).toBeNull();

        componente.abrirFase(ID_AVALIACAO);
        detectar();
        expect(documentos().emEdicao(ID_CPF)).toBe(true);
      });

      /**
       * O Cronograma embute um passo destes por fase aberta: cada rótulo, descrição e
       * `aria-controls` aponta para o elemento da própria fase, e nenhum id se repete.
       */
      it('dá à conferência de cada fase embutida ids próprios', () => {
        comCronograma(
          fase({}),
          fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 2 }),
        );
        const segunda = TestBed.createComponent(FasePassoComponent);
        segunda.componentRef.setInput('faseFixada', ID_RECURSOS);
        segunda.detectChanges();
        for (const requisicao of controller.match(() => true)) requisicao.flush([]);

        exigencias().alternarExigencia(ID_CPF, true);
        documentos().alternarEdicao(ID_CPF, true);
        segunda.debugElement.injector.get(ExigenciasDaFaseStore).alternarExigencia(ID_CPF, true);
        segunda.debugElement
          .query(By.directive(DocumentosDaFaseComponent))
          .componentInstance.alternarEdicao(ID_CPF, true);
        detectar();
        segunda.detectChanges();

        const referencias = (raiz: HTMLElement) => {
          const filtro = raiz.querySelector('.doc-conferencia__filtro select');
          const rotulo = raiz.querySelector('.doc-conferencia__filtro label');
          const alternar = raiz.querySelector('.doc-conferencia__alternar');
          const alvos = [
            rotulo?.getAttribute('for'),
            filtro?.getAttribute('aria-describedby'),
            alternar?.getAttribute('aria-controls'),
          ];
          for (const alvo of alvos) {
            expect(alvo, 'a referência aponta para dentro da própria fase').toBeTruthy();
            expect(raiz.querySelector(`[id="${alvo}"]`)).not.toBeNull();
          }
          // Só os ids do bloco da conferência: os dos campos do documento ficam fora desta verificação.
          return Array.from(
            raiz.querySelectorAll('.doc-conferencia__filtro [id], .doc-conferencia__campos[id]'),
          ).map((elemento) => elemento.id);
        };

        const daPrimeira = referencias(nativo);
        const daSegunda = referencias(segunda.nativeElement as HTMLElement);
        expect(daPrimeira).toHaveLength(3);
        expect(daPrimeira.filter((id) => daSegunda.includes(id))).toEqual([]);
        segunda.destroy();
      });

      /**
       * Processo publicado só se consulta: o resumo mostra as regras e o detalhe fica à vista como
       * texto, sem botão que abra campo nenhum.
       */
      it('em consulta, lê o detalhe do documento como texto, sem campo nem botão', () => {
        exigencias().alternarExigencia(ID_CPF, true);
        store.remoteSnapshot.set({
          status: StatusProcesso.publicado,
        } as unknown as ProcessoSeletivoDto);
        detectar();

        expect(linhas()).toHaveLength(1);
        expect(botaoDeEdicao()).toBeNull();
        expect(campoDeEntrega()).toBeNull();
        const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
        expect(leitura).toContain('Sobre o documento');
        expect(leitura).toContain('Exigido em');
        expect(leitura).toContain('Sem modelo');
        expect(leitura).not.toContain('O cadastro aceita');
        expect(nativo.querySelector('tbody select, tbody input, tbody button')).toBeNull();
      });

      /** O aviso compara com o cadastro vigente: serve a quem edita, e não ao que se publicou. */
      it('em consulta, não mistura o aviso do cadastro vigente com os formatos publicados', () => {
        TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set([
          { ...TIPOS_DOCUMENTO[0], formatosAceitos: 'pdf,tiff' },
        ]);
        exigencias().alternarExigencia(ID_CPF, true);
        store.remoteSnapshot.set({
          status: StatusProcesso.publicado,
        } as unknown as ProcessoSeletivoDto);
        detectar();

        const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
        expect(leitura).not.toContain('O cadastro aceita');
      });

      /**
       * Sem descrição, a edição se orienta pelos formatos do cadastro; a consulta diz que não há
       * descrição e lê os formatos e o limite como dado próprio, sem perdê-los.
       */
      it('em consulta, lê os formatos e o limite do cadastro à parte da descrição ausente', () => {
        exigencias().alternarExigencia(ID_CPF, true);
        store.remoteSnapshot.set({
          status: StatusProcesso.publicado,
        } as unknown as ProcessoSeletivoDto);
        detectar();

        const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
        expect(leitura).toContain('Sem descrição');
        expect(leitura, 'sem descrição, não há de onde ela venha').not.toContain(
          'Descrição do cadastro vigente',
        );
        expect(leitura).toContain('Arquivo aceito pela exigência publicada');
        expect(leitura).toContain('PDF, JPEG, até 10,0 MB');
      });

      /**
       * O cadastro mudou depois da publicação: a consulta lê o que a exigência gravou, e a
       * descrição, que o snapshot não guarda, diz de onde vem.
       */
      it('em consulta, lê os formatos e o limite gravados quando o cadastro diverge', () => {
        exigencias().alternarExigencia(ID_CPF, true);
        TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set([
          {
            ...TIPOS_DOCUMENTO[0],
            descricao: 'Documento oficial com foto',
            formatosAceitos: 'pdf',
            tamanhoMaximoMb: 5,
          },
        ]);
        store.remoteSnapshot.set({
          status: StatusProcesso.publicado,
        } as unknown as ProcessoSeletivoDto);
        detectar();

        const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
        expect(leitura).toContain('PDF, JPEG, até 10,0 MB');
        expect(leitura).not.toContain('5,0 MB');
        expect(leitura).toContain('Documento oficial com foto');
        expect(leitura).toContain('Descrição do cadastro vigente: o processo não a guarda.');
      });

      it('em consulta, lê os formatos gravados do documento cujo tipo saiu do cadastro', () => {
        exigencias().alternarExigencia(ID_CPF, true);
        TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set([]);
        store.remoteSnapshot.set({
          status: StatusProcesso.publicado,
        } as unknown as ProcessoSeletivoDto);
        detectar();

        const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
        expect(leitura).toContain('PDF, JPEG, até 10,0 MB');
      });

      /**
       * O tipo removido depois da publicação continua valendo: a consulta diz isso fora da
       * descrição e sem a orientação de remover, que só a edição tem como cumprir.
       */
      it('em consulta, não manda remover o documento cujo tipo saiu do cadastro', () => {
        comCronograma(fase({}));
        documentos().escolherDocumento(ID_CPF);
        documentos().acrescentarDocumento();
        TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set([]);
        detectar();
        expect(documentos().resumos()[0].orientacao).toContain('Remova-o');

        store.remoteSnapshot.set({
          status: StatusProcesso.publicado,
        } as unknown as ProcessoSeletivoDto);
        detectar();

        const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
        expect(leitura).toContain('saiu do cadastro');
        expect(leitura).toContain('Sem descrição');
        expect(leitura).not.toMatch(/remova-o/i);
      });

      /** A gravação suspende a edição por um instante, e os campos abertos não somem com ela. */
      it('mantém os campos abertos enquanto a gravação está em curso', () => {
        documentos().escolherDocumento(ID_CPF);
        documentos().acrescentarDocumento();
        store.salvando.set(true);
        detectar();

        expect(campoDeEntrega()).not.toBeNull();
        expect(botaoDeEdicao()?.getAttribute('aria-expanded')).toBe('true');
      });
    });
  });
});
