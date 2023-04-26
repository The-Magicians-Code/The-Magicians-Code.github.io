FROM nginx
# COPY . /usr/share/nginx/html
# Create symlink for nginx
RUN ln -s /etc/nginx/nginx.conf