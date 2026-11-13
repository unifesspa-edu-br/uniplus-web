import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { CatalogoDeDocumentos } from '../cronograma/catalogos/catalogo-de-documentos.service';
import { fase, ID_CPF, TIPOS_DOCUMENTO } from './fase.testing';
import { ModeloDaExigenciaComponent } from './modelo-da-exigencia/modelo-da-exigencia.component';
import { usarFase, type ContextoDaFase, ID_RG } from './fase-passo.testing';

describe('FasePassoComponent', () => {
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let raiz: ContextoDaFase['raiz'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let exigencias: ContextoDaFase['exigencias'];
  let gatilho: ContextoDaFase['gatilho'];
  let editor: ContextoDaFase['editor'];
  let documentos: ContextoDaFase['documentos'];
  let linhas: ContextoDaFase['linhas'];
  let celula: ContextoDaFase['celula'];
  let botaoDeEdicao: ContextoDaFase['botaoDeEdicao'];
  let campoDeEntrega: ContextoDaFase['campoDeEntrega'];

  usarFase((tela) => {
    ({
      detectar,
      nativo,
      raiz,
      comCronograma,
      exigencias,
      gatilho,
      editor,
      documentos,
      linhas,
      celula,
      botaoDeEdicao,
      campoDeEntrega,
    } = tela);
  });

  describe('exigências documentais da fase', () => {
    /**
     * O aviso de norma diz o que a publicação vai recusar, com a mesma regra que ela aplica:
     * a exigência que decide o resultado precisa de ao menos uma norma declarada e resolvida.
     * Olhar só a referência de cada norma calava diante da norma pendente e acusava a
     * exigência que outra norma já sustentava.
     */
    describe('aviso de norma que a publicação recusa', () => {
      const AVISO = 'Sem uma norma declarada e identificada como "Resolvida"';
      const avisos = () =>
        Array.from(nativo.querySelectorAll('.doc-item__aviso-norma')).filter((aviso) =>
          aviso.textContent?.includes(AVISO),
        ).length;

      beforeEach(() => {
        comCronograma(fase({}));
        documentos().escolherDocumento(ID_CPF);
        documentos().acrescentarDocumento();
        detectar();
      });

      it('avisa enquanto nenhuma norma está declarada, e uma vez só', () => {
        editor().acrescentarBaseLegal(ID_CPF);
        detectar();

        expect(avisos()).toBe(1);
      });

      it('some com a norma declarada e resolvida', () => {
        editor().escreverBaseLegal(ID_CPF, 0, 'referencia', 'Lei 12.711/2012, art. 3º');
        detectar();

        expect(avisos()).toBe(0);
      });

      it('continua com a norma declarada mas pendente', () => {
        editor().escreverBaseLegal(ID_CPF, 0, 'referencia', 'Lei 12.711/2012, art. 3º');
        editor().escreverBaseLegal(ID_CPF, 0, 'status', 'PENDENTE');
        detectar();

        expect(avisos()).toBe(1);
      });

      it('some quando outra norma da exigência já está resolvida', () => {
        editor().escreverBaseLegal(ID_CPF, 0, 'referencia', 'Lei 12.711/2012, art. 3º');
        editor().acrescentarBaseLegal(ID_CPF);
        detectar();

        expect(avisos()).toBe(0);
      });

      it('não avisa a exigência que não decide o resultado', () => {
        editor().escolherObrigatoriedade(ID_CPF, 'nao');
        detectar();

        expect(avisos()).toBe(0);
      });
    });

    /**
     * A conferência lê a fase pelo resumo: cada documento numa linha com o que decide a
     * exigência, e os campos só abrem por documento. Com dezenas de documentos abertos de uma
     * vez, a fase passa de quinze mil pixels e não se confere.
     */
    describe('conferência dos documentos da fase', () => {
      beforeEach(() => comCronograma(fase({})));

      it('mostra no resumo o que decide a exigência, com os campos fechados', () => {
        exigencias().alternarExigencia(ID_CPF, true);
        editor().escolherConsequencia(ID_CPF, 'ELIMINA');
        editor().escreverBaseLegal(ID_CPF, 0, 'referencia', 'Lei 12.711/2012, art. 3º');
        detectar();

        const [linha] = linhas();
        expect(linha.querySelector('th[scope="row"]')?.textContent?.trim()).toBe('CPF');
        expect(celula(linha, 'A quem se aplica')).toBe('Todo candidato');
        expect(celula(linha, 'Entrega')).toBe('Obrigatória');
        expect(celula(linha, 'Se não for entregue')).toBe('Elimina do processo');
        expect(celula(linha, 'Coleta')).toBe('Na fase inteira');
        expect(campoDeEntrega()).toBeNull();
        expect(botaoDeEdicao()?.getAttribute('aria-expanded')).toBe('false');
      });

      /** A norma de todos aparece uma vez, acima da tabela; repetida, dobraria cada linha. */
      it('mostra uma vez a norma resolvida que sustenta todos os documentos', () => {
        exigencias().alternarExigencia(ID_CPF, true);
        editor().escreverBaseLegal(ID_CPF, 0, 'referencia', 'Lei 12.711/2012, art. 3º');
        detectar();

        expect(
          nativo.querySelector('.doc-conferencia__norma-comum')?.textContent?.replace(/\s+/g, ' '),
        ).toContain(
          'Norma de todos os documentos: Lei 12.711/2012, art. 3º (O próprio edital · Resolvida)',
        );
        expect(celula(linhas()[0], 'Norma')).toBeUndefined();
      });

      it('mostra a norma de cada documento quando elas diferem', () => {
        TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set([
          ...TIPOS_DOCUMENTO,
          { ...TIPOS_DOCUMENTO[0], id: ID_RG, codigo: 'RG', nome: 'RG' },
        ]);
        exigencias().alternarExigencia(ID_CPF, true);
        exigencias().alternarExigencia(ID_RG, true);
        editor().escreverBaseLegal(ID_CPF, 0, 'referencia', 'Lei 12.711/2012, art. 3º');
        editor().escreverBaseLegal(ID_RG, 0, 'referencia', 'Lei 7.116/1983');
        detectar();

        expect(nativo.querySelector('.doc-conferencia__norma-comum')).toBeNull();
        expect(linhas().map((linha) => celula(linha, 'Norma'))).toEqual([
          'Lei 12.711/2012, art. 3º O próprio edital · Resolvida',
          'Lei 7.116/1983 O próprio edital · Resolvida',
        ]);
      });

      it('acusa no resumo a exigência que a publicação recusaria por falta de norma', () => {
        exigencias().alternarExigencia(ID_CPF, true);
        detectar();

        expect(celula(linhas()[0], 'Norma')).toContain('Sem norma resolvida');
      });

      it('abre e recolhe os campos pelo nome do documento, que diz o estado', () => {
        exigencias().alternarExigencia(ID_CPF, true);
        detectar();

        botaoDeEdicao()?.click();
        detectar();
        const controlados = botaoDeEdicao()?.getAttribute('aria-controls') ?? '';
        expect(botaoDeEdicao()?.getAttribute('aria-expanded')).toBe('true');
        expect(nativo.querySelector(`#${controlados}`)?.contains(campoDeEntrega())).toBe(true);

        botaoDeEdicao()?.click();
        detectar();
        expect(botaoDeEdicao()?.getAttribute('aria-expanded')).toBe('false');
        expect(campoDeEntrega()).toBeNull();
      });

      it('abre os campos do documento recém-acrescentado', () => {
        documentos().escolherDocumento(ID_CPF);
        documentos().acrescentarDocumento();
        detectar();

        expect(campoDeEntrega()).not.toBeNull();
      });

      it('vincula à exigência da fase o modelo que o envio confirma', () => {
        documentos().escolherDocumento(ID_CPF);
        documentos().acrescentarDocumento();
        detectar();
        const modelo = {
          modeloId: '01960000-0000-7000-0000-00000000a0de',
          nomeArquivo: 'declaracao.odt',
          formato: 'ODT',
          hashSha256: 'cd'.repeat(32),
        };

        const envio = raiz.query(By.directive(ModeloDaExigenciaComponent));
        (envio.componentInstance as ModeloDaExigenciaComponent).modeloChange.emit(modelo);

        expect(exigencias().exigenciaDoDocumento(ID_CPF).modelo).toEqual(modelo);
      });

      it('filtra os documentos pelo público e diz quantos sobraram', () => {
        TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set([
          ...TIPOS_DOCUMENTO,
          { ...TIPOS_DOCUMENTO[0], id: ID_RG, codigo: 'RG', nome: 'RG' },
        ]);
        exigencias().alternarExigencia(ID_CPF, true);
        exigencias().alternarExigencia(ID_RG, true);
        gatilho().escolherExigidoDe(ID_RG, 'quem');
        detectar();

        const filtro = nativo.querySelector<HTMLSelectElement>('#fase-AVALIACAO-doc-filtro');
        if (filtro === null) throw new Error('o filtro de público não está na tela');
        filtro.value = 'todo-candidato';
        filtro.dispatchEvent(new Event('change'));
        detectar();

        expect(linhas().map((linha) => linha.querySelector('th')?.textContent?.trim())).toEqual([
          'CPF',
        ]);
        expect(nativo.querySelector('#fase-AVALIACAO-doc-filtro-total')?.textContent?.trim()).toBe(
          '1 de 2 documentos.',
        );
      });

      /**
       * O documento aberto em edição fica na tela mesmo quando a edição o tira do público
       * filtrado: sumir levaria junto o campo em foco.
       */
      it('mantém à vista o documento em edição que sai do público filtrado', () => {
        documentos().escolherDocumento(ID_CPF);
        documentos().acrescentarDocumento();
        documentos().filtroDoPublico.set('todo-candidato');
        detectar();

        gatilho().escolherExigidoDe(ID_CPF, 'quem');
        detectar();

        expect(linhas()).toHaveLength(1);
        expect(campoDeEntrega()).not.toBeNull();
        expect(nativo.querySelector('#fase-AVALIACAO-doc-filtro-total')?.textContent?.trim()).toBe(
          '1 de 1 documentos.',
        );

        document.body.appendChild(nativo);
        botaoDeEdicao()?.click();
        detectar();
        expect(linhas()).toHaveLength(0);

        // Recolhido, o documento sai com o botão focado: o foco vai ao seletor do público, e a
        // contagem ligada a ele, que é região de status, diz o que saiu.
        const filtro = nativo.querySelector('#fase-AVALIACAO-doc-filtro');
        expect(document.activeElement).toBe(filtro);
        expect(
          nativo
            .querySelector('#fase-AVALIACAO-doc-filtro-total')
            ?.textContent?.replace(/\s+/g, ' '),
        ).toContain('CPF saiu da lista, porque não é mais do público filtrado.');
        nativo.remove();
      });

      /** Reescrever a condição filtrada não devolve o seletor a "todos" a cada tecla. */
      it('mantém o público escolhido quando nenhum documento o declara mais', () => {
        documentos().filtroDoPublico.set('condicao:Cor ou raça é INDIGENA');
        detectar();

        exigencias().alternarExigencia(ID_CPF, true);
        detectar();
        const filtro = nativo.querySelector<HTMLSelectElement>('#fase-AVALIACAO-doc-filtro');
        expect(filtro?.value).toBe('condicao:Cor ou raça é INDIGENA');
        expect(filtro?.selectedOptions[0]?.textContent?.trim()).toBe(
          'Candidato com: Cor ou raça é INDIGENA',
        );
      });

      it('mostra o documento recém-acrescentado sob qualquer filtro', () => {
        documentos().filtroDoPublico.set('condicao:Cor ou raça é INDIGENA');
        documentos().escolherDocumento(ID_CPF);
        documentos().acrescentarDocumento();
        detectar();

        expect(linhas()).toHaveLength(1);
        expect(campoDeEntrega()).not.toBeNull();
      });
    });
  });
});
