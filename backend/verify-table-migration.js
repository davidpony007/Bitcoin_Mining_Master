/**
 * 验证表合并后的代码引用
 */

const fs = require('fs');
const path = require('path');

function searchFilesRecursively(directory, pattern, results = []) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 跳过 node_modules, .git 等目录
      if (!['node_modules', '.git', 'build', 'dist'].includes(file)) {
        searchFilesRecursively(filePath, pattern, results);
      }
    } else if (file.endsWith('.js') || file.endsWith('.sql')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          results.push({
            file: filePath.replace(process.cwd(), '.'),
            line: index + 1,
            content: line.trim()
          });
        }
      });
    }
  }
  
  return results;
}

console.log('🔍 检查代码中 check_in_record 表的引用...\n');

const backendDir = path.join(__dirname, 'src');
const checkInRecordPattern = /check_in_record/i;

const results = searchFilesRecursively(backendDir, checkInRecordPattern);

if (results.length === 0) {
  console.log('✅ 没有发现 check_in_record 表引用！\n');
  console.log('🎉 代码迁移完成！');
} else {
  console.log(`⚠️  发现 ${results.length} 处 check_in_record 引用:\n`);
  
  results.forEach(result => {
    console.log(`📄 ${result.file}:${result.line}`);
    console.log(`   ${result.content}\n`);
  });
  
  console.log('❌ 请修复以上引用');
}

// 检查 user_check_in 表的使用
console.log('\n🔍 检查 user_check_in 表的使用情况...\n');

const userCheckInPattern = /user_check_in/i;
const userCheckInResults = searchFilesRecursively(backendDir, userCheckInPattern);

console.log(`✅ 发现 ${userCheckInResults.length} 处 user_check_in 表引用\n`);

const fileGroups = {};
userCheckInResults.forEach(result => {
  const fileName = path.basename(result.file);
  if (!fileGroups[fileName]) {
    fileGroups[fileName] = 0;
  }
  fileGroups[fileName]++;
});

console.log('📊 按文件统计:');
Object.entries(fileGroups).forEach(([file, count]) => {
  console.log(`   ${file}: ${count} 处引用`);
});
