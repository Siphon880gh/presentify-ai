<?php
/**
 * Presentify AI - Database Seed Script
 */
// Composer autoload (mongodb/mongodb library provides MongoDB\Client)
$autoload = __DIR__ . '/vendor/autoload.php';
if (file_exists($autoload)) {
    require $autoload;
}

$mongoUri = getenv('MONGODB_URI') ?: "mongodb://localhost/aiorchestrate";
$mongoUser = getenv('MONGODB_USERNAME') ?: "admin";
$mongoPass = getenv('MONGODB_PASSWORD') ?: "password";

echo "--- Seeding Presentify AI Database ---\n";

try {
    if (!class_exists('MongoDB\Client')) {
        throw new Exception("MongoDB PHP Library not found.");
    }
    $client = new MongoDB\Client($mongoUri, [
        'username' => $mongoUser,
        'password' => $mongoPass,
    ]);
    $db = $client->selectDatabase('aiorchestrate');
    
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
