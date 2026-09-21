#!/bin/zsh
cd -- "$(dirname -- "$0")"
python3 - <<'PY'
import http.server, socketserver, pathlib, threading, webbrowser, functools
root=pathlib.Path.cwd()/'dist'
if not (root/'index.html').exists():
    raise SystemExit('没有找到 dist/index.html，请先运行 npm run build。')
handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root))
server=None
for port in range(4187,4208):
    try:
        server=socketserver.TCPServer(('127.0.0.1',port),handler)
        break
    except OSError:
        continue
if server is None:
    raise SystemExit('端口 4187–4207 正在使用，请关闭旧预览后重试。')
url=f'http://127.0.0.1:{port}/'
print('\n潮汐守卫已启动：'+url+'\n保持此窗口开启，按 Control+C 退出。\n')
threading.Timer(.5,lambda:webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    print('\n海岸休息了。下次见！')
finally:
    server.server_close()
PY
