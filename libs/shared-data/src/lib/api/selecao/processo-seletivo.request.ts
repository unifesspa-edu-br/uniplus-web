import { HttpResourceRequest } from '@angular/common/http';
import { withVendorMime } from '@uniplus/shared-core/http';
import { rotasDoProcesso } from './rotas-do-processo';

export function processoSeletivoRequest(basePath: string, id: string): HttpResourceRequest {
  return {
    url: rotasDoProcesso(basePath).doProcesso(id),
    context: withVendorMime('processo-seletivo', 1),
  };
}
