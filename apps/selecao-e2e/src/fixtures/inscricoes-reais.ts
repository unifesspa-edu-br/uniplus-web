import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { API_URL, tokenDaPersona } from '@uniplus/shared-e2e';

/**
 * Inscrições de personas fictícias do portal num processo publicado, pelo caminho do próprio
 * candidato: rascunho, respostas, envio do laudo ao armazenamento por URL assinada e submissão.
 * Os dados pessoais vêm de `fake-people.json` do portal (uniplus-developers); nada é inventado.
 */

const GEO_URL = process.env['E2E_GEO_URL'] ?? 'http://localhost:5400';
const OFERTA_MEDICINA = '01a188d4-aed8-7488-b84d-6b3a3b1a5377';

export const ARQUIVO_DE_PESSOAS =
  process.env['E2E_FAKE_PEOPLE'] ??
  path.resolve(__dirname, '../../../../../uniplus-developers/src/data/fake-people.json');

/** PDF mínimo válido: a API confere a assinatura `%PDF-`. */
const PDF_MINIMO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
  'utf-8',
);

interface Pessoa {
  readonly nome: string;
  readonly nome_social?: string | null;
  readonly username: string;
  readonly sexo: 'Feminino' | 'Masculino';
  readonly data_nasc: string;
  readonly cpf: string;
  readonly rg: string;
  readonly mae: string;
  readonly pai: string;
  readonly email: string;
  readonly cep: string;
  readonly endereco: string;
  readonly numero: number;
  readonly bairro: string;
  readonly celular: string;
}

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

async function json<T>(resposta: Response, esperado: number, contexto: string): Promise<T> {
  const texto = await resposta.text();
  if (resposta.status < esperado || resposta.status >= esperado + 100) {
    throw new Error(`${contexto}: ${resposta.status} ${texto.slice(0, 400)}`);
  }
  return (texto === '' ? null : JSON.parse(texto)) as T;
}

async function respostasDa(p: Pessoa, token: string, comLaudo: boolean): Promise<Record<string, unknown>> {
  const cep = p.cep.replace(/\D/g, '');
  const geo = await json<{ codigoIbge: string; cidade: string; uf: string }>(
    await fetch(`${GEO_URL}/api/cep/${cep}`, { headers: { authorization: `Bearer ${token}` } }),
    200,
    `CEP ${cep}`,
  );
  const sexo = p.sexo === 'Feminino' ? 'FEMININO' : 'MASCULINO';
  const [dia, mes, ano] = p.data_nasc.split('/');
  return {
    NOME: p.nome,
    DESEJA_NOME_SOCIAL: p.nome_social != null,
    ...(p.nome_social != null ? { NOME_SOCIAL: p.nome_social } : {}),
    NACIONALIDADE: 'NATO',
    CPF: p.cpf.replace(/\D/g, ''),
    DATA_NASCIMENTO: `${ano}-${mes}-${dia}`,
    RG_NUMERO: p.rg,
    RG_ORGAO_EMISSOR: 'SSP',
    RG_UF: geo.uf,
    RG_DATA_EMISSAO: `${Number(ano) + 18}-01-01`,
    NATURALIDADE_UF: geo.uf,
    NATURALIDADE_MUNICIPIO: geo.codigoIbge,
    NOME_MAE: p.mae,
    NOME_PAI: p.pai,
    ESTADO_CIVIL: 'SOLTEIRO',
    SEXO: sexo,
    SEXO_CIVIL: sexo,
    IDENTIDADE_GENERO: 'PREFIRO_NAO_INFORMAR',
    ORIENTACAO_SEXUAL: 'PREFIRO_NAO_INFORMAR',
    EMAIL: `${p.email.split('@')[0]}@uniplus-test.local`,
    TELEFONE: p.celular,
    TIPO_ENDERECO: 'URBANO',
    ENDERECO_RESIDENCIAL: {
      cep: p.cep,
      logradouro: p.endereco,
      numero: String(p.numero),
      complemento: null,
      bairro: p.bairro,
      distrito: null,
      cidade: { codigoIbge: geo.codigoIbge, nome: geo.cidade, uf: geo.uf },
      latitude: null,
      longitude: null,
      nivelResolucao: null,
      origem: null,
    },
    COR_RACA: 'BRANCA',
    EDICAO_ENEM: '2025',
    FORMA_CONCLUSAO_EM: 'REGULAR',
    ONDE_CURSOU_EM: 'PRIVADA',
    SOLICITA_FATOR_ATENUACAO: false,
    PCD: comLaudo,
    ...(comLaudo ? { TIPO_DEFICIENCIA: 'AUDITIVA' } : {}),
    CONCORRER_PCD: comLaudo,
    CONCORRER_EP: false,
    INDIGENA: false,
    QUILOMBOLA: false,
    CONCORRER_PPI: false,
    CONCORRER_Q: false,
    BAIXA_RENDA: false,
    CONCORRER_RENDA: false,
    SOLICITA_ATENDIMENTO_ESPECIALIZADO: comLaudo,
    ...(comLaudo ? { CONDICAO_ATENDIMENTO: ['PCD'], RECURSO_ACESSIBILIDADE: ['TEMPO_ADICIONAL'] } : {}),
  };
}

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
          readonly arquivos?: readonly { readonly situacao: string }[];
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
): Promise<Rascunho & { situacao: string }> {
  const limite = Date.now() + 60_000;
  for (;;) {
    const rascunho = await json<Rascunho & { situacao: string }>(
      await fetch(base, { headers: cabecalho() }),
      200,
      'rascunho com o laudo',
    );
    const arquivos = rascunho.avaliacao.documentos.fases
      .flatMap((fase) => fase.documentos)
      .flatMap((documento) => documento.arquivos ?? []);
    if (arquivos.length >= enviados && arquivos.every((arquivo) => arquivo.situacao === 'verificado')) {
      return rascunho;
    }
    if (Date.now() > limite) {
      throw new Error('Os arquivos enviados não terminaram a verificação em 60 s.');
    }
    await new Promise((resolver) => setTimeout(resolver, 1_000));
  }
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
  const base = `${API_URL}/api/selecao/processos-seletivos/${processoId}/inscricao`;
  const cabecalho = (extra: Record<string, string> = {}) => ({
    authorization: `Bearer ${token}`,
    'idempotency-key': crypto.randomUUID(),
    accept: 'application/vnd.uniplus.inscricao.v1+json',
    ...extra,
  });

  let resposta = await fetch(base, { headers: cabecalho() });
  if (resposta.status === 404) {
    resposta = await fetch(base, { method: 'POST', headers: cabecalho() });
  }
  let rascunho = await json<Rascunho & { situacao: string }>(resposta, 200, `rascunho de ${username}`);
  if (rascunho.situacao !== 'rascunho') {
    return { username, inscricaoId: rascunho.id, cpf: p.cpf, rg: p.rg, nome: p.nome };
  }

  const formulario = await json<{ termos: { codigo: string; versaoId: string; hashVersao: string }[] }>(
    await fetch(`${API_URL}/api/selecao/processos-seletivos/${processoId}/formularios/INSCRICAO`),
    200,
    'formulário de inscrição',
  );
  const corpo = {
    ofertaCursoId: OFERTA_MEDICINA,
    ofertaCursoSegundaOpcaoId: null,
    respostas: await respostasDa(p, token, comLaudo),
    grupos: {},
    aceites: formulario.termos.map(({ codigo, versaoId, hashVersao }) => ({ codigo, versaoId, hashVersao })),
  };

  resposta = await fetch(base, {
    method: 'PUT',
    headers: cabecalho({ 'if-match': rascunho.eTag, 'content-type': 'application/json' }),
    body: JSON.stringify(corpo),
  });
  rascunho = await json<Rascunho & { situacao: string }>(resposta, 200, `respostas de ${username}`);

  if (comLaudo) {
    const exigencias = rascunho.avaliacao.documentos.fases
      .flatMap((fase) => fase.documentos)
      .filter((d) => d.tipoDocumentoCodigo.includes('LAUDO'));
    if (exigencias.length === 0) {
      throw new Error('O processo não pediu laudo a quem declarou deficiência.');
    }
    for (const exigencia of exigencias) {
      const envio = await json<{ arquivoId: string; urlUpload: string; contentTypeExigido: string }>(
        await fetch(`${base}/documentos/envios`, {
          method: 'POST',
          headers: cabecalho({ 'content-type': 'application/json' }),
          body: JSON.stringify({
            exigenciaId: exigencia.exigenciaId,
            ocorrenciaId: exigencia.ocorrenciaId,
            apresentacaoId: null,
            tipoDeMidia: 'application/pdf',
            tamanhoBytes: PDF_MINIMO.length,
          }),
        }),
        201,
        'iniciar o envio do laudo',
      );
      const subida = await fetch(envio.urlUpload, {
        method: 'PUT',
        headers: { 'content-type': envio.contentTypeExigido },
        body: PDF_MINIMO,
      });
      if (!subida.ok) {
        throw new Error(`Envio do laudo ao armazenamento: ${subida.status}`);
      }
      await json(
        await fetch(`${base}/documentos/envios/${envio.arquivoId}/confirmacao`, {
          method: 'POST',
          headers: cabecalho({ 'content-type': 'application/json' }),
          body: JSON.stringify({ etag: subida.headers.get('etag') ?? '' }),
        }),
        200,
        'confirmar o envio do laudo',
      );
    }
    rascunho = await aguardarVerificacaoDosArquivos(base, cabecalho, exigencias.length);
  }

  await json(
    await fetch(`${base}/submissao`, {
      method: 'POST',
      headers: cabecalho({
        'if-match': rascunho.eTag,
        'content-type': 'application/json',
        accept: 'application/vnd.uniplus.recibo-da-inscricao.v1+json',
      }),
      body: JSON.stringify(corpo),
    }),
    200,
    `submissão de ${username}`,
  );
  return { username, inscricaoId: rascunho.id, cpf: p.cpf, rg: p.rg, nome: p.nome };
}
