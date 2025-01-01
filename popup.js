document.addEventListener('DOMContentLoaded', function() {
  const titleInput = document.getElementById('title');
  const authorsInput = document.getElementById('authors');
  const abstractInput = document.getElementById('abstract');
  const commentInput = document.getElementById('comment');
  const saveButton = document.getElementById('savePaper');
  const searchInput = document.getElementById('searchInput');
  const paperList = document.getElementById('paperList');
  const exportButton = document.getElementById('exportExcel');
  const editFieldsButton = document.getElementById('editFields');
  const needsImprovementCheckbox = document.getElementById('needsImprovement');
  const filterNeedsImprovementCheckbox = document.getElementById('filterNeedsImprovement');
  const filterHasGithubCheckbox = document.getElementById('filterHasGithub');
  const searchTitleCheckbox = document.getElementById('searchTitle');
  const searchAuthorsCheckbox = document.getElementById('searchAuthors');
  const searchAbstractCheckbox = document.getElementById('searchAbstract');
  const searchCommentsCheckbox = document.getElementById('searchComments');
  const hasGithubCheckbox = document.getElementById('hasGithub');
  const importButton = document.getElementById('importExcel');
  const importFileInput = document.getElementById('importFile');

  // 导入功能
  importButton.addEventListener('click', function() {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const csvContent = e.target.result;
        const parseResult = await parseCsvContent(csvContent);
        if (parseResult.papers.length > 0 || parseResult.failedImports.length > 0) {
          const result = await importPapers(parseResult.papers);
          
          // 清空文件输入，允许重复导入相同文件
          importFileInput.value = '';
          
          // 更新论文列表显示
          updatePaperList();
          
          // 显示导入结果提示
          const notification = document.getElementById('notification');
          let messages = [];
          
          // 成功导入的数量
          if (result.importCount > 0) {
            messages.push(`Successfully imported ${result.importCount} papers`);
          }
          
          // 重复的数量
          if (result.duplicateCount > 0) {
            messages.push(`Skipped ${result.duplicateCount} duplicate papers`);
          }
          
          // 导入失败的详细信息
          if (parseResult.failedImports.length > 0) {
            messages.push(`Failed to import ${parseResult.failedImports.length} papers:`);
            parseResult.failedImports.forEach(failure => {
              const lineInfo = `Line ${failure.line}${failure.title ? ` (${failure.title})` : ''}: ${failure.reason}`;
              messages.push(lineInfo);
            });
          }
          
          notification.innerHTML = messages.join('<br>');
          notification.classList.add('show');
          setTimeout(() => notification.classList.remove('show'), 8000);
        }
      } catch (error) {
        alert(error.message);
      }
    };
    reader.readAsText(file);
  });

  // 解析CSV内容
  async function parseCsvContent(csvContent) {
    // 将CSV内容按行分割
    const lines = csvContent.split(/\r\n|\n/);
    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid');
    }

    // 解析表头
    const headers = parseCSVLine(lines[0]);
    
    // 检查必需的字段
    const requiredFields = ['Title', 'Authors', 'URL', 'Abstract'];
    const missingFields = requiredFields.filter(field => !headers.includes(field));
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields in CSV header: ${missingFields.join(', ')}`);
    }

    // 解析数据行
    const papers = [];
    const failedImports = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // 跳过空行
      
      const values = parseCSVLine(lines[i]);
      if (values.length !== headers.length) {
        failedImports.push({
          line: i + 1,
          reason: 'Column count mismatch'
        });
        continue;
      }

      // 创建论文对象
      const paper = {};
      headers.forEach((header, index) => {
        // 处理特殊字段名
        let fieldName = header.toLowerCase().replace(/\s+/g, '');
        if (header === 'Needs Improvement') {
          fieldName = 'needsImprovement';
        } else if (header === 'Has GitHub') {
          fieldName = 'hasGithub';
        }
        paper[fieldName] = values[index];
      });

      // 检查必需字段
      const missingRequiredFields = [];
      if (!paper.title) missingRequiredFields.push('Title');
      if (!paper.authors) missingRequiredFields.push('Authors');
      if (!paper.url) missingRequiredFields.push('URL');
      if (!paper.abstract) missingRequiredFields.push('Abstract');

      if (missingRequiredFields.length > 0) {
        failedImports.push({
          line: i + 1,
          title: paper.title || '[No Title]',
          reason: `Missing required fields: ${missingRequiredFields.join(', ')}`
        });
        continue;
      }

      // 添加时间戳
      paper.timestamp = paper.timestamp || new Date().toISOString();
      
      // 处理布尔值字段
      paper.needsImprovement = paper.needsImprovement === 'Yes' || paper.needsImprovement === 'true' || paper.needsImprovement === 'TRUE' || paper.needsImprovement === '1';
      paper.hasGithub = paper.hasGithub === 'Yes' || paper.hasGithub === 'true' || paper.hasGithub === 'TRUE' || paper.hasGithub === '1';

      papers.push(paper);
    }

    return {
      papers,
      failedImports
    };
  }

  // 解析CSV行，处理引号包裹的字段
  function parseCSVLine(line) {
    const values = [];
    let currentValue = '';
    let isInsideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (isInsideQuotes && line[i + 1] === '"') {
          // 处理双引号转义
          currentValue += '"';
          i++;
        } else {
          // 切换引号状态
          isInsideQuotes = !isInsideQuotes;
        }
      } else if (char === ',' && !isInsideQuotes) {
        // 字段结束
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    // 添加最后一个字段
    values.push(currentValue.trim());
    
    return values;
  }

  // 导入论文到存储
  async function importPapers(newPapers) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['papers'], function(result) {
        const existingPapers = result.papers || [];
        
        // 检查并合并论文
        const mergedPapers = [...existingPapers];
        let importCount = 0;
        let duplicateCount = 0;
        const duplicateDetails = [];
        
        newPapers.forEach(newPaper => {
          // 检查是否已存在（通过标题匹配，不区分大小写）
          const existingPaper = existingPapers.find(paper => 
            paper.title.toLowerCase() === newPaper.title.toLowerCase()
          );
          
          if (existingPaper) {
            duplicateCount++;
            duplicateDetails.push({
              title: newPaper.title,
              existingDate: formatDate(existingPaper.timestamp),
              newDate: formatDate(newPaper.timestamp || new Date().toISOString())
            });
          } else {
            mergedPapers.push(newPaper);
            importCount++;
          }
        });

        // 保存合并后的论文列表
        chrome.storage.local.set({papers: mergedPapers}, function() {
          // 返回导入结果
          resolve({
            importCount,
            duplicateCount,
            duplicateDetails
          });
        });
      });
    });
  }

  let editingPaperIndex = -1;
  let fieldsEditable = false;

  // 切换字段可编辑状态
  function toggleFieldsEditable(editable) {
    fieldsEditable = editable;
    titleInput.readOnly = !editable;
    authorsInput.readOnly = !editable;
    abstractInput.readOnly = !editable;
    editFieldsButton.textContent = editable ? 'Done' : 'Edit';
    editFieldsButton.style.backgroundColor = editable ? '#4CAF50' : '#757575';

    // 如果切换到编辑模式，清空空字段
    if (editable) {
      if (!titleInput.value.trim()) titleInput.value = '';
      if (!authorsInput.value.trim()) authorsInput.value = '';
      if (!abstractInput.value.trim()) abstractInput.value = '';
    }
  }

  // 编辑按钮事件
  editFieldsButton.addEventListener('click', function() {
    toggleFieldsEditable(!fieldsEditable);
  });

  // 格式化日期
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 导出Excel功能
  function exportToExcel(papers) {
    // 准备Excel数据
    const excelData = papers.map(paper => ({
      'Title': escapeCsvField(paper.title),
      'Authors': escapeCsvField(paper.authors),
      'Abstract': escapeCsvField(paper.abstract),
      'Comment': escapeCsvField(paper.comment || ''),
      'URL': escapeCsvField(paper.url),
      'Added Date': escapeCsvField(formatDate(paper.timestamp)),
      'Last Edited': escapeCsvField(paper.lastEdited ? formatDate(paper.lastEdited) : ''),
      'Needs Improvement': paper.needsImprovement ? 'Yes' : 'No',
      'Has GitHub': paper.hasGithub ? 'Yes' : 'No'
    }));

    // 创建CSV内容
    const headers = Object.keys(excelData[0]);
    const csvContent = [
      headers.join(','),
      ...excelData.map(row => 
        headers.map(header => row[header]).join(',')
      )
    ].join('\n');

    // 创建Blob对象
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // 创建下载链接
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `paper-collection-${timestamp}.csv`);
    document.body.appendChild(link);

    // 触发下载
    link.click();

    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // 辅助函数：处理CSV字段，确保包含逗号、换行符等特殊字符的内容被正确处理
  function escapeCsvField(field) {
    if (field === null || field === undefined) {
      return '';
    }
    
    field = field.toString();
    
    // 如果字段包含逗号、双引号或换行符，需要进行特殊处理
    if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
      // 将字段中的双引号替换为两个双引号
      field = field.replace(/"/g, '""');
      // 用双引号包裹整个字段
      return `"${field}"`;
    }
    
    return field;
  }

  // 获取当前筛选后的论文列表
  function getFilteredPapers(papers) {
    const searchTerm = searchInput.value.toLowerCase();
    
    // 首先应用"待完善理解"过滤器
    let filteredPapers = papers;
    if (filterNeedsImprovementCheckbox.checked) {
      filteredPapers = papers.filter(paper => paper.needsImprovement);
    }

    // 然后应用搜索词过滤器
    if (searchTerm) {
      filteredPapers = filteredPapers.filter(paper => {
        const matchConditions = [];
        if (searchTitleCheckbox.checked) {
          matchConditions.push(paper.title.toLowerCase().includes(searchTerm));
        }
        if (searchAuthorsCheckbox.checked) {
          matchConditions.push(paper.authors.toLowerCase().includes(searchTerm));
        }
        if (searchAbstractCheckbox.checked) {
          matchConditions.push(paper.abstract.toLowerCase().includes(searchTerm));
        }
        if (searchCommentsCheckbox.checked) {
          matchConditions.push(paper.comment?.toLowerCase().includes(searchTerm));
        }
        return matchConditions.some(condition => condition);
      });
    }

    // 按时间戳倒序排序
    return filteredPapers.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // 添加导出按钮事件监听
  exportButton.addEventListener('click', function() {
    chrome.storage.local.get(['papers'], function(result) {
      const papers = result.papers || [];
      if (papers.length > 0) {
        const filteredPapers = getFilteredPapers(papers);
        if (filteredPapers.length > 0) {
          exportToExcel(filteredPapers);
        } else {
          alert('No papers match the current filter criteria.');
        }
      }
    });
  });

  // 检查论文是否已经存在
  function findExistingPaper(title, url) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['papers'], function(result) {
        const papers = result.papers || [];
        const existingPaper = papers.find(paper => 
          (paper.title.toLowerCase() === title.toLowerCase()) || 
          (paper.url === url)
        );
        resolve(existingPaper);
      });
    });
  }

  // Load current page data
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: "getPaperInfo"}, async function(response) {
      if (response) {
        const currentUrl = tabs[0].url;
        const existingPaper = await findExistingPaper(response.title || '', currentUrl);

        if (existingPaper) {
          // 如果找到已存在的论文，加载其数据
          titleInput.value = existingPaper.title;
          authorsInput.value = existingPaper.authors;
          abstractInput.value = existingPaper.abstract;
          commentInput.value = existingPaper.comment || '';
          needsImprovementCheckbox.checked = existingPaper.needsImprovement || false;
          hasGithubCheckbox.checked = existingPaper.hasGithub || false;
          
          // 设置编辑模式
          editingPaperIndex = (await chrome.storage.local.get(['papers'])).papers.findIndex(
            p => p.timestamp === existingPaper.timestamp
          );
          saveButton.textContent = 'Update';
        } else {
          // 如果是新论文，使用提取的数据
          titleInput.value = response.title || '';
          authorsInput.value = response.authors || '';
          abstractInput.value = response.abstract || '';
          
          // 如果没有提取到任何信息，自动切换到编辑模式
          if (!response.title && !response.authors && !response.abstract) {
            toggleFieldsEditable(true);
          }
        }
      } else {
        // 如果提取失败，自动切换到编辑模式
        toggleFieldsEditable(true);
      }
    });
  });

  // Save paper
  saveButton.addEventListener('click', function() {
    // 验证必填字段
    if (!titleInput.value.trim()) {
      alert('Please enter a title');
      titleInput.focus();
      return;
    }

    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
      const paperData = {
        title: titleInput.value.trim(),
        authors: authorsInput.value.trim(),
        abstract: abstractInput.value.trim(),
        comment: commentInput.value.trim(),
        url: tabs[0].url,
        timestamp: new Date().toISOString(),
        needsImprovement: needsImprovementCheckbox.checked,
        hasGithub: hasGithubCheckbox.checked
      };

      // 只在非编辑模式下检查重复
      if (editingPaperIndex === -1) {
        // 检查是否已存在
        const existingPaper = await findExistingPaper(paperData.title, paperData.url);
        if (existingPaper) {
          // 显示提示信息
          const notification = document.getElementById('notification');
          notification.textContent = '该论文已添加过';
          notification.classList.add('show');
          setTimeout(() => notification.classList.remove('show'), 5000);

          // 更新列表并滚动到已存在的论文
          await updatePaperList();
          const existingElement = Array.from(paperList.children)
            .find(el => el.querySelector('strong').textContent === existingPaper.title);
          
          if (existingElement) {
            // 滚动到元素位置
            existingElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 添加高亮效果
            existingElement.style.backgroundColor = '#fff3cd';
            setTimeout(() => {
              existingElement.style.backgroundColor = '';
              // 使用 CSS transition 实现平滑过渡
              existingElement.style.transition = 'background-color 0.5s ease-out';
            }, 2000);
          }
          return;
        }
      }

      chrome.storage.local.get(['papers'], function(result) {
        let papers = result.papers || [];
        
        if (editingPaperIndex >= 0) {
          // 更新现有论文
          papers[editingPaperIndex] = {
            ...papers[editingPaperIndex],
            title: titleInput.value.trim(),
            authors: authorsInput.value.trim(),
            abstract: abstractInput.value.trim(),
            comment: commentInput.value.trim(),
            needsImprovement: needsImprovementCheckbox.checked,
            hasGithub: hasGithubCheckbox.checked,
            lastEdited: new Date().toISOString()
          };
          editingPaperIndex = -1;
          saveButton.textContent = 'Save Paper';
        } else {
          // 添加新论文
          papers.push(paperData);
        }

        chrome.storage.local.set({papers: papers}, function() {
          commentInput.value = '';
          needsImprovementCheckbox.checked = false;
          hasGithubCheckbox.checked = false;
          // 保存后重置编辑状态
          toggleFieldsEditable(false);
          updatePaperList();
        });
      });
    });
  });

  // Search papers
  searchInput.addEventListener('input', function() {
    updatePaperList();
  });

  // 添加搜索选项和过滤器的事件监听
  [filterNeedsImprovementCheckbox, filterHasGithubCheckbox, searchTitleCheckbox, 
   searchAuthorsCheckbox, searchAbstractCheckbox, searchCommentsCheckbox].forEach(checkbox => {
    checkbox.addEventListener('change', updatePaperList);
  });

  // 分享功能相关变量
  const shareModal = document.getElementById('shareModal');
  const shareCardText = document.getElementById('shareCardText');
  const shareCanvas = document.getElementById('shareCanvas');
  const closeShareButton = document.querySelector('.share-card-close');
  const copyButtons = document.querySelectorAll('.copy-button');

  // 关闭分享模态框
  closeShareButton.addEventListener('click', function() {
    shareModal.classList.remove('show');
  });

  // 点击模态框外部关闭
  shareModal.addEventListener('click', function(e) {
    if (e.target === shareModal) {
      shareModal.classList.remove('show');
    }
  });

  // 生成分享文本
  function generateShareText(paper) {
    return `📄 ${paper.title}

👥 Authors: ${paper.authors}

${paper.comment ? `💭 Comment:
${paper.comment}

` : ''}${paper.needsImprovement ? '⚠️ Needs Improvement in Understanding\n' : ''}${paper.hasGithub ? '💻 Has GitHub Repository\n' : ''}
🔗 Link: ${paper.url}

Added: ${formatDate(paper.timestamp)}${paper.lastEdited ? `
Last Edited: ${formatDate(paper.lastEdited)}` : ''}`;
  }

  // 生成分享图片
  async function generateShareImage(paper) {
    const canvas = shareCanvas;
    const ctx = canvas.getContext('2d');
    
    // 设置基本参数
    const padding = 20;
    const lineHeight = 25;
    const maxWidth = 600;
    
    // 计算所需的总高度
    let totalHeight = padding;
    
    // 标题"Share Paper"的高度
    ctx.font = 'bold 24px Arial';
    totalHeight += 45; // 增加标题部分的高度，为间距留出更多空间
    
    // 计算论文标题的高度
    ctx.font = '16px Arial';
    const titleLines = getLines(ctx, paper.title, maxWidth - 60);
    totalHeight += titleLines.length * lineHeight + 15;
    
    // 计算作者的高度
    const authorLines = getLines(ctx, `Authors: ${paper.authors}`, maxWidth - 60);
    totalHeight += authorLines.length * lineHeight + 15;
    
    // 计算评论的高度（如果有）
    let commentLines = [];
    if (paper.comment) {
        commentLines = getLines(ctx, `Comment: ${paper.comment}`, maxWidth - 60);
        totalHeight += commentLines.length * lineHeight + 15;
    }
    
    // 计算标记的高度
    if (paper.needsImprovement) {
        totalHeight += lineHeight;
    }
    if (paper.hasGithub) {
        totalHeight += lineHeight;
    }
    
    // 链接的高度
    totalHeight += lineHeight + padding;
    
    // 设置画布尺寸
    canvas.width = maxWidth;
    canvas.height = totalHeight;
    
    // 设置背景色
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 开始绘制内容
    let y = padding;
    
    // 绘制标题 "Share Paper"
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#000000';
    ctx.fillText('Share Paper', padding, y + 24);
    y += 60; // 增加标题和内容之间的间距
    
    // 绘制论文标题
    ctx.font = '16px Arial';
    ctx.fillText('📄', padding, y);
    titleLines.forEach(line => {
        ctx.fillText(line, padding + 25, y);
        y += lineHeight;
    });
    y += 15;
    
    // 绘制作者
    ctx.fillText('👥', padding, y);
    authorLines.forEach(line => {
        ctx.fillText(line, padding + 25, y);
        y += lineHeight;
    });
    y += 15;
    
    // 绘制评论（如果有）
    if (paper.comment) {
        ctx.fillText('💭', padding, y);
        commentLines.forEach(line => {
            ctx.fillText(line, padding + 25, y);
            y += lineHeight;
        });
        y += 15;
    }
    
    // 绘制标记
    if (paper.needsImprovement) {
        ctx.fillText('⚠️ Needs Improvement in Understanding', padding, y);
        y += lineHeight;
    }
    if (paper.hasGithub) {
        ctx.fillText('💻 Has GitHub Repository', padding, y);
        y += lineHeight;
    }
    
    // 绘制链接
    y += 5;
    ctx.fillText('🔗', padding, y);
    ctx.fillStyle = '#1976d2';
    ctx.fillText(`Link: ${paper.url}`, padding + 25, y);
    
    return canvas;
  }

  // 辅助函数：将文本分行（支持中英文）
  function getLines(ctx, text, maxWidth) {
    const lines = [];
    let currentLine = '';
    let currentWidth = 0;

    // 遍历每个字符
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const charWidth = ctx.measureText(char).width;

      // 如果是英文单词，尝试完整保留
      if (/[a-zA-Z]/.test(char)) {
        let word = char;
        let j = i + 1;
        // 向后查找完整的单词
        while (j < text.length && /[a-zA-Z]/.test(text[j])) {
          word += text[j];
          j++;
        }
        const wordWidth = ctx.measureText(word).width;

        // 如果当前行加上这个单词超出宽度限制
        if (currentWidth + wordWidth > maxWidth) {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
            currentWidth = wordWidth;
          } else {
            // 如果单词本身就超过一行
            lines.push(word);
            currentLine = '';
            currentWidth = 0;
          }
        } else {
          currentLine += word;
          currentWidth += wordWidth;
        }
        i = j - 1; // 跳过已处理的字符
      } else {
        // 对于非英文字符（包括中文、标点等）
        if (currentWidth + charWidth > maxWidth) {
          lines.push(currentLine);
          currentLine = char;
          currentWidth = charWidth;
        } else {
          currentLine += char;
          currentWidth += charWidth;
        }
      }

      // 处理空格
      if (char === ' ' && currentLine) {
        const spaceWidth = ctx.measureText(' ').width;
        if (currentWidth + spaceWidth <= maxWidth) {
          currentLine += ' ';
          currentWidth += spaceWidth;
        }
      }
    }

    // 添加最后一行
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  // 复制到剪贴板
  copyButtons.forEach(button => {
    button.addEventListener('click', async function() {
      const type = this.dataset.type;
      const notification = document.getElementById('notification');
      
      try {
        if (type === 'text') {
          await navigator.clipboard.writeText(shareCardText.innerText);
          notification.textContent = '文本已复制到剪贴板';
        } else if (type === 'image') {
          const paper = JSON.parse(shareCardText.dataset.paper);
          const canvas = await generateShareImage(paper);
          
          try {
            // 尝试将图片直接复制到剪贴板
            canvas.toBlob(async (blob) => {
              try {
                const clipboardItem = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([clipboardItem]);
                notification.textContent = '图片已复制到剪贴板';
              } catch (err) {
                console.error('Failed to copy to clipboard:', err);
                // 如果复制到剪贴板失败，退回到下载方式
                const downloadLink = document.createElement('a');
                downloadLink.href = canvas.toDataURL('image/png');
                downloadLink.download = `${paper.title.slice(0, 30)}_share.png`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                notification.textContent = '图片已下载（复制到剪贴板失败）';
              }
            }, 'image/png');
          } catch (err) {
            console.error('Failed to create blob:', err);
            notification.textContent = '分享失败，请重试';
          }
        }
        
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 2000);
      } catch (err) {
        console.error('Failed to share:', err);
        notification.textContent = '分享失败，请重试';
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 2000);
      }
    });
  });

  function updatePaperList() {
    chrome.storage.local.get(['papers'], function(result) {
      const papers = result.papers || [];
      const searchText = searchInput.value.toLowerCase();
      const filterNeedsImprovement = filterNeedsImprovementCheckbox.checked;
      const filterHasGithub = filterHasGithubCheckbox.checked;
      
      // 根据搜索条件过滤论文
      const filteredPapers = papers.filter(paper => {
        // 首先检查"Needs Improvement"过滤器
        if (filterNeedsImprovement && !paper.needsImprovement) {
          return false;
        }

        // 检查"Has GitHub"过滤器
        if (filterHasGithub && !paper.hasGithub) {
          return false;
        }

        // 如果没有搜索文本，返回所有论文
        if (!searchText) {
          return true;
        }

        // 根据选中的搜索范围进行搜索
        return (
          (searchTitleCheckbox.checked && paper.title.toLowerCase().includes(searchText)) ||
          (searchAuthorsCheckbox.checked && paper.authors.toLowerCase().includes(searchText)) ||
          (searchAbstractCheckbox.checked && paper.abstract.toLowerCase().includes(searchText)) ||
          (searchCommentsCheckbox.checked && paper.comment && paper.comment.toLowerCase().includes(searchText))
        );
      });

      // 更新论文数量显示
      const paperCountElement = document.getElementById('paperCount');
      paperCountElement.textContent = `(${filteredPapers.length} papers)`;

      // 按时间倒序排序
      filteredPapers.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      paperList.innerHTML = '';
      filteredPapers.forEach((paper, index) => {
        const paperElement = document.createElement('div');
        paperElement.className = 'paper-item';
        
        // 基本信息
        paperElement.innerHTML = `
          <div class="paper-header">
            <strong>${paper.title}</strong>
            <span class="paper-time">Added: ${formatDate(paper.timestamp)}</span>
          </div>
          <small>${paper.authors}</small><br>
          <div class="abstract-container">
            <small class="abstract-text collapsed">${paper.abstract}</small>
            <button class="toggle-abstract">Show More</button>
          </div>
          <small><a href="${paper.url}" target="_blank">Open Paper</a></small>
          ${paper.needsImprovement ? '<span class="needs-improvement">Needs Improvement</span>' : ''}
          ${paper.hasGithub ? '<span class="has-github">Has GitHub</span>' : ''}
          ${paper.comment ? `
            <p>
              <em>Comment: ${paper.comment}</em>
              ${paper.lastEdited ? `<span class="edit-time">(Edited: ${formatDate(paper.lastEdited)})</span>` : ''}
            </p>
          ` : ''}
          <div class="paper-actions">
            <button class="edit">Edit Comment</button>
            <button class="delete">Delete</button>
          </div>
        `;

        // 添加摘要展开/收起功能
        const abstractText = paperElement.querySelector('.abstract-text');
        const toggleButton = paperElement.querySelector('.toggle-abstract');
        let isExpanded = false;

        toggleButton.addEventListener('click', function() {
          isExpanded = !isExpanded;
          if (isExpanded) {
            abstractText.classList.remove('collapsed');
            abstractText.classList.add('expanded');
            toggleButton.textContent = 'Show Less';
          } else {
            abstractText.classList.remove('expanded');
            abstractText.classList.add('collapsed');
            toggleButton.textContent = 'Show More';
          }
        });

        // 编辑按钮事件
        const editButton = paperElement.querySelector('.edit');
        editButton.addEventListener('click', function() {
          // 存储当前论文的引用
          const currentPaper = filteredPapers[index];
          // 在原始数组中找到对应的索引
          editingPaperIndex = papers.findIndex(p => p.timestamp === currentPaper.timestamp);
          
          // 填充所有字段
          titleInput.value = currentPaper.title || '';
          authorsInput.value = currentPaper.authors || '';
          abstractInput.value = currentPaper.abstract || '';
          commentInput.value = currentPaper.comment || '';
          needsImprovementCheckbox.checked = currentPaper.needsImprovement || false;
          hasGithubCheckbox.checked = currentPaper.hasGithub || false;
          
          saveButton.textContent = 'Update';
          paperElement.classList.add('edit-mode');
          commentInput.scrollIntoView({ behavior: 'smooth' });
          commentInput.focus();
        });

        // 删除按钮事件
        const deleteButton = paperElement.querySelector('.delete');
        deleteButton.addEventListener('click', function() {
          // 找到要删除的论文在原始数组中的索引
          const deleteIndex = papers.findIndex(p => p.timestamp === filteredPapers[index].timestamp);
          const updatedPapers = papers.filter((_, i) => i !== deleteIndex);
          chrome.storage.local.set({papers: updatedPapers}, function() {
            updatePaperList();
          });
        });

        // 添加分享按钮
        const shareButton = document.createElement('button');
        shareButton.className = 'share-button';
        shareButton.textContent = 'Share';
        shareButton.addEventListener('click', function() {
          const shareText = generateShareText(paper);
          shareCardText.innerText = shareText;
          shareCardText.dataset.paper = JSON.stringify(paper);
          shareModal.classList.add('show');
        });
        
        const paperActions = paperElement.querySelector('.paper-actions');
        paperActions.appendChild(shareButton);

        paperList.appendChild(paperElement);
      });
    });
  }

  // Initial paper list update
  updatePaperList();

  function generatePaperCard(paper) {
    const canvas = document.createElement('canvas');
    const ctx = ctx = canvas.getContext('2d');
    
    // 设置卡片基本样式
    const cardPadding = 30;
    const lineHeight = 24;
    const maxWidth = 800;
    
    // 设置字体样式
    ctx.font = 'bold 20px Arial';
    const titleLines = getWrappedLines(paper.title, ctx, maxWidth - 2 * cardPadding);
    
    ctx.font = '16px Arial';
    const authorLines = getWrappedLines(`Authors: ${paper.authors}`, ctx, maxWidth - 2 * cardPadding);
    
    let commentLines = [];
    if (paper.comment) {
        ctx.font = '16px Arial';
        commentLines = getWrappedLines(`Comment: ${paper.comment}`, ctx, maxWidth - 2 * cardPadding);
    }
    
    // 计算卡片高度
    const totalHeight = cardPadding * 2 + 
                       titleLines.length * lineHeight + 
                       authorLines.length * lineHeight +
                       (paper.comment ? commentLines.length * lineHeight : 0) +
                       lineHeight * 2; // 额外空间用于分隔
    
    // 设置画布尺寸
    canvas.width = maxWidth;
    canvas.height = totalHeight;
    
    // 绘制背景
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制边框
    ctx.strokeStyle = '#dee2e6';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    
    let currentY = cardPadding;
    
    // 绘制标题
    ctx.fillStyle = '#212529';
    ctx.font = 'bold 20px Arial';
    titleLines.forEach(line => {
        ctx.fillText(line, cardPadding, currentY + lineHeight);
        currentY += lineHeight;
    });
    
    currentY += lineHeight / 2; // 添加间距
    
    // 绘制作者
    ctx.fillStyle = '#495057';
    ctx.font = '16px Arial';
    authorLines.forEach(line => {
        ctx.fillText(line, cardPadding, currentY + lineHeight);
        currentY += lineHeight;
    });
    
    // 如果有评论，绘制评论
    if (paper.comment) {
        currentY += lineHeight / 2; // 添加间距
        ctx.fillStyle = '#6c757d';
        commentLines.forEach(line => {
            ctx.fillText(line, cardPadding, currentY + lineHeight);
            currentY += lineHeight;
        });
    }
    
    return canvas;
  }

  function getWrappedLines(text, ctx, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
  }
}); 