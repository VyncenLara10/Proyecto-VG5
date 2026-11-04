# ---------- Etapa 1: compilar con Vite ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Vacío = el navegador llama a /products, /health y /metrics en su propio origen (nginx los reenvía)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------- Etapa 2: servir con nginx ----------
FROM nginx:1.27-alpine
# nginx reemplaza ${API_UPSTREAM} al arrancar (viene de la imagen oficial)
ENV API_UPSTREAM=http://api:8000
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
