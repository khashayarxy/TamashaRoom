<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Regression coverage for the E2E flake where /__test/setup-verified-room
 * intermittently returned 500 (UNIQUE constraint failed: users.email).
 *
 * Root cause: the helper created users via faker unique()->safeEmail(), whose
 * "unique" state only lives for one PHP process. Under `php artisan serve` the
 * application reboots per request and the dev/E2E database accumulates users
 * across runs, so faker eventually regenerated an email that already existed.
 * The fix generates a random-suffix email that is unique regardless of process
 * boundaries or how populated the database already is.
 */
class TestHelperEmailUniquenessTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function test_helper_user_email_generator_never_collides(): void
    {
        $emails = [];

        for ($i = 0; $i < 1000; $i++) {
            $emails[] = test_helper_user_email();
        }

        $this->assertCount(1000, array_unique($emails));
        foreach ($emails as $email) {
            $this->assertMatchesRegularExpression('/^e2e-[A-Za-z0-9]{12}@example\.com$/', $email);
        }
    }

    #[Test]
    public function setup_verified_room_creates_unique_emails_against_a_populated_database(): void
    {
        // Mimic the accumulated dev/E2E database (never reset between runs).
        $seededEmails = User::factory()->count(600)->create()->pluck('email');

        $createdEmails = [];

        for ($i = 0; $i < 25; $i++) {
            $response = $this->post('/__test/setup-verified-room');
            $response->assertOk();
            $createdEmails[] = User::findOrFail($response->json('user_id'))->email;
        }

        $this->assertCount(25, array_unique($createdEmails));
        $this->assertSame([], array_intersect($createdEmails, $seededEmails->all()));
        foreach ($createdEmails as $email) {
            $this->assertMatchesRegularExpression('/^e2e-[A-Za-z0-9]{12}@example\.com$/', $email);
        }
    }
}
