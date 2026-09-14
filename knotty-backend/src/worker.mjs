import app from './app.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    return new Promise((resolve) => {
      let statusCode = 200;
      const responseHeaders = new Headers();

      const res = {
        statusCode: 200,
        status(code) { statusCode = code; return this; },
        setHeader(k, v) { responseHeaders.set(k, v); return this; },
        getHeader(k) { return responseHeaders.get(k); },
        json(obj) {
          responseHeaders.set('content-type', 'application/json');
          resolve(new Response(JSON.stringify(obj), { status: statusCode, headers: responseHeaders }));
        },
        send(data) {
          if (typeof data === 'object') {
            responseHeaders.set('content-type', 'application/json');
            data = JSON.stringify(data);
          }
          resolve(new Response(data, { status: statusCode, headers: responseHeaders }));
        },
        end(data) {
          resolve(new Response(data || '', { status: statusCode, headers: responseHeaders }));
        }
      };

      try {
        app(request, res, (err) => {
          if (err) {
            resolve(new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 }));
          } else {
            resolve(new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404 }));
          }
        });
      } catch (err) {
        resolve(new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 }));
      }
    });
  }
};
