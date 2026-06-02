// Test extractCodeFromMarkdown function

function extractCodeFromMarkdown(response) {
  if (!response || typeof response !== 'string') {
    return response;
  }

  let code = response.trim();

  // Remove all markdown code fence markers (opening and closing)
  // Handle ```python, ```py, ```, or any variant with optional language
  code = code.replace(/```(?:python|py)?\n?/gi, '');
  code = code.replace(/```\n?/gi, '');
  code = code.replace(/^`{3,}\s*\n?/gm, '');  // Lines starting with backticks
  code = code.replace(/\n?`{3,}\s*$/gm, '');   // Lines ending with backticks
  
  return code.trim();
}

// Test cases
const test1 = `\`\`\`python
from docx import Document
doc = Document()
doc.save('output.docx')
print('FILE_CREATED: output.docx')
\`\`\``;

const test2 = `\`\`\`
from docx import Document
doc = Document()
\`\`\``;

const test3 = `from docx import Document
doc = Document()
doc.save('output.docx')`;

console.log('Test 1 (```python...```):', extractCodeFromMarkdown(test1));
console.log('\n---\n');
console.log('Test 2 (```...```):', extractCodeFromMarkdown(test2));
console.log('\n---\n');
console.log('Test 3 (no fences):', extractCodeFromMarkdown(test3));
