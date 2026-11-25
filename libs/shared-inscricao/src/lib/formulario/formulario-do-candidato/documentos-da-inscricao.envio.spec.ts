import { signal } from '@angular/core';
import { type ComponentFixture } from '@angular/core/testing';

import {
  arquivoVerificado,
  bloco,
  configurarOBloco,
  documento,
  entradasDoBloco,
  FORMULARIO,
  montarOBloco,
  naTela,
  nestaFase,
} from './documentos-da-inscricao.testing';
import type { EnvioDeDocumentos } from './envio-de-documentos';
import { FormularioDoCandidatoComponent } from './formulario-do-candidato';
import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import type { AvaliacaoNaTela } from './modalidades-avaliadas';

describe('Bloco de documentos da inscrição — envio do arquivo exigido', () => {
  let fixture: ComponentFixture<FormularioDoCandidatoComponent>;

  beforeEach(configurarOBloco);

  const montar = (
    avaliacao: AvaliacaoNaTela | null,
    envioDeDocumentos: EnvioDeDocumentos | null = null,
    ocorrenciasGravadas: ReadonlySet<string> | null = null,
    formulario: FormularioDoCandidato = FORMULARIO,
  ): HTMLElement => {
    const entradas = entradasDoBloco(avaliacao, envioDeDocumentos, ocorrenciasGravadas);
    fixture = montarOBloco(entradas, formulario);
    return fixture.nativeElement as HTMLElement;
  };

  describe('envio do arquivo exigido', () => {
    const ENVIO: EnvioDeDocumentos = {
      arquivos: signal([]),
      mudancas: signal(0),
      ocupado: signal(false),
      enviar: vi.fn(),
      remover: vi.fn(),
      baixar: vi.fn(),
    };

    it('oferece o envio só para o que as respostas já exigem', () => {
      const tela = montar(
        naTela(
          nestaFase(
            documento('Laudo médico'),
            documento('Histórico', { situacao: 'PODE_SER_EXIGIDO' }),
          ),
        ),
        ENVIO,
      );

      const campos = [...bloco(tela).querySelectorAll('insc-envio-do-documento label')];
      expect(campos.map((c) => c.textContent?.trim())).toEqual(['Enviar Laudo médico']);
    });

    it('usa o que a avaliação informa da exigência: situação, arquivos, formatos, limite e mínimo', () => {
      const tela = montar(
        naTela(
          nestaFase(
            documento('Laudo médico', {
              situacao: 'SATISFEITA',
              formatosAceitos: ['PDF', 'JPEG'],
              tamanhoMaximoBytes: 3 * 1024 * 1024,
              quantidadeMinima: 2,
              arquivos: [arquivoVerificado('a1')],
            }),
            documento('Atestado', { situacao: 'PENDENTE' }),
          ),
        ),
        ENVIO,
      );

      const [laudo, atestado] = [...bloco(tela).querySelectorAll('insc-envio-do-documento')];
      expect(laudo.querySelector('ui-tag')?.textContent?.trim()).toBe(
        'Exigido pelas suas respostas',
      );
      expect(atestado.querySelector('ui-tag')?.textContent?.trim()).toBe(
        'Exigido pelas suas respostas',
      );
      expect(laudo.querySelector('.uni-uploader__item-name')?.textContent).toContain('Arquivo 1');
      expect(laudo.textContent).toContain('Envie 2 arquivos');
      expect(laudo.textContent).toContain('PDF, JPG - tamanho máximo: 3MB');
      expect(laudo.closest('li')?.querySelector('.lista-de-documentos__meta')?.textContent).toMatch(
        /·\s*PDF, JPG\s*$/u,
      );
    });

    it('enquanto não se sabe a quais integrantes o documento se liga, não oferece envio', () => {
      const tela = montar(
        naTela(
          nestaFase(
            documento('Laudo médico', {
              grupoCodigo: 'MEMBROS',
              grupoDoFormularioParaRepeticao: 'MEMBROS',
            }),
          ),
        ),
        ENVIO,
      );

      expect(bloco(tela).querySelector('h4')).not.toBeNull();
      expect(bloco(tela).querySelector('insc-envio-do-documento')).toBeNull();
    });

    it('ocorrência que o rascunho ainda não gravou pede salvar antes de enviar', () => {
      const tela = montar(
        naTela(nestaFase(documento('Laudo médico', { ocorrenciaId: 'o1' }))),
        ENVIO,
        new Set(),
      );

      expect(bloco(tela).querySelector('insc-envio-do-documento')).toBeNull();
      expect(bloco(tela).textContent).toContain('Salve o rascunho para enviar o arquivo');
    });

    it('a recusa por documento obrigatório ausente leva ao passo Documentos, ao envio da exigência, com o erro nele', async () => {
      const tela = montar(
        naTela(nestaFase(documento('Laudo médico'), documento('Atestado'))),
        ENVIO,
      );
      const primeiroPasso = tela.querySelector<HTMLButtonElement>('ui-steps .ui-steps__botao');
      primeiroPasso?.click();
      fixture.detectChanges();
      expect(bloco(tela)).toBeNull();

      fixture.componentRef.setInput('errosDoServidor', [
        {
          campo: 'documentos.exigencia-Atestado',
          mensagem: 'Envie este documento, ou uma das alternativas da lista, para concluir.',
        },
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const envio = bloco(tela).querySelector('[data-campo="documentos.exigencia-Atestado"]');
      expect(envio?.contains(document.activeElement)).toBe(true);
      expect(envio?.textContent).toContain(
        'Envie este documento, ou uma das alternativas da lista, para concluir.',
      );
      expect(tela.textContent).toContain('O servidor recusou 1 resposta desta seção');
      expect(
        bloco(tela).querySelector('[data-campo="documentos.exigencia-Laudo médico"]')?.textContent,
      ).not.toContain('Envie este documento, ou uma das alternativas da lista, para concluir.');
    });

    it('a recusa de uma exigência some quando a avaliação a dá por atendida', async () => {
      const tela = montar(naTela(nestaFase(documento('Atestado'))), ENVIO);
      fixture.componentRef.setInput('errosDoServidor', [
        { campo: 'documentos.exigencia-Atestado', mensagem: 'Documento ausente.' },
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(bloco(tela).querySelector('[role="alert"]')?.textContent).toContain(
        'Documento ausente.',
      );

      fixture.componentRef.setInput(
        'avaliacao',
        naTela(nestaFase(documento('Atestado', { situacao: 'SATISFEITA' }))),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(tela.textContent).not.toContain('Documento ausente.');
      expect(tela.textContent).not.toContain('O servidor recusou');
    });

    it('a recusa continua enquanto a exigência com mais de um arquivo está pendente', async () => {
      const tela = montar(
        naTela(nestaFase(documento('Laudo médico', { quantidadeMinima: 2 }))),
        ENVIO,
      );
      fixture.componentRef.setInput('errosDoServidor', [
        { campo: 'documentos.exigencia-Laudo médico', mensagem: 'Documento ausente.' },
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentRef.setInput(
        'avaliacao',
        naTela(
          nestaFase(
            documento('Laudo médico', {
              quantidadeMinima: 2,
              arquivos: [arquivoVerificado('a1')],
            }),
          ),
        ),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(tela.textContent).toContain('Documento ausente.');
    });

    it('a recusa de uma alternativa some quando o candidato atende o grupo "um ou outro" por outra', async () => {
      const identidade = {
        grupoId: 'identidade',
        forma: { codigo: 'QUANTIDADE_MINIMA_DE_ITENS', rotulo: 'Quantidade mínima' },
        minimo: 1,
        grupoDoFormularioParaRepeticao: null,
      };
      const tela = montar(
        naTela(
          nestaFase(
            documento('RG', { grupos: [identidade] }),
            documento('CNH', { grupos: [identidade] }),
          ),
        ),
        ENVIO,
      );
      fixture.componentRef.setInput('errosDoServidor', [
        { campo: 'documentos.exigencia-RG', mensagem: 'Documento ausente.' },
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(tela.textContent).toContain('Documento ausente.');

      fixture.componentRef.setInput(
        'avaliacao',
        naTela(
          nestaFase(
            documento('RG', { grupos: [identidade] }),
            documento('CNH', { grupos: [identidade], situacao: 'SATISFEITA' }),
          ),
        ),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(tela.textContent).not.toContain('Documento ausente.');
      expect(tela.textContent).not.toContain('O servidor recusou');
    });

    const recusar = async (campo: string): Promise<void> => {
      fixture.componentRef.setInput('errosDoServidor', [{ campo, mensagem: 'Documento ausente.' }]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const reavaliar = async (avaliacao: AvaliacaoNaTela): Promise<void> => {
      fixture.componentRef.setInput('avaliacao', avaliacao);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('a recusa sai quando um grupo "um ou outro" externo está atendido, mesmo com o interno pendente', async () => {
      const externo = {
        grupoId: 'externo',
        forma: { codigo: 'QUANTIDADE_MINIMA_DE_ITENS', rotulo: 'Quantidade mínima' },
        minimo: 1,
        grupoDoFormularioParaRepeticao: null,
      };
      const interno = {
        grupoId: 'interno',
        forma: { codigo: 'QUANTIDADE_MINIMA_DE_ITENS', rotulo: 'Quantidade mínima' },
        minimo: 1,
        grupoDoFormularioParaRepeticao: null,
      };
      const docs = (passaporte: string) =>
        naTela(
          nestaFase(
            documento('RG', { grupos: [externo, interno] }),
            documento('CNH', { grupos: [externo, interno] }),
            documento('Passaporte', { grupos: [externo], situacao: passaporte }),
          ),
        );
      const tela = montar(docs('PENDENTE'), ENVIO);
      await recusar('documentos.exigencia-RG');
      expect(tela.textContent).toContain('Documento ausente.');

      await reavaliar(docs('SATISFEITA'));

      expect(tela.textContent).not.toContain('Documento ausente.');
      expect(tela.textContent).not.toContain('O servidor recusou');
    });

    it('a recusa de uma exigência que as respostas já não pedem sai com ela', async () => {
      const tela = montar(naTela(nestaFase(documento('Atestado'))), ENVIO);
      await recusar('documentos.exigencia-Atestado');
      expect(tela.textContent).toContain('O servidor recusou 1 resposta');

      await reavaliar(naTela(nestaFase(documento('Atestado', { situacao: 'PODE_SER_EXIGIDO' }))));

      expect(tela.textContent).not.toContain('Documento ausente.');
      expect(tela.textContent).not.toContain('O servidor recusou');
    });

    it('na simulação do administrador, que não envia, o bloco continua só a lista', () => {
      const tela = montar(naTela(nestaFase(documento('Laudo médico'))));

      expect(bloco(tela).querySelector('insc-envio-do-documento')).toBeNull();
    });
  });
});
