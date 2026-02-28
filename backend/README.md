# Bitcoin Mining Master 后端 API 服务

## package.json 字段说明

- **name**：项目名称。
- **version**：项目版本号。
- **description**：项目描述。
- **main**：项目入口文件。
- **scripts**：常用命令。
  - `start`：启动服务（node src/index.js）。
  - `dev`：开发模式自动重启（nodemon src/index.js）。
- **keywords**：项目关键词，便于检索。
- **author**：作者信息。
- **license**：许可证类型。
- **dependencies**：项目运行所需依赖。
  - `express`：Web 服务框架。
  - `sequelize`：ORM 数据库操作工具。
  - `mysql2`：MySQL 数据库驱动。
  - `dotenv`：环境变量管理工具。
- **devDependencies**：开发环境依赖。
  - `nodemon`：自动重启 Node.js 服务工具。

## 使用说明
1. 安装依赖：`npm install`
2. 启动服务：`npm start` 或开发模式 `npm run dev`
3. 配置数据库连接请修改 `src/config/database.js`
4. 业务逻辑和 API 路由请参考 `src/controllers` 和 `src/routes` 目录
