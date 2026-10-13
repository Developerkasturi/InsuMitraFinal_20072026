<?php
/**
 * Same-origin API Reverse Proxy for Hostinger (swara.exportshub.in)
 * Routes Frontend API requests to the Render backend without browser CORS errors.
 */

$backendBase = 'https://insumitrafinal-20072026.onrender.com/api/v1';
$allowedOriginHeader = 'https://insumitr.exportshub.in';

// Handle CORS preflight if called cross-origin
$requestOrigin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header('Access-Control-Allow-Origin: ' . $requestOrigin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Tenant-ID, Accept');
header('Access-Control-Expose-Headers: Content-Disposition');

$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Resolve endpoint path
$path = '';
if (!empty($_GET['__path'])) {
    $path = '/' . ltrim($_GET['__path'], '/');
} elseif (!empty($_SERVER['PATH_INFO'])) {
    $path = '/' . ltrim($_SERVER['PATH_INFO'], '/');
} else {
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $path = preg_replace('#^/(api-proxy\.php|api/v1)#', '', $uri);
    $path = '/' . ltrim((string)$path, '/');
}

// Build query string excluding internal __path parameter
$queryParams = $_GET;
unset($queryParams['__path']);
$queryString = http_build_query($queryParams);

$targetUrl = rtrim($backendBase, '/') . $path . ($queryString ? '?' . $queryString : '');

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);

// Collect request headers
$incomingHeaders = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = '';
foreach ($incomingHeaders as $k => $v) {
    if (strtolower($k) === 'authorization') {
        $authHeader = $v;
        break;
    }
}
if (!$authHeader) {
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
}

$contentType = '';
if (!empty($_SERVER['CONTENT_TYPE'])) {
    $contentType = $_SERVER['CONTENT_TYPE'];
} elseif (!empty($_SERVER['HTTP_CONTENT_TYPE'])) {
    $contentType = $_SERVER['HTTP_CONTENT_TYPE'];
}

$forwardHeaders = [
    'Origin: ' . $allowedOriginHeader,
];
if ($authHeader) {
    $forwardHeaders[] = 'Authorization: ' . $authHeader;
}
if (!empty($_SERVER['HTTP_X_TENANT_ID'])) {
    $forwardHeaders[] = 'X-Tenant-ID: ' . $_SERVER['HTTP_X_TENANT_ID'];
}
if (!empty($_SERVER['HTTP_ACCEPT'])) {
    $forwardHeaders[] = 'Accept: ' . $_SERVER['HTTP_ACCEPT'];
}

// Handle request payload for write methods
if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
    if (!empty($_FILES) || stripos($contentType, 'multipart/form-data') !== false) {
        $postFields = $_POST;
        foreach ($_FILES as $field => $fileInfo) {
            if (is_array($fileInfo['tmp_name'])) {
                foreach ($fileInfo['tmp_name'] as $idx => $tmpName) {
                    if ($tmpName && is_uploaded_file($tmpName)) {
                        $postFields[$field . '[' . $idx . ']'] = new CURLFile(
                            $tmpName,
                            $fileInfo['type'][$idx] ?? 'application/octet-stream',
                            $fileInfo['name'][$idx] ?? 'file'
                        );
                    }
                }
            } elseif (!empty($fileInfo['tmp_name']) && is_uploaded_file($fileInfo['tmp_name'])) {
                $postFields[$field] = new CURLFile(
                    $fileInfo['tmp_name'],
                    $fileInfo['type'] ?? 'application/octet-stream',
                    $fileInfo['name'] ?? 'file'
                );
            }
        }
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    } else {
        $rawBody = file_get_contents('php://input');
        if ($rawBody !== false && $rawBody !== '') {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $rawBody);
        }
        if ($contentType) {
            $forwardHeaders[] = 'Content-Type: ' . $contentType;
        }
    }
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $forwardHeaders);

$response = curl_exec($ch);
if ($response === false) {
    $err = curl_error($ch);
    curl_close($ch);
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['statusCode' => 502, 'message' => 'Proxy error: ' . $err]);
    exit;
}

$statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

$rawResponseHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

http_response_code($statusCode ?: 200);

$headerLines = explode("\r\n", $rawResponseHeaders);
foreach ($headerLines as $line) {
    if (stripos($line, 'Content-Type:') === 0 || stripos($line, 'Content-Disposition:') === 0) {
        header($line, true);
    }
}

echo $responseBody;
