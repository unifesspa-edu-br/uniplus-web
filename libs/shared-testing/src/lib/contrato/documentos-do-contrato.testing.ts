import { Document, OpenAPIBackend } from 'openapi-backend';
import addFormats from 'ajv-formats';

const carregadores = {
  organizacao: () => import('@uniplus/shared-data/openapi/organizacao.openapi.json'),
  publicacoes: () => import('@uniplus/shared-data/openapi/publicacoes.openapi.json'),
  portal: () => import('@uniplus/shared-data/openapi/portal.openapi.json'),
};
type Modulo = keyof typeof carregadores;
const contratos = new Map<Modulo, Promise<OpenAPIBackend>>();

class OpenAPIBackendComDocumentoEmMemoria extends OpenAPIBackend {
  override loadDocument(): Promise<Document> {
    // No modo quick a biblioteca desreferencia o documento de forma síncrona e não usa o
    // resultado de loadDocument; a importação dinâmica que ele faz é recusada no pool
    // vmThreads do Vitest e reprovaria a execução.
    return Promise.resolve(this.inputDocument as Document);
  }
}

export function moduloDoCaminho(caminho: string): Modulo | undefined {
  const partes = new URL(caminho, 'http://localhost').pathname.split('/');
  const modulo = partes[1] === 'api' ? partes[2] : undefined;
  return modulo && Object.hasOwn(carregadores, modulo) ? (modulo as Modulo) : undefined;
}

export async function criarConferidor(documento: Document): Promise<OpenAPIBackend> {
  const conferidor = new OpenAPIBackendComDocumentoEmMemoria({
    definition: documento,
    quick: true,
    strict: false,
    customizeAjv: (ajv) => addFormats(ajv),
  });
  await conferidor.init();
  return conferidor;
}

export function contratoDoCaminho(caminho: string): Promise<OpenAPIBackend> | undefined {
  const modulo = moduloDoCaminho(caminho);
  if (!modulo) return undefined;
  let contrato = contratos.get(modulo);
  if (!contrato) {
    contrato = carregadores[modulo]().then(({ default: documento }) =>
      criarConferidor(documento as Document),
    );
    contratos.set(modulo, contrato);
  }
  return contrato;
}
