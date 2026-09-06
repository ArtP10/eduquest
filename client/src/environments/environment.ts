// Local dev default. Swapped for environment.prod.ts on a production build
// via the `fileReplacements` entry in angular.json — see that file's
// `production` configuration. This is the ONE place the backend's URL is
// defined; every service imports `environment.apiUrl` instead of hardcoding
// it (previously duplicated as a literal in three separate services).
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000'
};
