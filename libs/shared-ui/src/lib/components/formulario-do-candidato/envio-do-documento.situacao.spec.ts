import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileUploadComponent } from '../file-upload/file-upload';
import type { AlvoDoEnvio, ArquivoEnviado, EnvioDeDocumentos } from './envio-de-documentos';
import { EnvioDoDocumentoComponent } from './envio-do-documento';

const ALVO: AlvoDoEnvio = {
  chave: 'exigencia-laudo:',
  exigenciaId: 'exigencia-laudo',
  ocorrenciaId: null,
  nome: 'Laudo médico',
};
const CONFIRMADO: ArquivoEnviado = {
  arquivoId: 'arquivo-1',
  apresentacaoId: 'apresentacao-1',
  chave: ALVO.chave,
  tipoDeMidia: 'application/pdf',
  tamanhoBytes: 2048,
  situacao: 'verificado',
  mensagem: null,
  rotulo: 'Arquivo 1',
  // 09:33 no fuso institucional (America/Belem)
  confirmadoEm: '2026-10-22T12:33:00Z',
};

const arquivo = (nome: string, bytes = 2048): File =>
  new File([new ArrayBuffer(bytes)], nome, { type: 'application/pdf' });

describe('Envio do arquivo de um documento exigido', () => {
  let fixture: ComponentFixture<EnvioDoDocumentoComponent>;
  let envio: {
    arquivos: ReturnType<typeof signal<readonly ArquivoEnviado[]>>;
    mudancas: ReturnType<typeof signal<number>>;
    ocupado: ReturnType<typeof signal<boolean>>;
    enviar: ReturnType<typeof vi.fn>;
    remover: ReturnType<typeof vi.fn>;
    baixar: ReturnType<typeof vi.fn>;
  };

  // Como o envio de quem hospeda: o arquivo confirmado fica na lista dele, e a remoção o tira.
  beforeEach(() => {
    const arquivos = signal<readonly ArquivoEnviado[]>([]);
    envio = {
      arquivos,
      mudancas: signal(0),
      ocupado: signal(false),
      enviar: vi.fn().mockImplementation(async () => {
        arquivos.update((lista) => [...lista, CONFIRMADO]);
        return { ok: true, arquivo: CONFIRMADO };
      }),
      remover: vi.fn().mockImplementation(async (id: string) => {
        arquivos.update((lista) => lista.filter((a) => a.arquivoId !== id));
        return { ok: true };
      }),
      baixar: vi.fn().mockResolvedValue({ ok: true }),
    };
  });

  const montar = (entradas: Record<string, unknown> = {}): HTMLElement => {
    fixture = TestBed.createComponent(EnvioDoDocumentoComponent);
    fixture.componentRef.setInput('alvo', ALVO);
    fixture.componentRef.setInput('formatos', { qualquer: false, lista: ['PDF'] });
    fixture.componentRef.setInput('tamanhoMaximoBytes', 10 * 1024 * 1024);
    fixture.componentRef.setInput('envio', envio as unknown as EnvioDeDocumentos);
    for (const [nome, valor] of Object.entries(entradas))
      fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const escolher = async (...arquivos: File[]): Promise<void> => {
    fixture.debugElement
      .query(By.directive(FileUploadComponent))
      .componentInstance.onDrop(arquivos);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('remove o arquivo enviado pela API e avisa quem hospeda', async () => {
    const tela = montar();
    envio.arquivos.set([CONFIRMADO]);
    fixture.detectChanges();

    (tela.querySelector('button[aria-label^="Remover"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(envio.remover).toHaveBeenCalledWith('arquivo-1');
    expect(tela.querySelector('.uni-uploader__item')).toBeNull();
  });

  it('arquivo removido não volta enquanto a avaliação que o trazia não é refeita', async () => {
    const tela = montar({ arquivos: [CONFIRMADO] });

    (tela.querySelector('button[aria-label^="Remover"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(tela.querySelector('.uni-uploader__item')).toBeNull();
  });

  it('com a inscrição enviada, ainda deixa enviar para corrigir, mas não remover', () => {
    const tela = montar({ arquivos: [CONFIRMADO], podeRemover: false });

    expect(tela.querySelector('button[aria-label^="Remover"]')).toBeNull();
    expect((tela.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBe(false);
  });

  it('com a inscrição sendo enviada, não deixa enviar', () => {
    const tela = montar({ podeEnviar: false });

    expect((tela.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBe(true);
  });

  it('com mínimo acima de 1, diz quantos arquivos enviar e liga a dica ao campo', () => {
    const tela = montar({ quantidadeMinima: 2 });

    const dica = tela.querySelector('.envio-do-documento__dica') as HTMLElement;
    expect(dica.textContent).toContain('Envie 2 arquivos');
    expect(
      (tela.querySelector('input[type="file"]') as HTMLInputElement).getAttribute(
        'aria-describedby',
      ),
    ).toContain(dica.id);
  });

  it('escreve a situação da exigência quando a avaliação a informa', () => {
    const tela = montar({ situacao: { rotulo: 'Pendente', variante: 'warning', atendido: false } });

    expect(tela.querySelector('ui-tag')?.textContent?.trim()).toBe('Pendente');
  });

  it('não tem violação de acessibilidade com o arquivo enviado, a situação e a dica', async () => {
    document.body.appendChild(
      montar({
        situacao: { rotulo: 'Pendente', variante: 'warning', atendido: false },
        quantidadeMinima: 2,
      }),
    );
    await escolher(arquivo('laudo.pdf'));

    // O contraste depende dos estilos globais do design system, que o teste de unidade não carrega.
    const resultado = await axe.run(fixture.nativeElement, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(resultado.violations.map((v) => v.id)).toEqual([]);
    fixture.nativeElement.remove();
  });
});
