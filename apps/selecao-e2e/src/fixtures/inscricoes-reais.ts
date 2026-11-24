import { json } from './resposta-da-api';
import { respostasDa, type Pessoa } from './respostas-da-persona';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { API_URL, PDF_MINIMO, enviarPelaUrlAssinada, tokenDaPersona } from '@uniplus/shared-e2e';

/**
 * Inscrições de personas fictícias do portal num processo publicado, pelo caminho do próprio
 * candidato: rascunho, respostas, envio do laudo ao armazenamento por URL assinada e submissão.
 * Os dados pessoais vêm de `fake-people.json` do portal (uniplus-developers); nada é inventado.
 */

export const ARQUIVO_DE_PESSOAS =
  process.env['E2E_FAKE_PEOPLE'] ??
  path.resolve(__dirname, '../../../../../uniplus-developers/src/data/fake-people.json');

export interface InscricaoCriada {
  readonly username: string;
  readonly inscricaoId: string;
  readonly cpf: string;
  readonly rg: string;
  readonly nome: string;
}

async function pessoa(username: string): Promise<Pessoa> {
  const todas = JSON.parse(await readFile(ARQUIVO_DE_PESSOAS, 'utf-8')) as Pessoa[];
  const achada = todas.find((p) => p.username === username);
  if (achada === undefined) {
    throw new Error(`Persona ${username} não está em fake-people.json`);
  }
  return achada;
}

type RascunhoComSituacao = Rascunho & { situacao: { codigo: string; rotulo: string } };

interface Rascunho {
  readonly id: string;
  readonly eTag: string;
  readonly avaliacao: {
    readonly documentos: {
      readonly fases: readonly {
        readonly documentos: readonly {
          readonly exigenciaId: string;
          readonly ocorrenciaId: string | null;
          readonly tipoDocumentoCodigo: string;
          readonly obrigatorio: boolean;
          readonly arquivos?: readonly {
            readonly situacao: { readonly codigo: string; readonly rotulo: string };
          }[];
        }[];
      }[];
    };
  };
}

/**
 * A verificação do arquivo é assíncrona e a API só aceita a submissão com os obrigatórios
 * verificados. Espera os `enviados` arquivos da persona aparecerem no rascunho, todos verificados.
 */
async function aguardarVerificacaoDosArquivos(
  base: string,
  cabecalho: () => Record<string, string>,
  enviados: number,
): Promise<RascunhoComSituacao> {
  const limite = Date.now() + 60_000;
  for (;;) {
    const rascunho = await lerRascunhoComLaudo(base, cabecalho);
    if (arquivosVerificados(rascunho, enviados)) return rascunho;
    if (Date.now() > limite) {
      throw new Error('Os arquivos enviados não terminaram a verificação em 60 s.');
    }
    await new Promise((resolver) => setTimeout(resolver, 1_000));
  }
}

async function lerRascunhoComLaudo(
  base: string,
  cabecalho: () => Record<string, string>,
): Promise<RascunhoComSituacao> {
  return json<RascunhoComSituacao>(
    await fetch(base, { headers: cabecalho() }),
    200,
    'rascunho com o laudo',
  );
}

function arquivosVerificados(rascunho: Rascunho, enviados: number): boolean {
  const arquivos = rascunho.avaliacao.documentos.fases
    .flatMap((fase) => fase.documentos)
    .flatMap((documento) => documento.arquivos ?? []);
  return (
    arquivos.length >= enviados &&
    arquivos.every((arquivo) => arquivo.situacao.codigo === 'VERIFICADO')
  );
}

/**
 * A oferta de Medicina do processo, lida do próprio certame: o id da oferta muda a cada base.
 * O critério é o nome do curso; mais de uma oferta de Medicina (turnos ou campi) fica com a
 * primeira na ordem da API, e nenhuma é erro.
 */
async function ofertaDeMedicina(processoId: string): Promise<string> {
  const certame = await json<{ ofertas: { ofertaCursoOrigemId: string; cursoNome: string }[] }>(
    await fetch(`${API_URL}/api/selecao/certames/${processoId}`),
    200,
    `certame ${processoId}`,
  );
  const oferta = certame.ofertas.find((o) => o.cursoNome.toLowerCase().includes('medicina'));
  if (oferta === undefined) {
    const nomes = certame.ofertas.map((o) => o.cursoNome).join(', ') || 'nenhuma oferta';
    throw new Error(`O processo ${processoId} não tem oferta de Medicina (ofertas: ${nomes}).`);
  }
  return oferta.ofertaCursoOrigemId;
}

interface TermoDoFormulario {
  readonly codigo: string;
  readonly versaoId: string;
  readonly conteudo: { readonly hashVersao: string };
}

function aceitesDosTermos(termos: TermoDoFormulario[]): CorpoDaInscricao['aceites'] {
  return termos.map(({ codigo, versaoId, conteudo }) => ({
    codigo,
    versaoId,
    hashVersao: conteudo.hashVersao,
  }));
}

/**
 * Inscreve a persona no processo. Com `comLaudo`, ela declara deficiência e envia o laudo
 * médico que o processo exige; devolve a inscrição já submetida. Repetir a chamada para quem
 * já tem inscrição enviada devolve a existente.
 */
export async function inscreverPersona(
  processoId: string,
  username: string,
  comLaudo: boolean,
): Promise<InscricaoCriada> {
  const p = await pessoa(username);
  const token = await tokenDaPersona(username);
  const inscricao = new InscricaoDaPersona(processoId, username, token);
  const rascunho = await inscricao.inscrever(p, comLaudo);
  return { username, inscricaoId: rascunho.id, cpf: p.cpf, rg: p.rg, nome: p.nome };
}

type CorpoDaInscricao = {
  ofertaCursoId: string;
  ofertaCursoSegundaOpcaoId: null;
  respostas: Record<string, unknown>;
  grupos: Record<string, never>;
  aceites: { codigo: string; versaoId: string; hashVersao: string }[];
};

type ExigenciaDeLaudo = Rascunho['avaliacao']['documentos']['fases'][number]['documentos'][number];
type EnvioDoLaudo = { arquivoId: string; urlUpload: string; contentTypeExigido: string };

class InscricaoDaPersona {
  private readonly base: string;

  constructor(
    private readonly processoId: string,
    private readonly username: string,
    private readonly token: string,
  ) {
    this.base = `${API_URL}/api/selecao/processos-seletivos/${processoId}/inscricao`;
  }

  private cabecalho = (extra: Record<string, string> = {}): Record<string, string> => ({
    authorization: `Bearer ${this.token}`,
    'idempotency-key': crypto.randomUUID(),
    accept: 'application/vnd.uniplus.inscricao.v1+json',
    ...extra,
  });

  async inscrever(p: Pessoa, comLaudo: boolean): Promise<RascunhoComSituacao> {
    let rascunho = await this.obterRascunho();
    if (rascunho.situacao.codigo !== 'RASCUNHO') return rascunho;
    const corpo = await this.montarRespostas(p, comLaudo);
    rascunho = await this.salvarRespostas(rascunho, corpo);
    if (comLaudo) rascunho = await this.enviarLaudos(rascunho);
    await this.submeter(rascunho, corpo);
    return rascunho;
  }

  async obterRascunho(): Promise<RascunhoComSituacao> {
    let resposta = await fetch(this.base, { headers: this.cabecalho() });
    if (resposta.status === 404) {
      resposta = await fetch(this.base, { method: 'POST', headers: this.cabecalho() });
    }
    return json(resposta, 200, `rascunho de ${this.username}`);
  }

  async montarRespostas(p: Pessoa, comLaudo: boolean): Promise<CorpoDaInscricao> {
    const formulario = await this.formulario();
    return {
      ofertaCursoId: await ofertaDeMedicina(this.processoId),
      ofertaCursoSegundaOpcaoId: null,
      respostas: await respostasDa(
        p,
        this.token,
        comLaudo,
        formulario.coleta.itens.some((item) => item.fatoCodigo === 'CIDADE_DE_PROVA'),
      ),
      grupos: {},
      aceites: aceitesDosTermos(formulario.termos),
    };
  }

  private async formulario(): Promise<{
    termos: TermoDoFormulario[];
    coleta: { itens: { fatoCodigo: string }[] };
  }> {
    const { formulario } = await json<{
      formulario: { termos: TermoDoFormulario[]; coleta: { itens: { fatoCodigo: string }[] } };
    }>(
      await fetch(
        `${API_URL}/api/selecao/processos-seletivos/${this.processoId}/formularios/INSCRICAO`,
      ),
      200,
      'formulário de inscrição',
    );
    return formulario;
  }

  async salvarRespostas(
    rascunho: RascunhoComSituacao,
    corpo: CorpoDaInscricao,
  ): Promise<RascunhoComSituacao> {
    const resposta = await fetch(this.base, {
      method: 'PUT',
      headers: this.cabecalho({ 'if-match': rascunho.eTag, 'content-type': 'application/json' }),
      body: JSON.stringify(corpo),
    });
    return json(resposta, 200, `respostas de ${this.username}`);
  }

  async enviarLaudos(rascunho: RascunhoComSituacao): Promise<RascunhoComSituacao> {
    const exigencias = rascunho.avaliacao.documentos.fases
      .flatMap((fase) => fase.documentos)
      .filter((d) => d.tipoDocumentoCodigo.includes('LAUDO'));
    if (exigencias.length === 0) {
      throw new Error('O processo não pediu laudo a quem declarou deficiência.');
    }
    for (const exigencia of exigencias) await this.enviarLaudo(exigencia);
    return aguardarVerificacaoDosArquivos(this.base, this.cabecalho, exigencias.length);
  }

  private async enviarLaudo(exigencia: ExigenciaDeLaudo): Promise<void> {
    const envio = await this.iniciarEnvio(exigencia);
    const etag = await enviarPelaUrlAssinada(envio.urlUpload, envio.contentTypeExigido, PDF_MINIMO);
    await this.confirmarEnvio(envio.arquivoId, etag);
  }

  private async iniciarEnvio(exigencia: ExigenciaDeLaudo): Promise<EnvioDoLaudo> {
    const resposta = await fetch(`${this.base}/documentos/envios`, {
      method: 'POST',
      headers: this.cabecalho({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        exigenciaId: exigencia.exigenciaId,
        ocorrenciaId: exigencia.ocorrenciaId,
        apresentacaoId: null,
        tipoDeMidia: 'application/pdf',
        tamanhoBytes: PDF_MINIMO.length,
      }),
    });
    return json(resposta, 201, 'iniciar o envio do laudo');
  }

  private async confirmarEnvio(arquivoId: string, etag: string): Promise<void> {
    await json(
      await fetch(`${this.base}/documentos/envios/${arquivoId}/confirmacao`, {
        method: 'POST',
        headers: this.cabecalho({ 'content-type': 'application/json' }),
        body: JSON.stringify({ etag }),
      }),
      200,
      'confirmar o envio do laudo',
    );
  }

  async submeter(rascunho: RascunhoComSituacao, corpo: CorpoDaInscricao): Promise<void> {
    await json(
      await fetch(`${this.base}/submissao`, {
        method: 'POST',
        headers: this.cabecalho({
          'if-match': rascunho.eTag,
          'content-type': 'application/json',
          accept: 'application/vnd.uniplus.recibo-da-inscricao.v1+json',
        }),
        body: JSON.stringify(corpo),
      }),
      200,
      `submissão de ${this.username}`,
    );
  }
}
