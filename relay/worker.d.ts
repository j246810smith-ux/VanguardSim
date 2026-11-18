/** Types for relay/worker.js (a Cloudflare Worker), for the tests. */
declare const worker: {
  fetch(request: Request, env: Record<string, string | undefined>): Promise<Response>;
};
export default worker;
