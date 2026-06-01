FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config as a template — BACKEND_HOST is substituted at container start
COPY nginx.conf /etc/nginx/nginx.conf.template

EXPOSE 80

# envsubst replaces only ${BACKEND_HOST}, leaving nginx variables like $uri untouched
CMD ["/bin/sh", "-c", \
  "envsubst '${BACKEND_HOST}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
