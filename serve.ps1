# Jednoduchy staticky server pro PÁTRAČ (bez Pythonu/Node)
param([int]$Port = 8080)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://localhost:$Port/"

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.webp' = 'image/webp'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
$listener.Start()

Write-Host "PATRAC: $url"
Write-Host "Slozka: $root"
Write-Host "Ukonceni: Ctrl+C"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = [Uri]::UnescapeDataString($request.Url.LocalPath)
        if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }

        $relative = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
        $filePath = Join-Path $root $relative

        $resolved = [IO.Path]::GetFullPath($filePath)
        $rootFull = [IO.Path]::GetFullPath($root)
        if (-not $resolved.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
            $response.StatusCode = 403
            $response.Close()
            continue
        }

        if (Test-Path $resolved -PathType Leaf) {
            $bytes = [IO.File]::ReadAllBytes($resolved)
            $ext = [IO.Path]::GetExtension($resolved).ToLowerInvariant()
            if ($mime.ContainsKey($ext)) {
                $response.ContentType = $mime[$ext]
            }
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $body = [Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
            $response.ContentType = 'text/plain; charset=utf-8'
            $response.ContentLength64 = $body.Length
            $response.OutputStream.Write($body, 0, $body.Length)
        }

        $response.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
