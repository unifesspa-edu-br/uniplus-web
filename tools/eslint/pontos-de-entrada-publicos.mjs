import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seletoresDoEspecificador } from './especificador-de-modulo.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../../libs');
const BARRA = String.raw`\x2f`;

function diretorios(caminho) {
  return readdirSync(caminho, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name);
}

function biblioteca(pasta) {
  const caminho = join(RAIZ, pasta);
  const pacote = join(caminho, 'package.json');
  if (!existsSync(pacote)) return null;
  const nome = JSON.parse(readFileSync(pacote, 'utf8')).name;
  const pastas = diretorios(caminho);
  const pontos = pastas.filter((item) => existsSync(join(caminho, item, 'ng-package.json')));
  const projetos = pastas.filter((item) => existsSync(join(caminho, item, 'project.json')));
  return pontos.length ? { nome, pontos, projetos } : null;
}

const bibliotecas = diretorios(RAIZ).map(biblioteca).filter(Boolean);
export const pontosDeEntradaPublicos = bibliotecas.flatMap(({ nome, pontos }) =>
  pontos.map((ponto) => `${nome}/${ponto}`),
);

function escapar(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('/', BARRA);
}

function expressoes({ nome, pontos, projetos }, somenteRaiz) {
  const raiz = escapar(nome);
  const ponto = `^${raiz}${BARRA}(?:.*${BARRA})?\\.{1,2}(?:${BARRA}|$)`;
  if (somenteRaiz) return [`/^${raiz}$/`, `/${ponto}/`];
  const permitidos = [
    ...pontos.map((item) => `${escapar(item)}$`),
    ...projetos.map((item) => `${escapar(item)}${BARRA}`),
  ].join('|');
  return [`/^${raiz}(?:$|${BARRA}(?!(?:${permitidos})).*)/`, `/${ponto}/`];
}

export function restricoesDePontosPublicos(somenteRaiz = false) {
  return bibliotecas.flatMap((lib) =>
    expressoes(lib, somenteRaiz).flatMap((expressao) =>
      seletoresDoEspecificador(expressao).map((selector) => ({
        selector,
        message: 'Importe um ponto de entrada público da biblioteca.',
      })),
    ),
  );
}
