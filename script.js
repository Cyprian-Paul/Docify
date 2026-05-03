/* =============================================
   DOCUAI — script.js
   All logic: code analysis, doc generation
   ============================================= */

(function () {
  'use strict';

  // ── State ──
  let selectedLang = 'javascript';
  let lastDocOutput = '';

  // ── DOM refs ──
  const codeInput        = document.getElementById('codeInput');
  const generateBtn      = document.getElementById('generateBtn');
  const clearBtn         = document.getElementById('clearBtn');
  const copyBtn          = document.getElementById('copyBtn');
  const downloadBtn      = document.getElementById('downloadBtn');
  const outputPlaceholder= document.getElementById('outputPlaceholder');
  const outputContent    = document.getElementById('outputContent');
  const metricsRow       = document.getElementById('metricsRow');
  const overviewBody     = document.getElementById('overviewBody');
  const functionsBody    = document.getElementById('functionsBody');
  const complexityBody   = document.getElementById('complexityBody');
  const suggestionsBody  = document.getElementById('suggestionsBody');
  const langPills        = document.querySelectorAll('.lang-pill');

  // ── Language switcher ──
  langPills.forEach(pill => {
    pill.addEventListener('click', () => {
      langPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedLang = pill.dataset.lang;
    });
  });

  // ── Clear button ──
  clearBtn.addEventListener('click', () => {
    codeInput.value = '';
    outputPlaceholder.classList.remove('hidden');
    outputContent.classList.add('hidden');
  });

  // ── Generate button ──
  generateBtn.addEventListener('click', () => {
    const code = codeInput.value.trim();
    if (!code) {
      shakeElement(generateBtn);
      return;
    }
    generateBtn.querySelector('.btn-text').textContent = 'Analyzing...';
    generateBtn.disabled = true;

    setTimeout(() => {
      const analysis = analyzeCode(code, selectedLang);
      renderOutput(analysis, code);
      generateBtn.querySelector('.btn-text').textContent = 'Generate Documentation';
      generateBtn.disabled = false;
    }, 800);
  });

  // ── Copy button ──
  copyBtn.addEventListener('click', () => {
    if (!lastDocOutput) return;
    navigator.clipboard.writeText(lastDocOutput).then(() => {
      const orig = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = orig; }, 1800);
    });
  });

  // ── Download button ──
  downloadBtn.addEventListener('click', () => {
    if (!lastDocOutput) return;
    const blob = new Blob([lastDocOutput], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'documentation.md';
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── Shake helper ──
  function shakeElement(el) {
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'shake 0.4s ease';
    setTimeout(() => { el.style.animation = ''; }, 500);
  }

  // Inject shake keyframe once
  const shakeStyle = document.createElement('style');
  shakeStyle.textContent = `
    @keyframes shake {
      0%,100%{transform:translateX(0)}
      20%{transform:translateX(-6px)}
      40%{transform:translateX(6px)}
      60%{transform:translateX(-4px)}
      80%{transform:translateX(4px)}
    }
  `;
  document.head.appendChild(shakeStyle);

  // ──────────────────────────────────────────────
  //  CODE ANALYSIS ENGINE
  // ──────────────────────────────────────────────

  function analyzeCode(code, lang) {
    const lines      = code.split('\n');
    const lineCount  = lines.length;
    const charCount  = code.length;

    // Detect functions
    const functions  = detectFunctions(code, lang);

    // Detect imports / dependencies
    const deps       = detectDependencies(code, lang);

    // Complexity metrics
    const complexity = calcComplexity(code, lines);

    // Detect patterns
    const patterns   = detectPatterns(code, lang);

    // Generate overview text
    const overview   = buildOverview(code, lang, functions, deps, patterns, lineCount);

    // Suggestions
    const suggestions = buildSuggestions(code, functions, complexity, lang);

    return { lineCount, charCount, functions, deps, complexity, patterns, overview, suggestions };
  }

  // ── Detect functions ──
  function detectFunctions(code, lang) {
    const results = [];
    const patterns = {
      javascript: [
        /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/g,
        /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
        /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[:=]\s*(?:async\s+)?function\s*\(([^)]*)\)/g,
        /(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*\{/g,
      ],
      python: [
        /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g,
        /async\s+def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g,
      ],
      generic: [
        /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/g,
        /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g,
      ]
    };

    const activePatterns = patterns[lang] || patterns.generic;
    const seen = new Set();

    activePatterns.forEach(pattern => {
      let match;
      const p = new RegExp(pattern.source, pattern.flags);
      while ((match = p.exec(code)) !== null) {
        const name = match[1];
        if (name && !seen.has(name) && !isKeyword(name)) {
          seen.add(name);
          const params = parseParams(match[2] || '');
          const body   = extractFunctionBody(code, match.index);
          const cxScore = calcFunctionComplexity(body);
          results.push({ name, params, complexity: cxScore });
        }
      }
    });

    return results.slice(0, 12);
  }

  function isKeyword(name) {
    const kw = ['if','else','for','while','return','switch','class','new','delete','typeof',
                 'void','try','catch','finally','throw','import','export','from','const','let',
                 'var','function','async','await'];
    return kw.includes(name);
  }

  function parseParams(paramStr) {
    if (!paramStr.trim()) return [];
    return paramStr.split(',').map(p => p.trim().split('=')[0].trim()).filter(Boolean).slice(0, 6);
  }

  function extractFunctionBody(code, startIdx) {
    const snippet = code.slice(startIdx, startIdx + 600);
    const open = snippet.indexOf('{');
    if (open === -1) return snippet.slice(0, 200);
    let depth = 0, i = open;
    while (i < snippet.length) {
      if (snippet[i] === '{') depth++;
      if (snippet[i] === '}') { depth--; if (depth === 0) return snippet.slice(open, i + 1); }
      i++;
    }
    return snippet.slice(open);
  }

  function calcFunctionComplexity(body) {
    const patterns = [/\bif\b/g, /\belse\b/g, /\bfor\b/g, /\bwhile\b/g, /\bswitch\b/g,
                      /\bcatch\b/g, /\?\?/g, /\|\|/g, /&&/g, /\bcase\b/g];
    let score = 1;
    patterns.forEach(p => { const m = body.match(p); if (m) score += m.length; });
    return score;
  }

  // ── Detect dependencies ──
  function detectDependencies(code, lang) {
    const deps = [];
    const jsImport   = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    const jsRequire  = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const pyImport   = /^(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gm;

    let m;
    const patterns = lang === 'python' ? [pyImport] : [jsImport, jsRequire];
    patterns.forEach(p => {
      while ((m = p.exec(code)) !== null) {
        const d = m[1];
        if (d && !deps.includes(d)) deps.push(d);
      }
    });
    return deps.slice(0, 8);
  }

  // ── Complexity metrics ──
  function calcComplexity(code, lines) {
    const maxNesting  = calcMaxNesting(code);
    const avgLineLen  = Math.round(lines.reduce((a, l) => a + l.length, 0) / (lines.length || 1));
    const commentRatio = calcCommentRatio(code, lines);

    return { maxNesting, avgLineLen, commentRatio };
  }

  function calcMaxNesting(code) {
    let max = 0, depth = 0;
    for (let i = 0; i < code.length; i++) {
      if (code[i] === '{') { depth++; if (depth > max) max = depth; }
      if (code[i] === '}') depth--;
    }
    return max;
  }

  function calcCommentRatio(code, lines) {
    const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('#') || l.trim().startsWith('*')).length;
    return Math.round((commentLines / (lines.length || 1)) * 100);
  }

  // ── Detect patterns ──
  function detectPatterns(code, lang) {
    const patterns = [];
    if (/async|await|Promise|\.then\(/.test(code))   patterns.push('Async / Promises');
    if (/class\s+[A-Z]/.test(code))                  patterns.push('OOP / Classes');
    if (/\.map\(|\.filter\(|\.reduce\(/.test(code))  patterns.push('Functional patterns');
    if (/try\s*{/.test(code))                         patterns.push('Error handling');
    if (/import|require|from/.test(code))             patterns.push('Module system');
    if (/\[|\]/.test(code) && /\.push\(|\.pop\(|\.shift\(/.test(code)) patterns.push('Array manipulation');
    if (/fetch\(|axios|http|request/.test(code))      patterns.push('HTTP / API calls');
    if (/localStorage|sessionStorage|cookie/.test(code)) patterns.push('Browser storage');
    if (/addEventListener|querySelector|getElementById/.test(code)) patterns.push('DOM manipulation');
    if (/db\.|query\(|SELECT|INSERT|mongoose|prisma/.test(code)) patterns.push('Database interaction');
    return patterns;
  }

  // ── Build overview text ──
  function buildOverview(code, lang, functions, deps, patterns, lineCount) {
    const langName = { javascript: 'JavaScript', python: 'Python', generic: 'code' }[lang] || 'code';
    const fnCount  = functions.length;
    const depCount = deps.length;

    let text = `This ${langName} module contains ${lineCount} lines`;
    if (fnCount > 0) text += ` and defines ${fnCount} function${fnCount > 1 ? 's' : ''}`;
    if (depCount > 0) text += `, importing ${depCount} external dependenc${depCount > 1 ? 'ies' : 'y'}`;
    text += '.';

    if (patterns.length > 0) {
      text += ` It uses ${patterns.slice(0, 3).join(', ').toLowerCase()}.`;
    }

    if (deps.length > 0) {
      text += ` Dependencies include: ${deps.slice(0, 4).join(', ')}.`;
    }

    return text;
  }

  // ── Build suggestions ──
  function buildSuggestions(code, functions, complexity, lang) {
    const tips = [];

    if (complexity.commentRatio < 10) {
      tips.push('Add inline comments to explain non-obvious logic. Aim for at least 10% comment coverage.');
    }
    if (complexity.maxNesting > 4) {
      tips.push(`Deep nesting detected (${complexity.maxNesting} levels). Consider extracting nested blocks into smaller helper functions.`);
    }
    functions.forEach(fn => {
      if (fn.params.length > 4) {
        tips.push(`Function "${fn.name}" takes ${fn.params.length} parameters. Consider grouping them into an options object.`);
      }
      if (fn.complexity > 8) {
        tips.push(`Function "${fn.name}" has high cyclomatic complexity (${fn.complexity}). Break it into smaller, focused functions.`);
      }
    });
    if (!/try|catch/.test(code)) {
      tips.push('No error handling detected. Add try/catch blocks around async operations and external calls.');
    }
    if (complexity.avgLineLen > 90) {
      tips.push('Some lines exceed 90 characters. Shorter lines improve readability and code review speed.');
    }
    if (tips.length === 0) {
      tips.push('Code structure looks clean. Consider adding JSDoc or docstring comments for each public function.');
      tips.push('Write unit tests to document expected behavior for each function.');
    }

    return tips.slice(0, 5);
  }

  // ──────────────────────────────────────────────
  //  RENDER OUTPUT
  // ──────────────────────────────────────────────

  function renderOutput(analysis, code) {
    // Show output panel
    outputPlaceholder.classList.add('hidden');
    outputContent.classList.remove('hidden');

    // Metrics Row
    renderMetrics(analysis);

    // Overview
    overviewBody.innerHTML = `<p>${analysis.overview}</p>`;
    if (analysis.patterns.length > 0) {
      overviewBody.innerHTML += `<p><strong>Patterns detected:</strong> ${analysis.patterns.join(', ')}</p>`;
    }

    // Functions
    renderFunctions(analysis.functions);

    // Complexity
    renderComplexity(analysis);

    // Suggestions
    renderSuggestions(analysis.suggestions);

    // Build markdown for export
    lastDocOutput = buildMarkdown(analysis, code);
  }

  function renderMetrics(analysis) {
    const avgFnComplexity = analysis.functions.length
      ? Math.round(analysis.functions.reduce((a, f) => a + f.complexity, 0) / analysis.functions.length)
      : 0;

    metricsRow.innerHTML = `
      <div class="metric-card">
        <span class="metric-val">${analysis.functions.length}</span>
        <span class="metric-label">Functions</span>
      </div>
      <div class="metric-card">
        <span class="metric-val">${analysis.lineCount}</span>
        <span class="metric-label">Lines</span>
      </div>
      <div class="metric-card">
        <span class="metric-val">${analysis.complexity.commentRatio}%</span>
        <span class="metric-label">Comments</span>
      </div>
    `;
  }

  function renderFunctions(functions) {
    if (functions.length === 0) {
      functionsBody.innerHTML = '<p>No named functions detected. The code may be using inline or anonymous patterns.</p>';
      return;
    }

    let html = '<table class="fn-table"><thead><tr><th>Name</th><th>Parameters</th><th>Complexity</th></tr></thead><tbody>';
    functions.forEach(fn => {
      const cx = fn.complexity;
      const badge = cx <= 3 ? 'low' : cx <= 7 ? 'medium' : 'high';
      const label = cx <= 3 ? 'Low' : cx <= 7 ? 'Medium' : 'High';
      const params = fn.params.length > 0 ? fn.params.join(', ') : 'none';
      html += `
        <tr>
          <td><span class="fn-name">${escapeHtml(fn.name)}()</span></td>
          <td>${escapeHtml(params)}</td>
          <td><span class="complexity-badge complexity-${badge}">${label} (${cx})</span></td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    functionsBody.innerHTML = html;
  }

  function renderComplexity(analysis) {
    const { maxNesting, avgLineLen, commentRatio } = analysis.complexity;

    const items = [
      { name: 'Max Nesting Depth', val: maxNesting, max: 8, score: maxNesting },
      { name: 'Avg Line Length',   val: avgLineLen, max: 120, score: avgLineLen },
      { name: 'Comment Coverage',  val: `${commentRatio}%`, max: 100, score: 100 - commentRatio },
    ];

    let html = '<div class="complexity-row">';
    items.forEach(item => {
      const pct = Math.min(100, Math.round((item.score / item.max) * 100));
      const color = pct > 70 ? '#f87171' : pct > 40 ? '#fbbf24' : '#34d399';
      html += `
        <div class="complexity-item">
          <div class="complexity-info">
            <span class="complexity-name">${item.name}</span>
            <span class="complexity-score">${item.val}</span>
          </div>
          <div class="complexity-bar-bg">
            <div class="complexity-bar-fill" style="width:${pct}%; background:${color};"></div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    complexityBody.innerHTML = html;
  }

  function renderSuggestions(suggestions) {
    let html = '';
    suggestions.forEach(tip => {
      html += `
        <div class="suggestion-item">
          <div class="suggestion-dot"></div>
          <span>${escapeHtml(tip)}</span>
        </div>
      `;
    });
    suggestionsBody.innerHTML = html;
  }

  // ──────────────────────────────────────────────
  //  MARKDOWN EXPORT
  // ──────────────────────────────────────────────

  function buildMarkdown(analysis, code) {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    let md = `# Code Documentation\n\n_Generated by DocuAI on ${date}_\n\n---\n\n`;

    md += `## Overview\n\n${analysis.overview}\n\n`;

    if (analysis.patterns.length > 0) {
      md += `**Patterns detected:** ${analysis.patterns.join(', ')}\n\n`;
    }

    md += `## Metrics\n\n`;
    md += `| Metric | Value |\n|---|---|\n`;
    md += `| Lines of code | ${analysis.lineCount} |\n`;
    md += `| Functions detected | ${analysis.functions.length} |\n`;
    md += `| Comment coverage | ${analysis.complexity.commentRatio}% |\n`;
    md += `| Max nesting depth | ${analysis.complexity.maxNesting} |\n`;
    md += `| Avg line length | ${analysis.complexity.avgLineLen} chars |\n\n`;

    if (analysis.functions.length > 0) {
      md += `## Functions\n\n`;
      md += `| Function | Parameters | Complexity |\n|---|---|---|\n`;
      analysis.functions.forEach(fn => {
        const params = fn.params.length > 0 ? fn.params.join(', ') : 'none';
        const cx = fn.complexity <= 3 ? 'Low' : fn.complexity <= 7 ? 'Medium' : 'High';
        md += `| \`${fn.name}()\` | ${params} | ${cx} (${fn.complexity}) |\n`;
      });
      md += '\n';
    }

    if (analysis.deps.length > 0) {
      md += `## Dependencies\n\n`;
      analysis.deps.forEach(d => { md += `- \`${d}\`\n`; });
      md += '\n';
    }

    md += `## Documentation Tips\n\n`;
    analysis.suggestions.forEach(s => { md += `- ${s}\n`; });

    return md;
  }

  // ──────────────────────────────────────────────
  //  UTILS
  // ──────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
