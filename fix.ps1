
$lines = Get-Content -Path 'd:\Infoyashonand_Technology\Insumitra17072026\Frontend\src\pages\Claims\index.tsx'
$head = $lines | Select-Object -First 1357
$tail = $lines | Select-Object -Skip 1365
$missing = Get-Content -Path 'd:\Infoyashonand_Technology\Insumitra17072026\temp_claims.tsx' | Select-Object -Skip 1357 -First 95 # Wait, I don't know the exact length. Let's just do it with grep or powershell manually.

