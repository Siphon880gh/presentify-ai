<?php
/**
 * Presentify AI - Database Seed Script
 */
// Composer autoload (mongodb/mongodb library provides MongoDB\Client)
$autoload = __DIR__ . '/vendor/autoload.php';
if (file_exists($autoload)) {
    require $autoload;
}

// Load environment variables from .env if present
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue; // Skip comments
        if (strpos($line, '=') === false) continue;
        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value, " \t\n\r\0\x0B\"'"); // Trim quotes too
        putenv("$key=$value");
    }
}


$mongoUri = getenv('MONGODB_URI') ?: "mongodb://127.0.0.1:27017/presentify";
$mongoUser = getenv('MONGODB_USERNAME') ?: "root";
$mongoPass = getenv('MONGODB_PASSWORD') ?: "password";
$mongoAuthSource = getenv('MONGODB_AUTH_SOURCE') ?: "admin";

echo "--- Seeding Presentify AI Database ---\n";

try {
    if (!class_exists('MongoDB\Client')) {
        throw new Exception("MongoDB PHP Library not found.");
    }
    $client = new MongoDB\Client($mongoUri, [
        'username' => $mongoUser,
        'password' => $mongoPass,
        'authSource' => $mongoAuthSource,
    ]);
    $db = $client->selectDatabase('presentify');
    
    // Clear existing data for fresh seed
    $db->users->deleteMany([]);
    $db->presentations->deleteMany([]);
    $db->sessions->deleteMany([]);
    $db->settings->deleteMany([]);
    echo "Cleared existing collections.\n";

    // Create Test Users
    $testUsers = [
        [
            'email' => 'user_a@test.com',
            'passwordHash' => password_hash('password123', PASSWORD_BCRYPT),
            'displayName' => 'User Alpha',
            'createdAt' => new MongoDB\BSON\UTCDateTime()
        ],
        [
            'email' => 'user_b@test.com',
            'passwordHash' => password_hash('password123', PASSWORD_BCRYPT),
            'displayName' => 'User Beta',
            'createdAt' => new MongoDB\BSON\UTCDateTime()
        ]
    ];

    foreach ($testUsers as $u) {
        $result = $db->users->insertOne($u);
        $userId = (string)$result->getInsertedId();
        echo "Created user: {$u['email']} (ID: $userId)\n";

        // Create sample presentation for User Alpha
        if ($u['email'] === 'user_a@test.com') {
            $db->presentations->insertOne([
                'userId' => $userId,
                'title' => 'Seed Presentation',
                'slides' => [
                    [
                        'id' => 's1',
                        'title' => 'Welcome to AI Presentify',
                        'content' => ['Automated slide creation', 'Intelligent layout engine'],
                        'layout' => 'TITLE',
                        'transitionType' => 'FADE',
                        'notes' => 'Intro slide notes'
                    ]
                ],
                'updatedAt' => new MongoDB\BSON\UTCDateTime(),
                'createdAt' => new MongoDB\BSON\UTCDateTime()
            ]);
            echo "Added sample presentation for User Alpha.\n";
        }
    }

    echo "\n--- Seed Completed Successfully ---\n";

} catch (Exception $e) {
    echo "FATAL ERROR during seeding: " . $e->getMessage() . "\n";
    exit(1);
}
