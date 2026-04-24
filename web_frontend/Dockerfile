# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖清单，利用 Docker 层缓存
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# 复制全部源码并构建（跳过 tsc 类型检查，直接用 vite 构建）
COPY . .
RUN npx vite build

# ─── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:1.25-alpine

# 删除默认配置，使用自定义 SPA 配置
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制静态产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
