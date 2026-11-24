export const pageSession={current:null,calls:[]};
export async function requireAppAccess(app,path){pageSession.calls.push({app,path});if(!pageSession.current)throw new Error('AUTH_REQUIRED');return pageSession.current;}
export function redirect(path){throw new Error(`REDIRECT:${path}`);}
