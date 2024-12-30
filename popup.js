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
      'Title': paper.title,
      'Authors': paper.authors,
      'Abstract': paper.abstract,
      'Comment': paper.comment || '',
      'URL': paper.url,
      'Added Date': formatDate(paper.timestamp),
      'Last Edited': paper.lastEdited ? formatDate(paper.lastEdited) : '',
      'Needs Improvement': paper.needsImprovement ? 'Yes' : 'No'
    }));

    // 创建CSV内容
    const headers = Object.keys(excelData[0]);
    const csvContent = [
      headers.join(','),
      ...excelData.map(row => 
        headers.map(header => 
          JSON.stringify(row[header] || '')
        ).join(',')
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

        paperList.appendChild(paperElement);
      });
    });
  }

  // Initial paper list update
  updatePaperList();
}); 