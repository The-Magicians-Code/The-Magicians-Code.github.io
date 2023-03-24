# #!/usr/bin/env bash
docker build -t nginx_server . -f Dockerfile
docker run --rm -i -d -v $(pwd):/usr/share/nginx/html -p 8080:80 --name localpage nginx_server