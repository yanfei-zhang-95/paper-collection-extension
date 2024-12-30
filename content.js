// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Message received in content script:', request);
  if (request.action === "getPaperInfo") {
    try {
      const paperInfo = extractPaperInfo();
      console.log('Extracted paper info:', paperInfo);
      sendResponse(paperInfo);
    } catch (error) {
      console.error('Error extracting paper info:', error);
      sendResponse({
        title: '',
        authors: '',
        abstract: '',
        error: error.message
      });
    }
  }
  return true;
});

function extractPaperInfo() {
  let title = '';
  let authors = '';
  let abstract = '';
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  console.log('Current URL:', hostname + pathname);

  // Google Scholar
  if (hostname.includes('scholar.google.com')) {
    console.log('Extracting from Google Scholar');
    
    // 检查是否在引用页面
    if (pathname.includes('citations') && window.location.href.includes('citation_for_view')) {
      // 引用页面的提取逻辑
      console.log('Detected Google Scholar citation page');
      
      // 标题提取
      const titleElement = document.querySelector('#gsc_vcd_title');
      if (titleElement) {
        title = titleElement.textContent.trim();
        console.log('Found title:', title);
      }
      
      // 作者提取 - 查找包含"作者"字段的gsc_oci_field后面的gsc_oci_value
      const authorFieldElement = Array.from(document.querySelectorAll('.gsc_oci_field'))
        .find(el => el.textContent.includes('作者'));
      if (authorFieldElement) {
        const authorElement = authorFieldElement.nextElementSibling;
        if (authorElement && authorElement.classList.contains('gsc_oci_value')) {
          authors = authorElement.textContent.trim();
          console.log('Found authors:', authors);
        }
      }
      
      // 摘要提取 - 查找包含"简介"字段的gsc_oci_field后面的gsc_oci_value
      const abstractFieldElement = Array.from(document.querySelectorAll('.gsc_oci_field'))
        .find(el => el.textContent.includes('简介'));
      if (abstractFieldElement) {
        const abstractElement = abstractFieldElement.nextElementSibling;
        if (abstractElement && abstractElement.classList.contains('gsc_oci_value')) {
          const abstractTextElement = abstractElement.querySelector('.gsh_small');
          if (abstractTextElement) {
            abstract = abstractTextElement.textContent.trim();
            console.log('Found abstract:', abstract);
          }
        }
      }
      
      console.log('Citation page extraction results:', {
        titleFound: !!title,
        authorsFound: !!authors,
        abstractFound: !!abstract
      });
    } else {
      // 普通搜索页面的提取逻辑
      const titleElem = document.querySelector('.gs_rt') || document.querySelector('.gsc-title');
      title = titleElem?.textContent.trim() || '';
      authors = document.querySelector('.gs_a')?.textContent.trim() || '';
      
      // 尝试从搜索结果页面提取摘要
      const abstractElem = document.querySelector('.gs_rs');
      if (abstractElem) {
        abstract = abstractElem.textContent.trim();
      }
    }
  }
  // arXiv
  else if (hostname.includes('arxiv.org')) {
    console.log('Extracting from arXiv');
    
    // 检查是否在摘要页面
    if (pathname.includes('/abs/')) {
      console.log('Detected arXiv abstract page');
      
      // 标题提取 - 摘要页面格式
      const titleElement = document.querySelector('h1.title');
      if (titleElement) {
        title = titleElement.textContent.replace(/^Title:?\s*/i, '').trim();
        console.log('Found title:', title);
      }

      // 作者提取 - 摘要页面格式
      const authorElement = document.querySelector('.authors');
      if (authorElement) {
        authors = authorElement.textContent.replace(/^Authors?:?\s*/i, '').trim();
        console.log('Found authors:', authors);
      }

      // 摘要提取 - 摘要页面格式
      const abstractElement = document.querySelector('.abstract');
      if (abstractElement) {
        abstract = abstractElement.textContent.replace(/^Abstract:?\s*/i, '').trim();
        console.log('Found abstract:', abstract);
      }

      console.log('arXiv extraction results:', {
        titleFound: !!title,
        authorsFound: !!authors,
        abstractFound: !!abstract
      });
    }
  }
  // IEEE Xplore
  else if (hostname.includes('ieeexplore.ieee.org')) {
    console.log('Extracting from IEEE Xplore');
    title = document.querySelector('h1.document-title')?.textContent.trim() ||
            document.querySelector('h1.title')?.textContent.trim() || '';
    authors = Array.from(document.querySelectorAll('div.authors-info span.author, span.authors'))
      .map(author => author.textContent.trim())
      .join(', ');
    abstract = document.querySelector('div.abstract-text, div.abstract')?.textContent.trim() || '';
  }
  // ACM Digital Library
  else if (hostname.includes('dl.acm.org')) {
    console.log('Extracting from ACM DL');
    title = document.querySelector('h1.citation__title')?.textContent.trim() ||
            document.querySelector('h1.title')?.textContent.trim() || '';
    authors = Array.from(document.querySelectorAll('span.author-name, div.auth-name'))
      .map(author => author.textContent.trim())
      .join(', ');
    abstract = document.querySelector('div.abstractSection, div.abstract')?.textContent.trim() || '';
  }
  // ScienceDirect
  else if (hostname.includes('sciencedirect.com')) {
    console.log('Extracting from ScienceDirect');
    
    // 标题提取 - 尝试多个可能的选择器
    const titleSelectors = [
      'h1.article-title',           // 新版页面标题
      'h1.title-text',              // 标准页面标题
      'span.title-text',            // 某些页面的标题格式
      'h1[class*="title"]',         // 包含title的任何h1
      'div.title-text'              // 备用选择器
    ];
    
    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement) {
        title = titleElement.textContent.trim();
        console.log('Found title using selector:', selector, title);
        break;
      }
    }

    // 作者提取 - 改进作者提取逻辑
    const authorElements = document.querySelectorAll([
      'div.author-group span.content',          // 主要作者信息
      'div.author-group a.author-name',         // 作者链接
      'div.author-group span.author',           // 作者名字
      'a.author[title]',                        // 带标题的作者链接
      '.authors-list span.text.given-name',     // 给定名
      '.authors-list span.text.surname'         // 姓氏
    ].join(','));

    if (authorElements.length > 0) {
      authors = Array.from(authorElements)
        .map(author => author.textContent.trim())
        .filter(author => author && !author.includes('View ') && !author.includes('Show '))
        .join(', ');
      console.log('Found authors:', authors);
    }

    // 摘要提取 - 改进摘要提取逻辑
    const abstractSelectors = [
      'div.abstract.author p',                  // 作者摘要
      'div#abstracts p',                        // 摘要段落
      'div.abstract p',                         // 一般摘要
      'section.abstract p',                     // 部分页面的摘要格式
      '[class*="abstract"] p'                   // 任何包含abstract的容器
    ];

    for (const selector of abstractSelectors) {
      const abstractElements = document.querySelectorAll(selector);
      if (abstractElements.length > 0) {
        abstract = Array.from(abstractElements)
          .map(el => el.textContent.trim())
          .filter(text => text && !text.toLowerCase().startsWith('abstract'))
          .join('\n');
        if (abstract) {
          console.log('Found abstract using selector:', selector, abstract);
          break;
        }
      }
    }

    // 如果上述方法都失败，尝试使用结构化数据
    if (!title || !authors || !abstract) {
      const scriptElements = document.querySelectorAll('script[type="application/ld+json"]');
      scriptElements.forEach(script => {
        try {
          const jsonData = JSON.parse(script.textContent);
          if (!title && jsonData.name) {
            title = jsonData.name;
            console.log('Found title from JSON-LD:', title);
          }
          if (!authors && jsonData.author) {
            const authorArray = Array.isArray(jsonData.author) ? jsonData.author : [jsonData.author];
            authors = authorArray.map(author => author.name).join(', ');
            console.log('Found authors from JSON-LD:', authors);
          }
          if (!abstract && jsonData.description) {
            abstract = jsonData.description;
            console.log('Found abstract from JSON-LD:', abstract);
          }
        } catch (e) {
          console.error('Error parsing JSON-LD:', e);
        }
      });
    }
  }
  // Springer
  else if (hostname.includes('springer.com')) {
    console.log('Extracting from Springer');
    title = document.querySelector('h1.c-article-title, h1.title')?.textContent.trim() || '';
    authors = Array.from(document.querySelectorAll('a.c-article-author-link, span.authors'))
      .map(author => author.textContent.trim())
      .join(', ');
    abstract = document.querySelector('div.c-article-section__content p, div.abstract')?.textContent.trim() || '';
  }
  // OpenReview
  else if (hostname.includes('openreview.net')) {
    console.log('Extracting from OpenReview');
    
    // 标题提取 - 使用正确的类名
    const titleElement = document.querySelector('h2.citation_title');
    if (titleElement) {
      title = titleElement.textContent.trim();
      console.log('Found title:', title);
    }
    
    // 作者提取
    const authorElement = document.querySelector('h3');
    if (authorElement) {
      // 移除可能的修改日期信息
      authors = authorElement.textContent.split('modified:')[0].trim();
      console.log('Found authors:', authors);
    }
    
    // 摘要提取
    const abstractKeyword = Array.from(document.querySelectorAll('strong'))
      .find(el => el.textContent.trim() === 'Abstract:');
    if (abstractKeyword) {
      // 获取Abstract:后面的文本直到下一个strong标签
      let currentNode = abstractKeyword.nextSibling;
      let abstractText = '';
      
      while (currentNode && 
             !(currentNode.tagName === 'STRONG' || 
               (currentNode.previousElementSibling && 
                currentNode.previousElementSibling.tagName === 'STRONG' &&
                currentNode.previousElementSibling.textContent.includes('Keywords')))) {
        if (currentNode.nodeType === Node.TEXT_NODE) {
          abstractText += currentNode.textContent;
        }
        currentNode = currentNode.nextSibling;
      }
      
      abstract = abstractText.trim();
      console.log('Found abstract:', abstract);
    }
    
    console.log('OpenReview extraction results:', {
      titleFound: !!title,
      authorsFound: !!authors,
      abstractFound: !!abstract
    });
  }

  // Fallback to meta tags if specific selectors fail
  if (!title) {
    console.log('Using meta tags fallback for title');
    title = document.querySelector('meta[name="citation_title"]')?.content ||
            document.querySelector('meta[property="og:title"]')?.content ||
            document.title;
  }

  if (!authors) {
    console.log('Using meta tags fallback for authors');
    const authorMeta = document.querySelector('meta[name="citation_author"]');
    if (authorMeta) {
      authors = authorMeta.content;
    } else {
      const authorMetas = document.querySelectorAll('meta[name="citation_author"]');
      if (authorMetas.length > 0) {
        authors = Array.from(authorMetas)
          .map(meta => meta.content)
          .join(', ');
      } else {
        authors = document.querySelector('meta[name="author"]')?.content || '';
      }
    }
  }

  if (!abstract) {
    console.log('Using meta tags fallback for abstract');
    abstract = document.querySelector('meta[name="citation_abstract"]')?.content ||
               document.querySelector('meta[name="description"]')?.content || '';
  }

  console.log('Final extracted info:', { title, authors, abstract });
  return {
    title: title,
    authors: authors,
    abstract: abstract
  };
} 