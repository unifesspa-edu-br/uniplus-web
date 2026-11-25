import { createRequire } from 'node:module';
import { lerFolhaDeEstilo } from './folha-de-estilo.testing';

let glifosGuardados: ReadonlySet<string> | undefined;

export function glifosDoPrimeicons(): ReadonlySet<string> {
  if (glifosGuardados) return glifosGuardados;
  const glifos = new Set<string>();
  const caminho = createRequire(import.meta.url).resolve('primeicons/primeicons.css');
  lerFolhaDeEstilo(caminho).walkRules((regra) => {
    for (const seletor of regra.selectors) {
      if (seletor.startsWith('.pi-') && seletor.endsWith(':before')) {
        glifos.add(seletor.slice(1, -7));
      }
    }
  });
  glifosGuardados = glifos;
  return glifos;
}
