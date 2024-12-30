# Paper Collection Chrome Extension

这是一个用于收藏和管理学术论文的Chrome扩展。

## 功能特点

- 自动提取论文信息（标题、作者、摘要）
- 支持手动编辑提取的信息
- 添加个人评论
- 标记论文状态：
  - "Needs Improvement"（需要改进理解）
  - "Has GitHub"（有GitHub仓库）
- 高级搜索功能：
  - 支持按标题、作者、摘要、评论搜索
  - 可选择搜索范围
  - 支持筛选需要改进的论文
  - 支持筛选有GitHub仓库的论文
- 论文列表功能：
  - 显示添加时间
  - 显示最后编辑时间
  - 支持展开/收起摘要
  - 支持快速编辑评论
  - 支持删除论文
- 导出功能：
  - 支持导出为Excel（CSV格式）
  - 导出包含所有论文信息和标记
- 分享功能：
  - 支持以文本格式分享（复制到剪贴板）
  - 支持以图片格式分享（复制到剪贴板或下载）
  - 分享内容包括：
    - 论文标题
    - 作者信息
    - 个人评论
    - 标记状态（需要改进/有GitHub仓库）
    - 论文链接
    - 时间信息

## 支持的网站

- 已支持的网站：
  - arXiv
  - Google Scholar
  - IEEE Xplore
- 待支持的网站：
  - ACM Digital Library
  - ScienceDirect
  - Springer
  - OpenReview

## 安装说明

1. 下载或克隆此仓库到本地
2. 打开Chrome浏览器，进入扩展管理页面（chrome://extensions/）
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本仓库的目录

## 使用方法

1. 在支持的学术网站的摘要页面上浏览论文时，点击扩展图标
2. 扩展会自动提取论文信息
3. 如果需要，可以：
   - 手动编辑提取的信息
   - 添加评论
   - 标记为"需要改进理解"
   - 标记是否有GitHub仓库
4. 点击"Save Paper"保存
5. 在已保存的论文列表中：
   - 使用搜索框和筛选器查找论文
   - 展开/收起摘要
   - 编辑评论
   - 删除论文
   - 分享论文（文本或图片格式）
6. 需要导出时，点击"Export to Excel"按钮

## 分享功能说明

1. 文本分享：
   - 点击论文条目中的"Share"按钮
   - 选择"Copy as Text"
   - 文本会被复制到剪贴板，包含论文的关键信息
   - 支持中英文混排

2. 图片分享：
   - 点击论文条目中的"Share"按钮
   - 选择"Copy as Image"
   - 自动生成包含论文信息的图片
   - 优先尝试复制到剪贴板
   - 如果复制失败，会自动下载为PNG文件

## 注意事项

- 论文信息存储在本地，不会上传到任何服务器
- 如果自动提取失败，你可以手动编辑信息
- 建议定期导出数据进行备份
- 相同标题或URL的论文会被视为重复，系统会提示并突出显示已存在的条目
- 分享功能支持长文本自动换行，确保内容完整显示 