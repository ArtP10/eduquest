// Deployed backend URL. Swapped in for environment.ts on `ng build`
// (production is the default configuration) via angular.json's
// `fileReplacements`. This is a public URL, not a secret.
//
// Use the service's PUBLIC https domain with NO port — Railway maps 443 on
// the public domain to the container's internal port (8080). The
// *.railway.internal address is server-to-server only and unreachable from
// the browser.
export const environment = {
  production: true,
  apiUrl: 'https://eduquest-production-02fc.up.railway.app'
};
