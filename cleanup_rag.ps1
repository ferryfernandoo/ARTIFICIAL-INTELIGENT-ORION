$content = Get-Content 'f:\chat bot\public\rag_index.json' -Raw
$content = $content -Replace 'Keamanan Orion AI', 'Keamanan Sistem AI'
$content = $content -Replace 'Orion AI tidak', 'Sistem AI tidak'
$content = $content -Replace 'Orion juga tidak', 'Sistem juga tidak'
$content = $content -Replace 'Selain pencarian berbasis kata kunci, Orion mendukung', 'Pencarian RAG mendukung pencarian berbasis kata kunci dan'
$content = $content -Replace 'Sistem akan menggabungkan', 'Sistem menggabungkan'
$content | Set-Content 'f:\chat bot\public\rag_index.json'
Write-Host 'RAG index cleaned successfully'
