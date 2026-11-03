#!/usr/bin/env node
// Verifica o limite de linhas físicas por arquivo de produção.
// Uso: node tools/tamanho-de-arquivo/verificar.mjs [--atualizar] [--raiz=<dir>]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIMITE = 400;
const EXTENSOES = ['.ts', '.html', '.css'];
const PASTAS_RAIZ = ['apps', 'libs'];
const PASTAS_IGNORADAS = new Set(['node_modules', 'dist', '.angular', 'testing']);

const argumentos = process.argv.slice(2);
const atualizar = argumentos.includes('--atualizar');
const raizArg = argumentos.find((a) => a.startsWith('--raiz='));
const raiz = raizArg
  ? raizArg.slice('--raiz='.length)
  : join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arquivoDeExcecoes = join(raiz, 'tools', 'tamanho-de-arquivo', 'excecoes.txt');

// Só o caminho decide o que é gerado: um marcador no conteúdo deixaria arquivo escrito à mão escapar da regra.
const ehCodigoGerado = (caminho) =>
  /^libs\/shared-data\/src\/lib\/api\/[^/]+\/schema\.ts$/.test(caminho);

const ehTeste = (caminho) =>
  /\.spec\.ts$/.test(caminho) ||
  /\.mock\.ts$/.test(caminho) ||
  /\.testing\.ts$/.test(caminho) ||
  /(^|\/)test-setup\.ts$/.test(caminho) ||
  /^apps\/[^/]+-e2e\//.test(caminho) ||
  caminho.startsWith('libs/shared-e2e/');

const caminhar = (pasta, acumulado) => {
  for (const entrada of readdirSync(join(raiz, pasta), { withFileTypes: true })) {
    const caminho = `${pasta}/${entrada.name}`;
    if (entrada.isDirectory()) {
      if (!PASTAS_IGNORADAS.has(entrada.name)) caminhar(caminho, acumulado);
    } else if (entrada.isFile() && EXTENSOES.some((e) => entrada.name.endsWith(e))) {
      acumulado.push(caminho);
    }
  }
  return acumulado;
};

const contarLinhas = (caminho) => {
  const texto = readFileSync(join(raiz, caminho), 'utf8');
  if (texto.length === 0) return 0;
  const quebras = texto.split('\n').length - 1;
  return texto.endsWith('\n') ? quebras : quebras + 1;
};

const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const lerExcecoes = () => {
  const cabecalho = [];
  const entradas = new Map();
  if (!existsSync(arquivoDeExcecoes)) return { cabecalho, entradas };
  for (const linha of readFileSync(arquivoDeExcecoes, 'utf8').split('\n')) {
    if (linha.startsWith('#')) cabecalho.push(linha);
    else if (linha.trim()) {
      const [numero, ...resto] = linha.trim().split(/\s+/);
      entradas.set(resto.join(' '), Number(numero));
    }
  }
  return { cabecalho, entradas };
};

const escreverExcecoes = ({ cabecalho, entradas }) => {
  const corpo = [...entradas.keys()].sort(comparar).map((c) => `${entradas.get(c)} ${c}`);
  writeFileSync(arquivoDeExcecoes, [...cabecalho, ...corpo].join('\n') + '\n');
};

const arquivos = PASTAS_RAIZ.flatMap((p) => (existsSync(join(raiz, p)) ? caminhar(p, []) : []))
  .map((c) => c.split(sep).join('/'))
  .filter((c) => !ehTeste(c) && !ehCodigoGerado(c))
  .sort(comparar);
const linhasPorArquivo = new Map(arquivos.map((c) => [c, contarLinhas(c)]));

const excecoes = lerExcecoes();

if (atualizar) {
  let alterou = false;
  for (const [caminho, registrado] of [...excecoes.entradas]) {
    const atual = linhasPorArquivo.get(caminho);
    if (atual === undefined || atual <= LIMITE) {
      excecoes.entradas.delete(caminho);
      alterou = true;
    } else if (atual < registrado) {
      excecoes.entradas.set(caminho, atual);
      alterou = true;
    }
  }
  if (alterou) {
    escreverExcecoes(excecoes);
    console.log('Lista de exceções atualizada (só diminuiu).');
  }
}

const novos = [];
const cresceram = [];
const encolheram = [];
const resolvidos = [];
for (const [caminho, linhas] of linhasPorArquivo) {
  const registrado = excecoes.entradas.get(caminho);
  if (registrado === undefined) {
    if (linhas > LIMITE) novos.push(`${linhas} ${caminho}`);
  } else if (linhas > registrado) {
    cresceram.push(`${caminho}: ${linhas} linhas, registrado ${registrado}`);
  } else if (linhas <= LIMITE) {
    resolvidos.push(`${caminho}: ${linhas} linhas`);
  } else if (linhas < registrado) {
    encolheram.push(`${caminho}: ${linhas} linhas, registrado ${registrado}`);
  }
}
for (const caminho of excecoes.entradas.keys()) {
  if (!linhasPorArquivo.has(caminho))
    resolvidos.push(`${caminho}: arquivo inexistente ou fora do escopo`);
}

const secao = (titulo, itens) => {
  if (itens.length === 0) return;
  console.error(`\n${titulo}`);
  for (const item of itens) console.error(`  ${item}`);
};

secao(`Arquivos acima de ${LIMITE} linhas e fora da lista de exceções (divida o arquivo):`, novos);
secao('Arquivos da lista que cresceram além do registrado (a lista só diminui):', cresceram);
secao(
  'Arquivos da lista que encolheram (registre o número novo com --atualizar, senão a folga permite crescer de novo):',
  encolheram,
);
secao(
  'Arquivos da lista que já cumprem o limite ou sumiram (tire-os de tools/tamanho-de-arquivo/excecoes.txt, ou rode com --atualizar):',
  resolvidos,
);

if (novos.length + cresceram.length + encolheram.length + resolvidos.length > 0) {
  console.error(`\nFalha: limite de ${LIMITE} linhas por arquivo violado.`);
  process.exit(1);
}
console.log(
  `OK: ${linhasPorArquivo.size} arquivos verificados, nenhum acima de ${LIMITE} linhas fora da lista (${excecoes.entradas.size} exceções).`,
);
