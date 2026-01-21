<?php
/**
 * Presentify AI - RESTful API Source of Truth
 * 
 * This file implements the backend migration specification using plain PHP.
 * It provides endpoints for Auth, Presentations, Sessions, and Settings.
 */

// Composer autoload (mongodb/mongodb library provides MongoDB\Client)
$autoload = __DIR__ . '/vendor/autoload.php';
if (file_exists($autoload)) {
    require $autoload;
}

// --- CORS & Headers ---
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// --- Configuration ---
// Note: In a production environment, you would use a library like php-dotenv.
// For this standalone file, we assume getenv() picks up values from the environment.
$mongoUri = getenv('MONGODB_URI') ?: "mongodb://localhost/aiorchestrate";
$mongoUser = getenv('MONGODB_USERNAME') ?: "admin";
$mongoPass = getenv('MONGODB_PASSWORD') ?: "password";
$jwtSecret = getenv('JWT_SECRET') ?: "default_secret_key";

// --- Database Connection ---
// Requires: composer require mongodb/mongodb
try {
    // Check if class exists to avoid fatal errors if extension is missing
    if (!class_exists('MongoDB\Client')) {
        throw new Exception("MongoDB PHP Library (mongodb/mongodb) not found.");
    }
    $client = new MongoDB\Client($mongoUri, [
        'username' => $mongoUser,
        'password' => $mongoPass,
    ]);
    $db = $client->selectDatabase('aiorchestrate');
    
    $usersCollection = $db->users;
    $presentationsCollection = $db->presentations;
    $sessionsCollection = $db->sessions;
    $settingsCollection = $db->settings;
} catch (Exception $e) {
    error_log("Database Connection Error: " . $e->getMessage());
    // Only return error if not the status endpoint
    if (($_GET['action'] ?? '') !== 'status') {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database connection failed.']);
        exit;
    }
}

// --- Helper Functions ---
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function getBearerToken() {
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        if (preg_match('/Bearer\s(\S+)/', $headers['Authorization'], $matches)) {
            return $matches[1];
        }
    }
    return null;
}

function jwt_encode($payload, $secret) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode(json_encode($payload)));
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

function jwt_decode($token, $secret) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    $header = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[0])), true);
    $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $parts[1])), true);
    $signature = str_replace(['-', '_'], ['+', '/'], $parts[2]);
    $validSignature = base64_encode(hash_hmac('sha256', $parts[0] . "." . $parts[1], $secret, true));
    if ($signature !== str_replace('=', '', $validSignature)) return null;
    return $payload;
}

function requireAuth($secret) {
    $token = getBearerToken();
    if (!$token) jsonResponse(['success' => false, 'error' => 'Not authenticated'], 401);
    $payload = jwt_decode($token, $secret);
    if (!$payload || !isset($payload['userId'])) jsonResponse(['success' => false, 'error' => 'Invalid token'], 401);
    return $payload['userId'];
}

// --- Router ---
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch ($action) {
    case 'status':
        $dbStatus = false;
        try {
            $client->listDatabases();
            $dbStatus = true;
        } catch (Exception $e) {}
        jsonResponse([
            'success' => true,
            'api_running' => true,
            'database_connected' => $dbStatus,
            'server_time' => date('Y-m-d H:i:s')
        ]);
        break;

    case 'signup':
        if ($method !== 'POST') jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
        $email = strtolower(trim($input['email'] ?? ''));
        $password = $input['password'] ?? '';
        $displayName = trim($input['displayName'] ?? '');
        if (!$email || !$password || !$displayName) jsonResponse(['success' => false, 'error' => 'Missing fields'], 400);
        
        $exists = $usersCollection->findOne(['email' => $email]);
        if ($exists) jsonResponse(['success' => false, 'error' => 'Email already registered'], 400);
        
        $userDoc = [
            'email' => $email,
            'passwordHash' => password_hash($password, PASSWORD_BCRYPT),
            'displayName' => $displayName,
            'createdAt' => new MongoDB\BSON\UTCDateTime()
        ];
        $result = $usersCollection->insertOne($userDoc);
        $userId = (string)$result->getInsertedId();
        
        $token = jwt_encode(['userId' => $userId, 'email' => $email], $jwtSecret);
        jsonResponse([
            'success' => true,
            'user' => [
                '_id' => $userId,
                'email' => $email,
                'displayName' => $displayName,
                'createdAt' => date('c')
            ],
            'token' => $token
        ], 201);
        break;

    case 'login':
        if ($method !== 'POST') jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
        $email = strtolower(trim($input['email'] ?? ''));
        $password = $input['password'] ?? '';
        
        $user = $usersCollection->findOne(['email' => $email]);
        if (!$user) jsonResponse(['success' => false, 'error' => 'User not found'], 401);
        if (!password_verify($password, $user['passwordHash'])) jsonResponse(['success' => false, 'error' => 'Incorrect password'], 401);
        
        $userId = (string)$user['_id'];
        $token = jwt_encode(['userId' => $userId, 'email' => $email], $jwtSecret);
        jsonResponse([
            'success' => true,
            'user' => [
                '_id' => $userId,
                'email' => $user['email'],
                'displayName' => $user['displayName'],
                'createdAt' => $user['createdAt']->toDateTime()->format('c')
            ],
            'token' => $token
        ]);
        break;

    case 'me':
        $userId = requireAuth($jwtSecret);
        $user = $usersCollection->findOne(['_id' => new MongoDB\BSON\ObjectId($userId)]);
        if (!$user) jsonResponse(['success' => false, 'error' => 'User not found'], 404);
        jsonResponse([
            'success' => true,
            'user' => [
                '_id' => $userId,
                'email' => $user['email'],
                'displayName' => $user['displayName'],
                'createdAt' => $user['createdAt']->toDateTime()->format('c')
            ]
        ]);
        break;

    case 'presentations':
        $userId = requireAuth($jwtSecret);
        $cursor = $presentationsCollection->find(['userId' => $userId], ['sort' => ['updatedAt' => -1]]);
        $list = [];
        foreach ($cursor as $doc) {
            $list[] = [
                '_id' => (string)$doc['_id'],
                'title' => $doc['title'],
                'updatedAt' => $doc['updatedAt']->toDateTime()->format('c'),
                'slideCount' => count($doc['slides'] ?? [])
            ];
        }
        jsonResponse(['success' => true, 'presentations' => $list]);
        break;

    case 'presentation':
        $userId = requireAuth($jwtSecret);
        $id = $_GET['id'] ?? null;
        
        if ($method === 'GET') {
            if (!$id) jsonResponse(['success' => false, 'error' => 'ID required'], 400);
            $doc = $presentationsCollection->findOne(['_id' => new MongoDB\BSON\ObjectId($id), 'userId' => $userId]);
            if (!$doc) jsonResponse(['success' => false, 'error' => 'Presentation not found'], 404);
            $doc['_id'] = (string)$doc['_id'];
            $doc['updatedAt'] = $doc['updatedAt']->toDateTime()->format('c');
            $doc['createdAt'] = $doc['createdAt']->toDateTime()->format('c');
            jsonResponse(['success' => true, 'presentation' => $doc]);
        } 
        elseif ($method === 'POST') {
            $input['userId'] = $userId;
            $input['updatedAt'] = new MongoDB\BSON\UTCDateTime();
            $input['createdAt'] = new MongoDB\BSON\UTCDateTime();
            $result = $presentationsCollection->insertOne($input);
            $input['_id'] = (string)$result->getInsertedId();
            $input['updatedAt'] = date('c');
            $input['createdAt'] = date('c');
            jsonResponse(['success' => true, 'presentation' => $input], 201);
        }
        elseif ($method === 'PUT') {
            if (!$id) jsonResponse(['success' => false, 'error' => 'ID required'], 400);
            $input['updatedAt'] = new MongoDB\BSON\UTCDateTime();
            unset($input['_id']);
            unset($input['userId']);
            unset($input['createdAt']);
            $result = $presentationsCollection->updateOne(
                ['_id' => new MongoDB\BSON\ObjectId($id), 'userId' => $userId],
                ['$set' => $input]
            );
            if ($result->getMatchedCount() === 0) jsonResponse(['success' => false, 'error' => 'Presentation not found or access denied'], 404);
            jsonResponse(['success' => true]);
        }
        elseif ($method === 'DELETE') {
            if (!$id) jsonResponse(['success' => false, 'error' => 'ID required'], 400);
            $result = $presentationsCollection->deleteOne(['_id' => new MongoDB\BSON\ObjectId($id), 'userId' => $userId]);
            if ($result->getDeletedCount() === 0) jsonResponse(['success' => false, 'error' => 'Presentation not found or access denied'], 404);
            jsonResponse(['success' => true]);
        }
        break;

    case 'session':
        $userId = requireAuth($jwtSecret);
        if ($method === 'GET') {
            $session = $sessionsCollection->findOne(['userId' => $userId]);
            if (!$session) {
                jsonResponse(['success' => true, 'session' => ['presentation' => null, 'slideIndex' => 0]]);
            }
            $session['updatedAt'] = $session['updatedAt']->toDateTime()->format('c');
            unset($session['_id'], $session['userId']);
            jsonResponse(['success' => true, 'session' => $session]);
        }
        elseif ($method === 'PUT') {
            $input['userId'] = $userId;
            $input['updatedAt'] = new MongoDB\BSON\UTCDateTime();
            $sessionsCollection->updateOne(
                ['userId' => $userId],
                ['$set' => $input],
                ['upsert' => true]
            );
            jsonResponse(['success' => true]);
        }
        elseif ($method === 'DELETE') {
            $sessionsCollection->deleteOne(['userId' => $userId]);
            jsonResponse(['success' => true]);
        }
        break;

    case 'settings':
        $userId = requireAuth($jwtSecret);
        if ($method === 'GET') {
            $sets = $settingsCollection->findOne(['userId' => $userId]);
            if (!$sets) {
                jsonResponse(['success' => true, 'settings' => ['defaultAdvancedMode' => true, 'autoplayDelay' => 2000]]);
            }
            unset($sets['_id'], $sets['userId']);
            jsonResponse(['success' => true, 'settings' => $sets]);
        }
        elseif ($method === 'PUT') {
            $input['userId'] = $userId;
            $settingsCollection->updateOne(
                ['userId' => $userId],
                ['$set' => $input],
                ['upsert' => true]
            );
            jsonResponse(['success' => true]);
        }
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Unknown action: ' . $action], 404);
}
