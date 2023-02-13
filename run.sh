docker build -t some-content-nginx .
docker run --name web-container --rm -d -p 8080:80 some-content-nginx