# Dockerfile for Production
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production && npm cache clean --force

# 复制源码
COPY . .

# 生产镜像
FROM node:20-alpine

WORKDIR /app

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# 从builder复制
COPY --from=builder --chown=nodejs:nodejs /app .

# 切换到非root用户
USER nodejs

# 暴露端口
EXPOSE 8888

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8888/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["node", "src/index.js"]
