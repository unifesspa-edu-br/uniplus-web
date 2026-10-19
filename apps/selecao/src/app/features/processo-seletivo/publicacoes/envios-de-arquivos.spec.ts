import { HttpHeaders } from '@angular/common/http';
import { apiOk, type ProblemDetails } from '@uniplus/shared-core/http';
import { FinalidadeDoDocumento } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type { EnvioDoAnexo } from '../steps/shared/anexos-do-edital/envio-do-anexo.service';
import { EnviosDeArquivos } from './envios-de-arquivos';

const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const DOCUMENTO_ID = '01960000-0000-7000-0000-0000000005d1';

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Um envio cujas três fases só avançam quando o teste libera a iniciação. */
function envioControlado() {
  let liberar: () => void = () => undefined;
  const iniciacao = new Promise<void>((resolve) => (liberar = resolve));
  const chamadas = { iniciar: 0, enviar: 0, confirmar: 0 };

  const envio = {
    iniciar: async () => {
      chamadas.iniciar += 1;
      await iniciacao;
      return {
        inconclusiva: false,
        resultado: apiOk(
          {
            documentoAPublicarId: DOCUMENTO_ID,
            urlUpload: 'http://localhost:9000/x',
            contentTypeExigido: 'application/pdf',
            expiraEm: new Date(Date.now() + 900_000).toISOString(),
          },
          201,
          new HttpHeaders(),
        ),
      };
    },
    enviarArquivo: async () => {
      chamadas.enviar += 1;
      return { ok: true as const };
    },
    confirmar: async () => {
      chamadas.confirmar += 1;
      return { inconclusiva: false, resultado: apiOk({ id: DOCUMENTO_ID }, 200, new HttpHeaders()) };
    },
  } as unknown as EnvioDoAnexo;

  return { envio, liberar, chamadas };
}

function lista(envio: EnvioDoAnexo, processoId: string | null = PROCESSO_ID): EnviosDeArquivos {
  return new EnviosDeArquivos({
    finalidade: FinalidadeDoDocumento.documentoDeAto,
    processoId: () => processoId,
    abrirEnvio: () => envio,
    tipoDeMidiaDe: () => 'application/pdf',
    recusaDoFormato: 'Formato não aceito.',
    explicar: (problema: ProblemDetails) => problema.title,
    nomeInicial: (nome) => nome.replace(/\.pdf$/u, ''),
  });
}

describe('EnviosDeArquivos', () => {
  it('só compõe o ato com o arquivo que o servidor selou', async () => {
    const { envio, liberar } = envioControlado();
    const arquivos = lista(envio);

    arquivos.escolher([new File(['x'], 'aviso.pdf')]);
    expect(arquivos.confirmados()).toEqual([]);
    expect(arquivos.naoConfirmados()).toBe(1);

    liberar();
    await tick();

    expect(arquivos.confirmados()).toEqual([{ documentoAPublicarId: DOCUMENTO_ID, nome: 'aviso' }]);
    expect(arquivos.naoConfirmados()).toBe(0);
  });

  it('descartar a lista impede que a resposta tardia escreva numa lista que já é outra', async () => {
    const { envio, liberar, chamadas } = envioControlado();
    const arquivos = lista(envio);

    arquivos.escolher([new File(['x'], 'aviso.pdf')]);
    arquivos.descartar();
    liberar();
    await tick();

    expect(arquivos.arquivos()).toEqual([]);
    expect(chamadas.enviar).toBe(0);
    expect(chamadas.confirmar).toBe(0);
  });

  it('depois de descartar, o arquivo novo não espera o envio descartado que ficou parado', async () => {
    const { envio, chamadas } = envioControlado();
    const arquivos = lista(envio);

    arquivos.escolher([new File(['x'], 'aviso.pdf')]);
    await tick();
    expect(chamadas.iniciar).toBe(1);

    arquivos.descartar();
    arquivos.escolher([new File(['y'], 'comunicado.pdf')]);
    await tick();

    expect(chamadas.iniciar).toBe(2);
  });

  it('não envia nada enquanto não há processo', () => {
    const { envio, chamadas } = envioControlado();
    const arquivos = lista(envio, null);

    arquivos.escolher([new File(['x'], 'aviso.pdf')]);

    expect(arquivos.arquivos()).toEqual([]);
    expect(chamadas.iniciar).toBe(0);
  });

  it('não deixa retirar o arquivo em envio', () => {
    const { envio } = envioControlado();
    const arquivos = lista(envio);

    arquivos.escolher([new File(['x'], 'aviso.pdf')]);
    const [emEnvio] = arquivos.arquivos();
    arquivos.retirar(emEnvio.id);

    expect(arquivos.arquivos()).toHaveLength(1);
    expect(arquivos.itens()[0].podeRetirar).toBe(false);
  });
});
