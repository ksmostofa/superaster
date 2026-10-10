#!/usr/bin/env python3
"""Loopback-only GET/HEAD server with an exact diagnostic-file allowlist."""
import argparse, http.server, pathlib, shutil, urllib.parse

ALLOWED = {
    '/full-browser.html':'text/html; charset=utf-8',
    '/full-browser.mjs':'text/javascript; charset=utf-8',
    '/full-browser-worker.mjs':'text/javascript; charset=utf-8',
    '/manifest.json':'application/json',
    '/model.onnx':'application/octet-stream',
    '/input.npy':'application/octet-stream',
    '/source-logits.npy':'application/octet-stream',
    '/native-logits.npy':'application/octet-stream',
    '/runtime/ort.wasm.min.mjs':'text/javascript; charset=utf-8',
    '/runtime/ort-wasm-simd-threaded.mjs':'text/javascript; charset=utf-8',
    '/runtime/ort-wasm-simd-threaded.wasm':'application/wasm',
}

def main():
    p=argparse.ArgumentParser();p.add_argument('--directory',type=pathlib.Path,required=True);p.add_argument('--port',type=int,default=5210);a=p.parse_args()
    directory=a.directory.resolve(strict=True)
    files={path:directory/path.lstrip('/') for path in ALLOWED}
    for file in files.values():
        if not file.is_file() or not file.resolve().is_relative_to(directory):raise ValueError('Stage the complete local allowlist first')
    class Handler(http.server.BaseHTTPRequestHandler):
        def serve(self,body):
            request=urllib.parse.urlsplit(self.path)
            if request.query or request.path not in files:
                self.send_error(404);return
            file=files[request.path]
            self.send_response(200)
            self.send_header('Content-Type',ALLOWED[request.path]);self.send_header('Content-Length',str(file.stat().st_size))
            self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
            self.send_header('Cross-Origin-Opener-Policy','same-origin');self.send_header('Cross-Origin-Embedder-Policy','require-corp')
            self.send_header('Content-Security-Policy',"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'")
            self.end_headers()
            if body:
                try:
                    with file.open('rb') as f:shutil.copyfileobj(f,self.wfile,64*1024)
                except (BrokenPipeError,ConnectionResetError):pass
        def do_GET(self):self.serve(True)
        def do_HEAD(self):self.serve(False)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',a.port),Handler)
    print(f'http://127.0.0.1:{a.port}/full-browser.html',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()

if __name__=='__main__': main()
