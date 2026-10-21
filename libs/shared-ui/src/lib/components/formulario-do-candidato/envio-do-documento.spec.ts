import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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
  chave: ALVO.chave,
  tipoDeMidia: 'application/pdf',
  tamanhoBytes: 2048,
};

const arquivo = (nome: string, bytes = 2048): File =>
  new File([new ArrayBuffer(bytes)], nome, { type: 'application/pdf' });

describe('Envio do arquivo de um documento exigido', () => {
  let fixture: ComponentFixture<EnvioDoDocumentoComponent>;
  let envio: { enviar: ReturnType<typeof vi.fn>; remover: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    envio = {
      enviar: vi.fn().mockResolvedValue({ ok: true, arquivo: CONFIRMADO }),
      remover: vi.fn().mockResolvedValue({ ok: true }),
    };
  });

  const montar = (entradas: Record<string, unknown> = {}): HTMLElement => {
    fixture = TestBed.createComponent(EnvioDoDocumentoComponent);
    fixture.componentRef.setInput('alvo', ALVO);
    fixture.componentRef.setInput('formatos', { qualquer: false, lista: ['PDF'] });
    fixture.componentRef.setInput('envio', envio as unknown as EnvioDeDocumentos);
    for (const [nome, valor] of Object.entries(entradas)) fixture.componentRef.setInput(nome, valor);
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

  it('envia o arquivo escolhido para a exigência e o mostra como enviado', async () => {
    const tela = montar();
    const enviado = vi.fn();
    fixture.componentInstance.arquivoEnviado.subscribe(enviado);

    const laudo = arquivo('laudo.pdf');
    await escolher(laudo);

    expect(envio.enviar).toHaveBeenCalledWith(ALVO, laudo, expect.any(Function));
    expect(enviado).toHaveBeenCalledWith(CONFIRMADO);
    expect(tela.querySelector('.uni-uploader__item-name')?.textContent).toContain('laudo.pdf');
  });

  it('arquivo acima do tamanho da exigência: anuncia o erro ligado ao campo e não envia', async () => {
    const tela = montar({ tamanhoMaximoBytes: 1024 * 1024 });

    await escolher(arquivo('laudo.pdf', 2 * 1024 * 1024));

    expect(envio.enviar).not.toHaveBeenCalled();
    const erro = tela.querySelector('[role="alert"]') as HTMLElement;
    expect(erro.textContent).toContain('excede o tamanho máximo de 1MB');
    const campo = tela.querySelector('input[type="file"]') as HTMLInputElement;
    expect(campo.getAttribute('aria-describedby')).toContain(erro.id);
    expect(campo.getAttribute('aria-invalid')).toBe('true');
  });

  it('formato fora da lista da exigência: recusa no navegador', async () => {
    const tela = montar();

    await escolher(new File(['x'], 'foto.png', { type: 'image/png' }));

    expect(envio.enviar).not.toHaveBeenCalled();
    expect(tela.querySelector('[role="alert"]')?.textContent).toContain('Tipo de arquivo não permitido');
  });

  it('falha no envio: mostra a recusa e repete o mesmo arquivo na nova tentativa', async () => {
    envio.enviar.mockResolvedValueOnce({
      ok: false,
      mensagem: 'O antivírus está indisponível.',
      podeTentarDeNovo: true,
    });
    const tela = montar();
    const laudo = arquivo('laudo.pdf');

    await escolher(laudo);
    expect(tela.querySelector('[role="alert"]')?.textContent).toContain('O antivírus está indisponível.');

    (tela.querySelector('button[aria-label^="Tentar enviar novamente"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(envio.enviar).toHaveBeenCalledTimes(2);
    expect(envio.enviar.mock.calls[1][1]).toBe(laudo);
  });

  it('remove o arquivo enviado pela API e avisa quem hospeda', async () => {
    const tela = montar({ arquivos: [CONFIRMADO] });
    const removido = vi.fn();
    fixture.componentInstance.arquivoRemovido.subscribe(removido);

    (tela.querySelector('button[aria-label^="Remover"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(envio.remover).toHaveBeenCalledWith('arquivo-1');
    expect(removido).toHaveBeenCalledWith('arquivo-1');
    expect(tela.querySelector('.uni-uploader__item')).toBeNull();
  });

  it('com a inscrição enviada, não deixa remover nem enviar', () => {
    const tela = montar({ arquivos: [CONFIRMADO], podeAlterar: false });

    expect(tela.querySelector('button[aria-label^="Remover"]')).toBeNull();
    expect((tela.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBe(true);
  });

  it('com mínimo acima de 1, diz quantos arquivos enviar e liga a dica ao campo', () => {
    const tela = montar({ quantidadeMinima: 2 });

    const dica = tela.querySelector('.envio-do-documento__dica') as HTMLElement;
    expect(dica.textContent).toContain('Envie 2 arquivos');
    expect(
      (tela.querySelector('input[type="file"]') as HTMLInputElement).getAttribute('aria-describedby'),
    ).toContain(dica.id);
  });

  it('escreve a situação da exigência quando a avaliação a informa', () => {
    const tela = montar({ situacao: 'PENDENTE' });

    expect(tela.querySelector('ui-tag')?.textContent?.trim()).toBe('Pendente');
  });
});
